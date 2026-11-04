---
{
  "slug": "site-1-2-hebrew-and-admin",
  "title": "Site 1.2: Hebrew, an admin for everything, and an MCP server",
  "subtitle": "The largest release so far: the content moves into the store, the site gains a second language, and search engines are told which pages have it",
  "excerpt": "Everything on the site becomes editable from the admin, the whole site exists in Hebrew with a workflow that keeps the translation current, and an MCP server can read and write it.",
  "tags": ["site", "release", "i18n", "mcp"],
  "collection": "site",
  "status": "published",
  "publishedAt": "2026-11-04T13:29:44Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Tag v1.2.0", "url": "https://github.com/YehudaBriskman/portfolio_site/tree/v1.2.0" }
  ],
  "sources": [
    { "label": "Tag v1.2.0", "url": "https://github.com/YehudaBriskman/portfolio_site/tree/v1.2.0" },
    { "label": "PR #265, the site's content in the store", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/265" },
    { "label": "PR #270, the media library", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/270" },
    { "label": "PR #287, every page in Hebrew", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/287" },
    { "label": "PR #264, the remote MCP server", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/264" },
    { "label": "PR #291, the admin's shell", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/291" },
    { "label": "PR #318, index a Hebrew page only when it has Hebrew", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/318" },
    { "label": "PR #326, a cluster credential per environment", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/326" }
  ]
}
---
1.2 is the largest release so far. Three things changed at once: almost
nothing on the site is hard-coded any more, the site exists in a second
language, and there is a programmatic way in. Each of the larger pieces has a
note of its own; this one is the map.

## Everything is content

- **The site's content lives in the store.** Projects, the story, the hero,
  How I work, the contact copy and the footer moved from source files into
  CouchDB, with a draft and a publish step, and are edited from /admin.
- **A media library** for pictures, icons and short videos, with responsive
  AVIF and WebP variants and the metadata stripped on upload.
- **An editor for notes**, with a live preview drawn by the same renderer
  readers get, a toolbar, keyboard shortcuts, pictures by paste or drop, and
  `[[` links to other notes.
- **Site settings**: the order and visibility of the home page's sections,
  the default theme, the default motion and the accent colour, with every
  save versioned and any version restorable.
- **An admin rebuilt as a tool**: a shell with a side navigation, an
  overview, lists and forms in GitHub's shape.

## Reading

- **Reader mode for notes**: an outline that follows the heading being read,
  a picture viewer with zoom and pan, and diagrams drawn safely under the
  page's CSP.
- **One theme system**, Light and Dark, on every page.
- **Text size and contrast controls** in the theme menu.

## Hebrew

Every page exists under `/he`, right to left, rendered on the server in
Hebrew. Notes, areas, projects, media captions and link labels can carry a
Hebrew translation, and the admin shows which translations are missing or
out of date. Search engines are told about a Hebrew page only when it really
has Hebrew: an untranslated one is marked `noindex` and left out of the
sitemap. The sitemap now lists every public page in both languages, and
publishing a note can notify search engines through IndexNow.

## MCP

An MCP server can read the site and, with a write scope, edit it: locally
over stdio, or over HTTPS with a GitHub sign-in, behind a switch that is off
by default. Every write defaults to a dry run, and every admin write is
recorded in an audit log.

## Deploys

The deploy job now uses a separate cluster credential for each environment,
and refuses to run with one that can reach the other environment.
