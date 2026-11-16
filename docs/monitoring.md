# Monitoring: the API's Prometheus metrics

The API exposes Prometheus metrics (#890) on a **separate, internal port**.
They are for alerting on the app itself: error ratio, mail failures, a stuck
campaign queue.

## Exposure

- `/metrics` is served by its own listener on `METRICS_PORT` (default `9464`,
  bound to `0.0.0.0` inside the pod). It answers `GET /metrics` and 404s
  everything else.
- The public API listens on `PORT` (5000) and has no `/metrics` route.
- Publish `9464` only through an in-cluster Service. Never add it to the
  public `api` Service or an Ingress. nginx forwards only `/api/*` and the
  named SEO/MCP routes, so `/metrics` on the public host is the SPA's 404
  (`backend/src/metrics.test.ts` fails if an nginx location ever matches it).
- `METRICS_PORT` must differ from `PORT` (the env schema refuses to boot
  otherwise); `METRICS_PORT=0` turns the listener off.
- `METRICS_TOKEN` (16+ characters, optional) additionally requires
  `Authorization: Bearer <token>`, compared in constant time. Not needed when
  the port is in-cluster only.

## Metrics

Default process and Node.js runtime metrics (`process_*`, `nodejs_*`), plus:

| Metric | Labels | Meaning |
|---|---|---|
| `http_requests_total` | `method`, `route`, `status_class` | finished requests; `route` is the matched template (`/api/subscribe/confirm`), or `unmatched` for 404s, scanners and rate-limit refusals |
| `http_request_duration_seconds` | same | histogram |
| `mail_send_total` | `result` = `ok` `failed` `suppressed` `blocked` | every send through the provider door; `blocked` is the `SEND_ENABLED` policy hold (anything but an explicit on), `suppressed` a campaign recipient skipped because they are suppressed |
| `signup_total` | `result` = `created` `resent` `known` `suppressed` `bot` `invalid` `confirmed` `unsubscribed` | list outcomes (`known`: active, pending too recently or already handled) |
| `rate_limit_hits_total` | `route` = limiter name (`email_burst`, `subscribe`, `subscribe_link`, `seo`, `admin`, `read`) | requests refused by a limiter |
| `campaign_queue_depth` | `state` = `scheduled` `sending` | as of the last sender tick |
| `campaign_sender_last_tick_timestamp_seconds` | none | last tick that read the queue |

## Privacy rule

A label value is a fixed word or a route template. Never an address, a
subscriber id or hash, a token, an IP, a query string or visitor text. The
signup endpoint deliberately answers every address identically; these counters
are internal and aggregate, and no per-person series can exist. The test
scans the scraped output after a signup, confirm and unsubscribe with a known
address and fails on any trace of it. A new metric needs a new label set that
passes the same scan.

## Alerts

Ready-to-apply ServiceMonitor, in-cluster Service and the alert rules for the
oci-free repository are in [oci-free-servicemonitor.yaml](oci-free-servicemonitor.yaml)
(not applied from here: the cluster manifests live in oci-free).
