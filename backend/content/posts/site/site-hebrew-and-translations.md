---
{
  "slug": "site-hebrew-and-translations",
  "title": "The site in Hebrew, and how the translation stays current",
  "subtitle": "A second address for every page, a glossary with a lint, and a fingerprint that notices when the English moves on",
  "excerpt": "Every page exists under /he. Each piece of Hebrew remembers the English it was written against, so an English edit shows up as stale Hebrew, and search engines only index a Hebrew page that has Hebrew.",
  "tags": ["site", "i18n", "hebrew", "seo"],
  "collection": "site",
  "status": "published",
  "publishedAt": "2026-11-04T12:45:55Z",
  "readingMinutes": 3,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "The bilingual content design", "url": "https://github.com/YehudaBriskman/portfolio_site/blob/main/docs/i18n/bilingual-content-design.md" },
    { "label": "The Hebrew tech glossary", "url": "https://github.com/YehudaBriskman/portfolio_site/blob/main/docs/i18n/hebrew-tech-glossary.md" }
  ],
  "sources": [
    { "label": "PR #280, Hebrew as a real locale under /he", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/280" },
    { "label": "PR #287, every page in Hebrew", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/287" },
    { "label": "PR #298, the bilingual content design", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/298" },
    { "label": "PR #312, the English fingerprint", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/312" },
    { "label": "PR #322, the Translations page", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/322" },
    { "label": "PR #323, the note editor in both languages", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/323" },
    { "label": "PR #318, index a Hebrew page only when it has Hebrew", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/318" }
  ]
}
---
Translating a site once is a project. Keeping it translated is a process, and
the second part is the one that usually fails: the English is edited, the
Hebrew is not, and nobody can tell which Hebrew sentences still say what the
English says. Most of the work in 1.2 went into that second part.

## A second address, not a preference

Hebrew lives at the same address under `/he`: `/he/blog`,
`/he/projects/windom`. A stored preference would have been simpler, but a
crawler has no storage, `hreflang` needs two addresses, and the server
render has to know the language from the request alone. A shared link opens
in the language it was shared in.

The router takes `/he` as its base, so existing links stay in Hebrew without
changes. `lang` and `dir` are set on `<html>` before the first paint, by the
server render and again by the app.

## Every string, and the rules for writing them

Every interface string has a Hebrew entry, and a test fails when a new
English string appears in the markup without one. Dates and counts go
through `Intl` in the reader's language, and reading time uses Hebrew's
singular, dual and plural forms.

The words follow a glossary the owner approved: which terms stay in Latin
letters (GitHub, API, MCP), which are transliterated, and which have an
established Hebrew word. It also fixes the typography, such as the maqaf
that joins a Hebrew prefix to a Latin word. A lint runs it over every
Hebrew string in the source.

Content that has no Hebrew yet falls back to the English, marked
`lang="en" dir="ltr"` so a screen reader pronounces it correctly, and an
untranslated note says above its body that it is written in English.

## A fingerprint of the English

When Hebrew is saved, the server records a short hash of the English it was
written against. When the English later changes, the hash no longer matches
and the Hebrew reads as stale. It is a hash of normalised text rather than a
version counter, so reflowing a paragraph changes nothing and changing one
word is always seen. The client never sends a fingerprint; the server stamps
it, and Hebrew that has not changed since the last save keeps the one it
had.

Stale Hebrew stays live. A slightly old Hebrew sentence serves a Hebrew
reader better than the English, so staleness is shown to the owner, not the
reader.

## Where the owner sees it

- **A Translations page** lists everything with Hebrew missing, stale or in
  a draft, in the order readers meet it, with a link straight to the field.
- **The note editor** puts each Hebrew field beside its English, with a
  status pill. A stale body offers a diff of what changed in the English
  since the Hebrew was written, and a "Hebrew still correct" button.
- **Publishing one language.** Once a note is live, the English and the
  Hebrew can each be published alone, and the other stays as it is.

## What search engines are told

A Hebrew page with real Hebrew is indexed and paired with its English one
through `hreflang`. A Hebrew page that would only show the English fallback
is marked `noindex, follow` and left out of the sitemap. The admin's
"missing" and a search engine's "not indexed" are the same fact, computed in
one place.
