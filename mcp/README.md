# portfolio-mcp

> **Most people want the remote server instead:** nothing to download, sign in
> with GitHub in the browser. See **https://yehudabriskman.com/developers/mcp**,
> or just run
>
> ```sh
> claude mcp add --transport http yehuda https://yehudabriskman.com/mcp
> ```
>
> The remote server (#263) is the backend itself (`backend/src/mcp/`), live
> once the owner sets `MCP_REMOTE=on`. This package is the stdio transport,
> kept for local work against the Compose stack and for the token path below.

An MCP server (stdio) over the site's HTTP API (#252), so Claude Code — or any
MCP client — can read the site and, with a token, edit it.

## One set of tools, two transports

The tool definitions live in `src/tools.ts` and both transports use them. The
backend's Docker build context is `backend/` alone, so it carries a generated
copy in `backend/src/mcp/shared/`. After editing `src/api.ts`, `src/diff.ts` or
`src/tools.ts`, run

```sh
node mcp/scripts/sync-shared.mjs
```

and commit the copy; a test on each side fails while the two differ.

It holds no content and no database access of its own: every tool is one or
two calls to `/api/...`, and every write goes through the same validation,
optimistic lock and audit log as the admin UI.

## Tools (v1)

**Public reads** — always registered:

| Tool | API |
|---|---|
| `list_posts` (`tag?`, `area?`) | `GET /api/blog/posts` |
| `get_post` (`slug`) | `GET /api/blog/posts/:slug` |
| `list_tags` | `GET /api/blog/tags` |
| `list_areas` | `GET /api/areas` |
| `get_area` (`slug`) | `GET /api/blog/collections/:slug` |
| `list_activity` (`limit?`, `before?`, `area?`, `kind?`) | `GET /api/activity` |

**Admin** — registered only when `PORTFOLIO_ADMIN_TOKEN` is set:

| Tool | What it does |
|---|---|
| `admin_list_posts`, `admin_get_post` | Every post, drafts included |
| `save_post_draft` | Create a post as a draft, or update fields of one. Never changes status |
| `publish_post` / `unpublish_post` | The only tools that change a post's status |
| `delete_post` | Archive a post. Needs `confirm: true` |
| `save_area` | Create or update an area |
| `delete_area` | Hide an area. Needs `confirm: true` |
| `read_audit_log` | The backend's record of admin writes |

Every write takes **`dryRun`, default `true`**: it reads the current document,
works out the change and returns a field-by-field diff (a post body as a line
diff), and writes nothing. Call again with `dryRun: false` to apply. A delete
also needs `confirm: true`; without it the call refuses and nothing changes.

**The tool set grows with the CMS.** As more content becomes editable in the
backend (#163 moves `web/src/data` into the store; #253 and #254 follow), each
new admin endpoint gets its read tool and a dry-run write tool here, with the
same rules.

## Configuration

| Variable | |
|---|---|
| `PORTFOLIO_API_URL` | **Required, no default.** The origin that serves `/api`: `http://localhost:8080` for the Compose stack, `https://yehudabriskman.com` for production. |
| `PORTFOLIO_ADMIN_TOKEN` | Optional. Without it the server is read-only. Refused over plain `http` to anything but localhost. |

## Tokens

The admin API can take `Authorization: Bearer ptk_...` in addition to the
browser sign-in — **but only once the owner turns it on.** The backend's
`ADMIN_API_TOKENS` switch:

| Value | Bearer tokens are accepted |
|---|---|
| `off` (**default**) | never. The header is ignored and `/api/admin` answers only to the oauth2-proxy session, exactly as before tokens existed. Prod and preprod stay closed until you opt in. |
| `tunnel` (**recommended**) | only on a loopback socket — a `kubectl port-forward` to the api pod. Everything through the public ingress arrives from the web pod, so the public domain stays closed to tokens. |
| `on` | from anywhere, the public domain included. Opt-in, for when a tunnel is not possible. |

A token is:

- **scoped** — `read` (GET only) or `write`. Both ways of minting default to `read`; `write` has to be asked for;
- **expiring** — every token has an `expiresAt`: 30 days by default, 90 at most. Expired is refused;
- **hashed at rest** — the store keeps only its SHA-256; the plaintext is shown once;
- **revocable** — a revoked token is refused on the next request;
- **unable to manage tokens** — minting, listing and revoking need the browser sign-in;
- **watched** — `lastUsedAt` is recorded (at most once a minute); every refused
  bearer is logged with the token id's first six characters (never the
  secret), and ten refusals from one address in fifteen minutes lock that
  address out of bearer auth for the rest of the window.

Every write a token makes is in the audit log under `token:<name>`, with the
before/after hashes of the document (`read_audit_log`, or
`GET /api/admin/audit` from the admin session).

Mint one either way:

```sh
# From the signed-in admin session (browser devtools on the admin host):
#   await (await fetch("/api/admin/tokens", { method: "POST",
#     headers: { "Content-Type": "application/json" },
#     body: JSON.stringify({ name: "claude-laptop", scope: "write", expiresInDays: 30 }) })).json()

# Or straight in the store, from backend/ (COUCHDB_URL has no default):
COUCHDB_URL=http://127.0.0.1:5984 COUCHDB_USER=portfolio_api COUCHDB_PASSWORD=... \
  npx tsx scripts/api-token.ts create claude-laptop --scope write --days 30
#   ... create claude-reader          (read, 30 days)
#   ... list
#   ... revoke <id>
```

For production, `kubectl port-forward` the CouchDB service and point
`COUCHDB_URL` at the forward. Tokens made by the script are not in the audit
log (the script writes the store directly); tokens made through the API are.

**Never commit a token.** Keep it in your shell's secret store or an untracked
env file, and pass it to `claude mcp add` with `-e` as below — that writes it
to your user-level Claude config, not this repository. Do not use
`--scope project`, which writes `.mcp.json` into the repo.

## Add it to Claude Code

Build once:

```sh
cd mcp && npm ci && npm run build
```

**Local** (the Compose stack on `:8080`). Read-only works as is. For writes,
put `ADMIN_API_TOKENS=on` in `backend/.env` — local only; the Compose stack
reaches the api through the web container, so `tunnel` would refuse it.

```sh
claude mcp add portfolio-local \
  -e PORTFOLIO_API_URL=http://localhost:8080 \
  -- node "$PWD/dist/index.js"
```

**Production, read-only** (public routes need no token):

```sh
claude mcp add portfolio-prod \
  -e PORTFOLIO_API_URL=https://yehudabriskman.com \
  -- node "$PWD/dist/index.js"
```

**Production with writes — recommended: through a tunnel.** Set
`ADMIN_API_TOKENS=tunnel` on the prod api Deployment (in the oci-free
repository's manifest), then forward the api pod to your machine. From a
machine with cluster credentials, or over SSH to the node:

```sh
# kubectl here:
kubectl -n prod port-forward deploy/api 15000:5000 --address 127.0.0.1
# or kubectl on the node, reached over SSH:
ssh -L 15000:127.0.0.1:15000 <node> \
  kubectl -n prod port-forward deploy/api 15000:5000 --address 127.0.0.1
```

and point the server at the forward (plain http is allowed to localhost only):

```sh
claude mcp add portfolio-prod-admin --scope user \
  -e PORTFOLIO_API_URL=http://localhost:15000 \
  -e PORTFOLIO_ADMIN_TOKEN="$(pass show portfolio/mcp-token)" \
  -- node "$PWD/dist/index.js"
```

The tools only work while the forward is up, which is the point: nothing on
the public internet accepts the token.

**Production with writes over the public domain (opt-in).** Only with
`ADMIN_API_TOKENS=on` on the prod api, and only if you accept that a token
then works from anywhere:

```sh
claude mcp add portfolio-prod-admin --scope user \
  -e PORTFOLIO_API_URL=https://yehudabriskman.com \
  -e PORTFOLIO_ADMIN_TOKEN="$(pass show portfolio/mcp-token)" \
  -- node "$PWD/dist/index.js"
```

Check either with `claude mcp list`, then ask Claude to `list_posts`. Before
the first write, confirm the token is accepted where you expect it:

```sh
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:15000/api/admin/me
# {"ok":true,"login":"token:claude-laptop","via":"token",...}
# Under `tunnel`, the same request to https://yehudabriskman.com must answer 401.
```

## Develop

```sh
npm test          # vitest: registration, dry-run diffs, confirm, auth refusals (mocked API)
npm run typecheck
PORTFOLIO_API_URL=http://localhost:8080 npm run dev
```
