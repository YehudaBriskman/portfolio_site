# Hardening notes (issue #876)

Small hardening items from a source-only review, recorded by class. None is a
confirmed vulnerability on its own.

## API

- **A GET does not write.** Reading the audience group and contact lists used to
  start housekeeping (create the system group, add consent records to old
  contacts, delete expired pending signups). The audit log and read-scoped API
  tokens both treat GET as safe, so a write there was neither gated nor
  recorded. The housekeeping now runs at boot, in the hourly sweep, and on
  `POST /api/admin/audience/maintenance`. `src/adminReadOnlyGet.test.ts` walks
  the real route table and fails if any admin GET attempts a write.
- **Gate before body.** In `app.ts` the admin API's limiter and gate run before
  its JSON parser, so a caller that is not let in has no body read. The 1 MB
  limit still applies to callers that are.
- **MCP rate limits.** `/mcp/public` and `/mcp` have separate buckets, per
  minute per client address: `MCP_PUBLIC_RATE_LIMIT` (default 60) and
  `MCP_RATE_LIMIT` (default 120).
- **MCP grants follow the owner setting.** A grant records who it was issued to.
  At use (access token) and at refresh it is checked against the owner setting
  as it is now (`ADMIN_GITHUB_LOGIN`, `ADMIN_GITHUB_ID`, or the id recorded at
  first sign-in). A mismatch revokes the grant.

## Web image

- Runs on `nginxinc/nginx-unprivileged` (uid 101). It listens on 8080, as this
  image always has, so **no Service, probe or Ingress change is needed**. In the
  cluster manifests `securityContext.runAsNonRoot: true` and `runAsUser: 101`
  can now be added; that is optional and the owner's call.
- The internal MCP ticket header is blanked on every proxied location.
- **Forwarded identity default: off.** `NGINX_FORWARD_IDENTITY` defaults to
  `off` in the image, so a new environment drops the gate's identity headers
  and fails closed. `NGINX_FORWARD_IDENTITY=on` is the explicit opt-in for the
  preprod gate, whose admin works only if the gate's headers pass through this
  nginx; it is set on the preprod web Deployment. Production sets `off`.

## CI

- The Deploy job verifies, before anything is rolled out, that both image
  digests carry build provenance signed by this repository's `ci.yml`
  (`gh attestation verify`). The repository variable `ATTESTATION_VERIFY=off`
  skips it with a warning, for a day the attestation API is unavailable.
- `docker-compose.ci.yml` has no `:latest` default: `WEB_IMAGE` and
  `API_IMAGE` must name a digest. The compose-parse step fails on any
  `image: ...:latest`.
