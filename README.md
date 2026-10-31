# yehudabriskman.com

The site at [yehudabriskman.com](https://yehudabriskman.com) — a portfolio, a
blog, and the admin surface used to write both. A React single-page app in front
of an Express API, each in its own container, composed together.

## What is here

```
web/   React + Vite + TypeScript SPA, served by nginx
backend/                 Express + TypeScript API
docker-compose.yml       local: builds both images from source
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
# everything, built from source
docker compose up --build

# just the API
cd backend && npm ci && npm run dev

# just the site
cd web && npm ci && npm run dev
```

The API reads its configuration through a Zod schema in `backend/src/env.ts`,
which fails at startup rather than at the first request if something is missing.
`backend/.env.example` lists what it wants.

## Checks

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

A push to `main` builds both images, publishes them to GHCR multi-arch, and
rolls them out — `kubectl set image` against the commit sha, so what is running
is always a commit somebody can check out.

```
push to main ──▶ build + test ──▶ ghcr.io/…/{web,api}:<sha> ──▶ kubectl set image
                                                                      │
                                                 rollout status ──▶ curl the site
                                                                      │
                                                        not 200? ──▶ rollout undo
```

The cluster's API server is not reachable from the internet and is not going to
be, so the runner joins the tailnet for the length of the job with an ephemeral
node. Setup — three repository secrets and one cluster secret — is in the
`oci-free` README next to the manifests.

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
