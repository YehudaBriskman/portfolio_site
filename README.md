# yehudabriskman.com

The site at [yehudabriskman.com](https://yehudabriskman.com) — a portfolio, a
blog, and the admin surface used to write both. A React single-page app in front
of an Express API, each in its own container, composed together.

## What is here

```
web/   React + Vite + TypeScript SPA, served by nginx
backend/                 Express + TypeScript API
Makefile                 local: `make up`, and the rest of the day's commands
docker-compose.yml       local: builds both images from source
docker-compose.dev.yml   local: the content store, the mail sink, the API's env
docker-compose.ci.yml    deploy: pulls the published images from GHCR
```

### The site

One scrolling landscape carries the whole page: each section sits at its own
altitude in a stack of layers, and the shell keeps the scene mounted across
routes rather than rebuilding it per page.

| Route | |
|---|---|
| `/` | the landing page |
| `/projects`, `/projects/:slug` | the work, with its own artwork and write-ups |
| `/blog`, `/blog/:slug` | posts, grouped by area |
| `/admin/...` | writing posts, areas and links — behind a proxy-enforced gate |

### The API

| Prefix | |
|---|---|
| `/api/blog` | published content, read-only |
| `/api/seo` | per-URL rendered heads, `sitemap.xml`, `feed.xml`, OG images |
| `/api/admin` | authoring; requires the admin gate |
| `/api/email` | the contact form, rate-limited in two tiers |
| `/api/images` | project and post imagery |

The SPA returns the same empty shell for every URL, so nginx routes the human
paths (`/`, `/blog/:slug`, `/projects/:slug`, the sitemap and the feed) through
`/api/seo` first. Crawlers and link previews get a real head; the app still
hydrates normally underneath. Social cards are drawn per URL with resvg, so a
new post needs no asset work.

## Running it

```bash
make up      # build, start, and wait until http://localhost:8080 answers
make seed    # fixture posts, so /blog renders instead of erroring
make down    # stop; `make clean` also drops the content store
make         # the full list
```

`make up` is `docker compose -f docker-compose.yml -f docker-compose.dev.yml`
with a readiness wait in front of it, and the compose files remain the source
of truth — the Makefile knows nothing they do not, so running compose by hand
still works. It is a Makefile rather than the nicer-reading `justfile` because
`just` is a binary that has to be installed first, and `make` is not.

The dev overlay supplies the three things production supplies some other way: a
CouchDB to hold content, a mail sink so the contact form can be used without
relaying anything anywhere, and the API's configuration. That last one matters
more than it sounds — `backend/.env` is gitignored, the API parses its
configuration with Zod at startup, and before the overlay carried it a clean
checkout did not get a degraded API, it got one that exited before listening.

Two services running from source, without containers:

```bash
cd backend && npm ci && npm run dev
cd web     && npm ci && npm run dev
```

The API reads its configuration through a Zod schema in `backend/src/env.ts`,
which fails at startup rather than at the first request if something is missing.
`backend/.env.example` lists what it wants.

## Checks

```bash
make check   # exactly the two lines below, in order
```

```bash
cd web && npm run lint && npm run typecheck && npm test && npm run build
cd backend              && npm test && npm run build
```

CI runs exactly these on every pull request, plus hadolint over both Dockerfiles
and a parse of both compose files. On `main` it also builds and publishes the
two images to GHCR and scans them with Trivy:

```
ghcr.io/yehudabriskman/portfolio_site/web:latest
ghcr.io/yehudabriskman/portfolio_site/api:latest
```

Built for `linux/amd64` and `linux/arm64`, because the cluster runs on an arm64
node.

## How it reaches production

Merging does not ship. A push to `main` is built, tested, and published to
GHCR under its commit sha — so every commit on `main` is deployable — but
nothing reaches the site until somebody tags it.

```sh
git tag -a v1.2.0 -m "what changed"
git push origin v1.2.0
```

```
push to main ──▶ build + test ──▶ ghcr.io/…:<sha>                (no deploy)

push a tag   ──▶ build + test ──▶ ghcr.io/…:<sha>, :<tag>, :latest
                                        │
                              kubectl set image <sha>
                                        │
                        rollout status ──▶ curl the site
                                        │
                               not 200? ──▶ rollout undo
```

Three things follow from the split, and each is the reason for it:

**Releasing is a decision.** `main` stays continuously integrated rather than
continuously released, and a rollback has a name — `v1.2.0` is something you
can redeploy, where "the commit before last Tuesday's merge" is something you
have to go and find.

**`:latest` means the last release**, not the last merge. The k8s manifest
carries `:latest` as the tag a fresh `kubectl apply` lands on, so while it
moved on every merge an apply between releases would have quietly deployed
unreleased code.

**The rollout runs on the sha, not the tag.** A sha cannot move and a git tag
can. The version is written on as an annotation, so `kubectl describe deploy`
still answers "which release is live" without mapping hex back to a name.

The release tags are aliases rather than rebuilds — `imagetools create` points
new tags at the manifest that already passed, so what ships is the exact bytes
that were tested.

The cluster's API server is not reachable from the internet and is not going to
be, so the runner joins the tailnet for the length of the job. Setup — three
repository secrets and one cluster secret — is in the `oci-free` README next to
the manifests.

This replaced `deploy-portfolio.sh`, which rsynced a laptop's working directory
to the node and built it there. That could put code on the live site that was
never committed, and for six weeks it did. It had also stopped working
entirely: it still synced a frontend directory renamed six weeks earlier, so
rsync failed, `set -e` aborted the run, and the site quietly stopped updating
with nothing reporting it. The script survives as a fallback with the path
fixed; it still ships a working directory, which is why it is not the route.
## Notes

CORS is restricted to the site's own origins — `/api/email` relays real SMTP, so
a wildcard would let any page on the internet drive it from a visitor's browser.
Every route is rate-limited, including the admin one, which is gated but was
otherwise an unmetered oracle for guessing the proxy secret.

The frontend has no tests yet. `npm test` runs and passes because there is
nothing to run.
