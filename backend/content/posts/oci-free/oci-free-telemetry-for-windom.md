---
{
  "slug": "oci-free-telemetry-for-windom",
  "title": "Telemetry for WindoM on the same small cluster",
  "subtitle": "An authenticated OTLP endpoint, a collector that strips personal data, Loki and Tempo with short retention, and alerts by email",
  "excerpt": "WindoM's API sends its logs, metrics and traces to the cluster over OTLP. The collector removes personal data before anything is stored, retention is short by design, and five alert rules send email.",
  "tags": ["infrastructure", "observability", "opentelemetry", "privacy"],
  "collection": "oci-free",
  "status": "published",
  "publishedAt": "2026-11-04T11:14:40Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "PR #40, telemetry for WindoM", "url": "https://github.com/YehudaBriskman/oci-free/pull/40" }
  ],
  "sources": [
    { "label": "oci-free PR #40", "url": "https://github.com/YehudaBriskman/oci-free/pull/40" }
  ]
}
---
WindoM's API runs elsewhere, but its telemetry needed a home, and the
cluster already had Prometheus, Grafana and Alertmanager. This change gave
it the rest: a public endpoint to send to, somewhere to keep logs and
traces, and alerts that reach a person.

## The pipeline

- **An OTLP endpoint behind a bearer token.** Requests without the token, or
  with a wrong one, are refused. The body size is capped and the endpoint is
  rate-limited as a whole.
- **An OpenTelemetry Collector** receives logs, metrics and traces.
- **Loki keeps logs for 14 days, Tempo keeps traces for 7**, and Prometheus
  scrapes the collector for metrics. Retention is short on purpose: this is
  for finding a problem this week, not for keeping a record.
- **A Grafana dashboard** for WindoM shows requests per second, latency,
  server errors, the database pool and recent errors.

## Privacy before storage

The collector removes personal data before anything is written: client
addresses, email addresses, user ids and authorization headers are dropped,
and tokens are stripped from URLs. This was checked, not assumed: in a local
run of the real configuration, none of those fields reached Loki or Tempo.

## Decisions along the way

- **Prometheus scrapes the collector** rather than accepting remote writes,
  so Prometheus gains no new write endpoint that any pod could use.
- **Alerts run in Loki's ruler and go to the existing Alertmanager**, which
  is already version-controlled in this repository. The rules sit next to
  the data they read.
- **Five rules**: a token reuse detected by the API, an exhausted database pool, a burst
  of server errors, no logs at all for half an hour, and the collector
  refusing or dropping data. Only WindoM's alerts are sent by email.

## Locked down by default

The telemetry stack has its own namespace under the Kubernetes `restricted`
Pod Security level, and its NetworkPolicies deny all traffic by default,
with one rule for each flow the pipeline actually needs.
