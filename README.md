# yehudabriskman.com

The site at [yehudabriskman.com](https://yehudabriskman.com) — a portfolio, a
blog, and the admin surface used to write both. A React single-page app in front
of an Express API, each in its own container, composed together.

## What is here

```
glassglow-folio-space/   React + Vite + TypeScript SPA, served by nginx
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
cd glassglow-folio-space && npm ci && npm run dev
```

The API reads its configuration through a Zod schema in `backend/src/env.ts`,
which fails at startup rather than at the first request if something is missing.
`backend/.env.example` lists what it wants.

## Checks

```bash
cd glassglow-folio-space && npm run lint && npm run typecheck && npm test && npm run build
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

## How it reaches production, and the gap in that

The site runs on a k3s cluster on a single ARM node. Today the rollout is
`deploy-portfolio.sh` in the `oci-free` repository: it rsyncs **the working
directory** to the node, builds there, and imports into containerd — which is
why the deployments pin `imagePullPolicy: Never`.

That means the live site can be running code that was never committed, and for
six weeks it was. The images above exist to replace that: once the deployments
reference a published tag, a rollout is something that happened in CI from a
known commit rather than something a laptop did.

## Notes

CORS is restricted to the site's own origins — `/api/email` relays real SMTP, so
a wildcard would let any page on the internet drive it from a visitor's browser.
Every route is rate-limited, including the admin one, which is gated but was
otherwise an unmetered oracle for guessing the proxy secret.

The frontend has no tests yet. `npm test` runs and passes because there is
nothing to run.
