---
{
  "slug": "site-content-in-the-store",
  "title": "The site's content moves out of the source",
  "subtitle": "Projects, the story and the site copy in CouchDB, edited from the admin, with the repository as the fallback",
  "excerpt": "Changing a sentence on the home page used to mean a commit and a release. Now the content lives in the store with a draft and a publish step, and the source files remain as the seed and the fallback.",
  "tags": ["site", "content", "admin", "couchdb"],
  "collection": "site",
  "status": "published",
  "publishedAt": "2026-11-03T07:43:58Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "PR #265, the site's content in the store", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/265" }
  ],
  "sources": [
    { "label": "PR #265, the site's content in the store", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/265" },
    { "label": "PR #285, an editor for notes", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/285" },
    { "label": "PR #284, site settings", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/284" }
  ]
}
---
Until this change, notes were the only thing on the site that could be
edited without a release. Everything else, the projects, the story, the
hero, How I work, the contact copy, the profiles and the footer, lived in
TypeScript files under `web/src/data`. Fixing a word meant a commit, a pull
request, a merge and a tag.

## What moved, and what stayed

That content now lives in the same CouchDB store as the notes, as three
documents: `projects`, `story` and `site-copy`. Each has its own zod schema,
and the admin has an editor for each.

Prose is stored as `{ en, he? }`, English always and Hebrew when it has been
written. Names, slugs, addresses and states stay plain strings, because code
reads them.

The data files did not go away. They are the seed the store starts from,
and they are the fallback: a document that is missing or will not parse is
served from the seed, so the site renders the same before anyone has seeded
anything, and keeps rendering if the store has a problem. The seed is
generated from the data files, and a test fails if the two drift apart.

## Draft, then publish

Every edit is a draft until it is published. The routes take the revision
the editor read, so two tabs editing the same document cannot silently
overwrite each other: the second save gets a conflict and is asked to
reload.

Publishing re-checks the rules that used to run at build time. The story,
for example, must have unique beat ids, and every layout, image and interlude
must point at a beat that exists. The check runs against the other documents
as they are published, so a valid story cannot be broken by an edit to the
projects.

## Reading it

The public routes, `GET /api/content` and `GET /api/content/:key`, are cached
for a minute like the site's other reads. The server render reads the same
store, so a crawler and a person see the same words.

## What followed in the same release

- **A real editor for notes**, with a live preview drawn by the renderer
  readers get, a toolbar, keyboard shortcuts, pictures by paste or drop, and
  `[[` completion over notes, areas and projects. A published note changes
  for readers only when Publish is pressed; autosave writes to a draft.
- **Site settings**: the order and visibility of the home page's sections,
  the default theme and motion, and an accent colour. The defaults equal the
  site as it was, and every save is a version that can be put back.
