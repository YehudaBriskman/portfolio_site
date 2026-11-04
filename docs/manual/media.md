# Media

Pictures, icons and videos live in the media library at `/admin/media`.

## Where it is stored

In CouchDB, next to everything else: each media item is a document holding its
metadata, with the cleaned original and every generated variant as
attachments. There is no separate object store or disk volume to back up.
The code is in `backend/src/services/media.ts` and `mediaImage.ts`.

## Kinds

| Kind | What the library makes of an upload |
|---|---|
| `image` | responsive sizes in AVIF and WebP |
| `icon` | SVG or PNG, cleaned and served as itself (64 KB at most) |
| `video` | MP4 or WebM, served with range requests, plus a poster image and optional captions per language |

The upload limit is 10 MB per file (`MEDIA_MAX_BYTES`), tighter for icons.

## In the library

- Upload, filter by kind, and open an item for its details.
- Alt text per language, and captions per language for video. A translation
  pill shows whether the Hebrew is there, missing or stale.
- Pick an item from the project and story editors instead of pasting a URL.

## URLs

| URL | Serves |
|---|---|
| `/api/images/media/<id>` | the stable address: redirects to the current file |
| `/api/images/m/<id>/w<width>-<hash>.<avif\|webp>` | one image size, or a video's poster |
| `/api/images/m/<id>/video-<hash>.<mp4\|webm>` | the video |
| `/api/images/m/<id>/captions-<hash>.vtt` | captions |

File names carry a content hash, so they can be cached forever; link to the
stable `/api/images/media/<id>` address when you want "whatever is current".

## Importing the repository's pictures

`backend/scripts/import-media.mjs` uploads the project screenshots, the
portrait and the story pictures from `web/public` into the library, then points
the projects and the story at the library copies, saved as drafts:

```bash
node backend/scripts/import-media.mjs           # dry run
node backend/scripts/import-media.mjs --apply   # uploads and relinks
```

It never publishes and never deletes. It needs the API's base URL and an admin
credential in its environment.

Screenshots of the library: [`docs/media-library/`](../media-library/).
