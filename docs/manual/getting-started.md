# Getting started and local development

Everything here runs on one machine with Docker. Nothing reaches a deployed
environment.

## Prerequisites

- Docker with the Compose plugin, for the stack.
- Node 24 and npm, for `make check` and for running a service from source
  (CI uses Node 24).
- `make` and `curl`, which the Makefile wraps everything in.

## The stack in one command

```bash
make up      # build both images, start, and wait until http://localhost:8080 answers
make seed    # fixture posts, so /blog renders instead of showing its error card
make smoke   # four requests that prove nginx → API → CouchDB is wired end to end
make down    # stop; `make clean` also deletes the content store
make         # the full list
```

| What | Where |
|---|---|
| the site | http://localhost:8080 |
| the mail sink (everything the contact form "sends") | http://localhost:8025 |
| CouchDB, the content store | http://127.0.0.1:5984 |

`make up` is `docker compose -f docker-compose.yml -f docker-compose.dev.yml up
-d --build` plus a readiness wait, so running Compose by hand works the same.
The dev overlay (`docker-compose.dev.yml`) supplies what production supplies
another way: a CouchDB, a mail sink, and the API's configuration. If the site
never answers, the API most likely exited because its configuration did not
parse: `make logs S=api`.

Other targets: `make build`, `make restart`, `make logs` (`S=api` for one
service), `make ps`.

## Running a service from source

```bash
cd backend && npm ci && npm run dev    # tsx watch src/server.ts
cd web     && npm ci && npm run dev    # Vite on http://localhost:8080
```

The Vite dev server proxies `/api` to `http://localhost:5000`. The API reads
its configuration through a Zod schema in `backend/src/env.ts` and refuses to
start if something required is missing; `backend/.env.example` lists every
variable. Copy it to `backend/.env` (gitignored) and set `PORT=5000` so the
proxy finds it. Stop the `web` container first if the stack is up, since both
want port 8080.

## Checks

```bash
make check
```

That runs exactly what CI runs on a pull request, in the same order:

```bash
cd web     && npm ci && npm run lint && npm run typecheck && npm test && npm run build
cd backend && npm ci && npm run lint --if-present && npm test && npm run build
```

More, per package:

| Command | What it does |
|---|---|
| `cd web && npm run a11y` | axe (WCAG 2.2 AA) across the routes |
| `cd web && npm run links` | checks that links land where they point |
| `cd mcp && npm test && npm run typecheck` | the stdio MCP server |

CI also lints both Dockerfiles (hadolint), parses the Compose files, lints the
workflows (actionlint, zizmor) and scans new commits for secrets (gitleaks),
all in the `Static` job.

## Layout

```
web/        React + Vite + TypeScript SPA, served by nginx
backend/    Express + TypeScript API (content, SEO heads, media, admin, remote MCP)
mcp/        stdio MCP server over the API
docs/       this manual, design records and audits
```

Next: [the admin and content guide](admin.md).
