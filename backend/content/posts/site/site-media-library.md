---
{
  "slug": "site-media-library",
  "title": "A media library in the database the site already had",
  "subtitle": "Pictures, icons and short videos as CouchDB attachments, cleaned on upload and served in AVIF and WebP",
  "excerpt": "The site gained a media library without an object store or a new volume: each item is one CouchDB document with its variants attached, its metadata stripped, and immutable URLs.",
  "tags": ["site", "media", "couchdb", "performance"],
  "collection": "site",
  "status": "published",
  "publishedAt": "2026-11-03T09:33:55Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "PR #270, the media library", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/270" }
  ],
  "sources": [
    { "label": "PR #270, the media library", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/270" },
    { "label": "PR #329, alt text and captions per language", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/329" }
  ]
}
---
Once the site's content moved into the store, its pictures needed somewhere
to live too. Project screenshots and the portrait were static files in the
repository, so changing one still meant a release. The media library is
where they live now: uploaded and described in the admin, and picked from
any editor that takes an image.

## Storage: attachments, not an object store

Each item is one CouchDB document. The cleaned original and every variant
hang off it as attachments.

- **Why.** It is the database the API already has, so there is no object
  store, no new volume and no second backup path. A single multipart write
  stores the metadata and all the files together, so a half-written item
  cannot exist. The library is tens of items, about a megabyte per picture
  with its variants.
- **The cost.** The backup has to ask for attachments explicitly. A library
  in the gigabytes would want an object store, and nothing blocks moving the
  bytes later, because every address goes through the API.

## What each kind does

- **Pictures** (JPEG, PNG, WebP, AVIF or a sanitised SVG, up to 10 MB). EXIF
  and GPS data are stripped on upload. Each picture is served as AVIF and
  WebP at four widths, so a card gets a file the size it needs. An SVG is
  only ever served rasterised.
- **Icons** (an allowlisted SVG or a PNG, up to 64 KB). Kept as drawn. An icon
  in one colour is drawn in the text colour, so it follows the theme.
- **Videos** (MP4 or WebM, up to 25 MB and 60 seconds). Metadata is voided
  in place, a poster is required, and captions are optional.

Files are served at content-hashed addresses and cached as immutable for a
year. Alt text is required before an upload is sent.

## No ffmpeg

Cleaning video metadata is usually a job for ffmpeg. Here it would have
added over 100 MB to the arm64 image, and a large vulnerability surface, to
make one thumbnail. Instead, the container checks and the metadata cleaning
are a small TypeScript parser, and the poster is uploaded by hand. The tests
clean real files that carry GPS and title tags, and check that the results
still decode.

## Safe to delete

A usage index scans every content document, so a field added later is
covered without a list to maintain. An item cannot be deleted while anything
uses it, and the admin links to the exact field that holds the reference.

## In Hebrew too

In 1.2, an item's alt text and caption gained a Hebrew version beside the
English, and a video can carry a caption track per language. The page's
language decides which track plays by default.
