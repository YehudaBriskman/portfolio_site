---
{
  "slug": "site-1-0-first-release",
  "title": "Site 1.0: the first release",
  "subtitle": "A gallery home page, a contribution city, a story, and a release that is a tag",
  "excerpt": "The first tagged release of yehudabriskman.com: the rebuilt pages, an accessibility floor held in CI, and a pipeline where merging reaches preprod and only a tag reaches production.",
  "tags": ["site", "release", "ci", "accessibility"],
  "collection": "site",
  "status": "published",
  "publishedAt": "2026-11-02T10:57:14Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Tag v1.0.0", "url": "https://github.com/YehudaBriskman/portfolio_site/tree/v1.0.0" }
  ],
  "sources": [
    { "label": "Tag v1.0.0", "url": "https://github.com/YehudaBriskman/portfolio_site/tree/v1.0.0" },
    { "label": "PR #2, move the build to GitHub Actions", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/2" },
    { "label": "PR #49, roll out from a known commit", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/49" },
    { "label": "PR #61, ship on a tag, not on a merge", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/61" },
    { "label": "PR #67, a preprod that tracks main", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/67" },
    { "label": "PR #136, the WCAG 2.2 AA audit", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/136" },
    { "label": "PR #149, rate limits and a real CSP", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/149" }
  ]
}
---
v1.0.0 is the first tagged release of this site. It is also the first one
made the way every later release is made: a tag on a commit that preprod was
already running, not a merge.

## What a release means here

Before this, the site was built on the server from a local working
directory, so what ran there was not necessarily what was committed. Three
changes replaced that:

- **The build moved to GitHub Actions.** Every push to `main` is linted,
  type-checked, tested and built into two images, `web` and `api`, which are
  scanned with Trivy before they are published.
- **CI rolls the site out**, by commit SHA rather than a moving tag. It then
  requests the site itself, and undoes the rollout if the site does not
  answer.
- **Shipping is a tag.** `main` is continuously integrated, not continuously
  released. A push to `main` goes to preprod; a `v*` tag goes to production.
  A release tag is an alias for the image that already passed, never a
  rebuild, and `:latest` now means the last release.

## What is in it

- **A home page rebuilt as a gallery**, with the first screen composed as one
  picture.
- **The contribution year as a city.** A year of GitHub contribution days,
  served by the API from a cached copy that refreshes every half hour. It
  answers with a reason rather than an error when the data is not there.
- **/story**: the work told as a chaptered story along the years.
- **Pages a crawler can read.** Each public route is rendered on the server
  with its own head and Open Graph image.
- **An admin** for writing notes and areas.

## The floor it holds

- **Accessibility.** Every public route was audited against WCAG 2.2 AA, with
  axe-core and by hand. What failed was fixed, and CI holds the floor so it
  cannot slip back.
- **Headers and limits.** A real Content Security Policy, security headers in
  every nginx location, and rate limiters keyed on the real client rather
  than on the proxy in front of the API.
- **Dependencies.** The runtime advisories in the backend went from eight to
  none, and the image scan became a gate rather than a report.
- **Errors.** Every backend route answers an error as JSON in one shape, and
  logs it through pino.
