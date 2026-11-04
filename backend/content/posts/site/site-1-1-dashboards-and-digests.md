---
{
  "slug": "site-1-1-dashboards-and-digests",
  "title": "Site 1.1: dashboards for notes and work, and releases by digest",
  "subtitle": "An activity API, an area's notes as a history, and a release that ships the exact bytes that were scanned",
  "excerpt": "Notes and work become dashboards over a new activity API, the first project notes arrive, and CI changes so a release promotes the very image it built and scanned.",
  "tags": ["site", "release", "ci", "security"],
  "collection": "site",
  "status": "published",
  "publishedAt": "2026-11-03T06:24:50Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Tag v1.1.0", "url": "https://github.com/YehudaBriskman/portfolio_site/tree/v1.1.0" }
  ],
  "sources": [
    { "label": "Tag v1.1.0", "url": "https://github.com/YehudaBriskman/portfolio_site/tree/v1.1.0" },
    { "label": "PR #229, activity feed and per-area RSS", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/229" },
    { "label": "PR #234, /blog as a dashboard", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/234" },
    { "label": "PR #235, an area's notes as a commit history", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/235" },
    { "label": "PR #220, one native arm64 candidate", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/220" },
    { "label": "PR #231, promote releases by digest", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/231" },
    { "label": "PR #233, SBOM, provenance, gitleaks and CodeQL", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/233" },
    { "label": "PR #245, the WindoM and Bothy notes", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/245" }
  ]
}
---
1.1 came a day after 1.0. It has two halves: the reading side of the site
became a set of dashboards, and the release pipeline changed so that what
reaches production is provably what was tested.

## Notes and work as dashboards

- **/blog** is a three-column dashboard in the layout of GitHub's: the top
  areas, the top notes, a search where `#` picks a topic and `@` an area, and
  the activity beside them.
- **An area's page reads like a commit history.** Its notes are grouped by
  day, each with a short id, a permalink and a share button.
- **/blog/log** is the full activity log across every area.
- **/projects** is a dashboard too, with a tab per project, and a project's
  own page moved onto the same dark ground.
- **The navigation** is Home, Journey, Work, Blogs, in that order.

The first real notes for the project areas, WindoM and Bothy, arrived in
this release as reviewed drafts in the repository, with an import script that
only prints a diff unless it is told to write.

## The API behind them

- **`GET /api/activity`**: one feed of published notes, project releases,
  pushes, this site's own releases and new areas, newest first, with a
  keyset cursor.
- **`GET /api/areas`**: the public areas with their note counts, last
  activity and topics, ordered by recent activity.
- **An RSS feed per area**, beside the site-wide one.

Nothing in it reads GitHub while a page is loading. Repository facts are
fetched on a schedule and stored, so a GitHub outage or a rate limit never
slows a page down. Drafts, archived notes and hidden areas never appear, and
the tests hand the builder all of them anyway to prove it.

## Releases ship the bytes that were scanned

- **One candidate, built once.** Each image is built natively for arm64,
  scanned with Trivy, and saved. Publishing builds nothing: it pushes that
  saved image, then reads it back from the registry and fails unless it is
  the one that was scanned.
- **A release manifest per commit**, stored in GHCR beside the images. It
  records the image digests, the build inputs, the tool versions and the
  scan results. Deploys roll out by digest from it.
- **Partial rollouts are rolled back.** If anything fails after the first
  change, both deployments are put back as they were, and readiness and
  version are checked inside the cluster.

## CI hardening

- Every third-party action is pinned to a full commit SHA.
- gitleaks scans the commits a pull request adds, and CodeQL runs on the
  code.
- Images carry an SBOM and build provenance.
- A daily job rescans the images that are actually deployed with that day's
  vulnerability database. It never builds or deploys, and a scanner error is
  never reported as clean.
- Changed paths decide which jobs run, and one stable check gates the merge.
