import { randomBytes } from "node:crypto";
import { z } from "zod";
import { couch, CouchError } from "../db/couch.js";
import { attachments } from "../db/attachments.js";
import { env } from "../env.js";
import {
  EXT,
  MIME,
  VARIANT_FORMATS,
  type MediaFormat,
  type MediaKind,
  type Processed,
  type Variant,
  type VariantFormat,
} from "./mediaImage.js";

/*
 * The media library (#253): one CouchDB document per picture, holding its
 * metadata and, as attachments, the cleaned original and every variant.
 *
 * WHY COUCHDB ATTACHMENTS AND NOT A PVC
 *
 * The cluster is one k3s node, and both options end on the same local-path
 * disk, so neither is more durable than the other. What differs is what
 * else has to exist for them to be safe:
 *   - The nightly backup CronJob (oci-free k8s/backup-cronjob.yaml) already
 *     dumps every CouchDB database. Attachments ride along once that dump
 *     asks for them (`attachments=true`, listed in the PR as the owner's one
 *     manifest change). A PVC would need a second volume on the api pod and
 *     a second backup job to copy it.
 *   - The api Deployment is stateless today: any replica, any rollout, no
 *     volume. A ReadWriteOnce claim would pin it, and on a rolling update the
 *     new pod and the old one would both want the claim.
 *   - A metadata change and the bytes it describes land in one revision
 *     (db/attachments.ts writes them in a single multipart PUT), so there is
 *     no state in which the document names a variant the disk does not have.
 *     Two stores — documents in CouchDB, files on a volume — would need
 *     their own reconciliation.
 * The cost is CouchDB serving bytes it was not tuned for. At this site's
 * scale (tens of pictures, a few hundred KB of variants each) that is
 * nothing, the variant URLs are immutable so a browser asks once, and the
 * originals are never served at all.
 *
 * URLS
 *
 *   /api/images/media/<id>                         stable; 302 to the current file
 *   /api/images/m/<id>/w<width>-<hash>.<avif|webp>  an image size, or a video's poster
 *   /api/images/m/<id>/icon-<hash>.<svg|png>        an icon, as uploaded
 *   /api/images/m/<id>/video-<hash>.<mp4|webm>      a video, with Range
 *   /api/images/m/<id>/captions-<hash>.vtt          a video's captions
 * Every hashed URL is immutable for a year.
 *
 * Content stores the stable URL (an editor's cover image, say), so replacing
 * a picture never leaves a reference pointing at bytes that are gone. The
 * hashed URL is what a browser caches forever.
 *
 * KINDS. An item is an `image` (photos and drawings: served only as raster
 * variants), an `icon` (a sanitised SVG or a small PNG, served as the file
 * it is) or a `video` (MP4 or WebM up to a minute, with a poster the owner
 * uploads and optional captions). `format` says what the bytes are.
 */

export type MediaDoc = {
  _id: string;
  _rev?: string;
  type: "media";
  id: string;
  name: string;
  alt: string;
  caption: string;
  credit: string;
  kind: MediaKind;
  format: MediaFormat;
  width: number;
  height: number;
  bytes: number;
  hash: string;
  original: string;
  variants: Variant[];
  monochrome?: boolean;
  durationMs?: number;
  codecs?: string[];
  hasAudio?: boolean;
  captions?: CaptionsTrack | null;
  /* Captions in other languages (#306), one track per language, beside `captions`. */
  moreCaptions?: CaptionsTrack[];
  /*
   * The Hebrew alt text and caption (#306), the note's shape (#303): words in
   * `he`, and in `heMeta.src` the fingerprint of the English each was written
   * against, so a changed English alt reads as stale. `alt` and `caption`
   * stay the English strings every existing reader expects.
   */
  he?: { alt?: string; caption?: string } | null;
  heMeta?: { src: Record<string, string> } | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  _attachments?: Record<string, unknown>;
};

export type CaptionsTrack = { name: string; hash: string; lang: string; label: string; bytes: number };

/** Every captions track of a video, its first one first. */
export const captionTracks = (doc: Pick<MediaDoc, "captions" | "moreCaptions">): CaptionsTrack[] =>
  [doc.captions, ...(doc.moreCaptions ?? [])].filter((t): t is CaptionsTrack => Boolean(t));

export const trackUrl = (id: string, t: Pick<CaptionsTrack, "hash">) => `/api/images/m/${id}/captions-${t.hash}.vtt`;

/** The Hebrew a media item's alt and caption can have (#306). */
export const MEDIA_HE_FIELDS = ["alt", "caption"] as const;

export type Usage = { id: string; type: string; title: string; slug: string | null; field: string };

export const MediaMeta = z.object({
  alt: z.string().trim().min(1, "Alt text is required.").max(300),
  caption: z.string().trim().max(500).default(""),
  credit: z.string().trim().max(200).default(""),
  /* The Hebrew alt and caption (#306); empty means the English is read. */
  he: z
    .object({ alt: z.string().trim().max(300).default(""), caption: z.string().trim().max(500).default("") })
    .nullable()
    .optional(),
});

export const MEDIA_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const mediaDocId = (id: string) => `media:${id}`;

/** A readable, unguessable-enough id from the file name: `icaros-3f9a2c`. */
export function newMediaId(fileName: string): string {
  const stem = fileName
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `${stem || "image"}-${randomBytes(3).toString("hex")}`;
}

export function cleanName(fileName: string | undefined): string {
  const n = (fileName ?? "").split(/[\\/]/).pop() ?? "";
  return n.replace(/[^\w.\- ]+/g, "").trim().slice(0, 120) || "image";
}

export const stableUrl = (id: string) => `/api/images/media/${id}`;
export const variantUrl = (id: string, v: Pick<Variant, "width" | "hash" | "format">) =>
  `/api/images/m/${id}/w${v.width}-${v.hash}.${v.format}`;
/** An icon's or a video's own file; null for an image, whose original is never served. */
export const fileUrl = (doc: Pick<MediaDoc, "id" | "kind" | "hash" | "format">) =>
  doc.kind === "image" ? null : `/api/images/m/${doc.id}/${doc.kind}-${doc.hash}.${EXT[doc.format]}`;
export const captionsUrl = (doc: Pick<MediaDoc, "id" | "captions">) =>
  doc.captions ? `/api/images/m/${doc.id}/captions-${doc.captions.hash}.vtt` : null;

/** What the admin UI and the MCP tools see: no attachment stubs, URLs resolved. */
export function publicMedia(doc: MediaDoc, usage?: Usage[]) {
  const site = env.SITE_URL;
  const widest = (f: VariantFormat) =>
    doc.variants.filter((v) => v.format === f).sort((a, b) => b.width - a.width)[0];
  const preview = doc.variants.filter((v) => v.format === "webp").sort((a, b) => a.width - b.width)[0];
  const file = fileUrl(doc);
  return {
    id: doc.id,
    _rev: doc._rev,
    name: doc.name,
    alt: doc.alt,
    caption: doc.caption,
    credit: doc.credit,
    kind: doc.kind,
    format: doc.format,
    mime: MIME[doc.format],
    width: doc.width,
    height: doc.height,
    bytes: doc.bytes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    /* Absolute, on the public origin: content fields are validated as URLs. */
    url: `${site}${stableUrl(doc.id)}`,
    /* A small picture of it: an image's smallest size, a video's poster, an icon itself. */
    preview: preview ? variantUrl(doc.id, preview) : file,
    /* Same-origin paths, so the page's own CSP (img-src, media-src 'self') covers them. */
    file,
    monochrome: doc.kind === "icon" ? Boolean(doc.monochrome) : undefined,
    durationMs: doc.durationMs,
    hasAudio: doc.hasAudio,
    captions: doc.captions ? { url: captionsUrl(doc)!, lang: doc.captions.lang, label: doc.captions.label } : null,
    /* Every captions track, one per language (#306). */
    tracks: captionTracks(doc).map((t) => ({ url: trackUrl(doc.id, t), lang: t.lang, label: t.label })),
    /* The Hebrew words only; the fingerprints are the server's. */
    he: doc.he && (doc.he.alt || doc.he.caption) ? { alt: doc.he.alt ?? "", caption: doc.he.caption ?? "" } : null,
    srcset: Object.fromEntries(
      VARIANT_FORMATS.map((f) => [
        f,
        doc.variants
          .filter((v) => v.format === f)
          .sort((a, b) => a.width - b.width)
          .map((v) => `${variantUrl(doc.id, v)} ${v.width}w`)
          .join(", "),
      ]),
    ) as Record<VariantFormat, string>,
    largest: Object.fromEntries(VARIANT_FORMATS.map((f) => [f, widest(f) ? variantUrl(doc.id, widest(f)) : null])),
    ...(usage ? { usedBy: usage } : {}),
  };
}

export function buildDoc(input: {
  id: string;
  name: string;
  meta: z.infer<typeof MediaMeta>;
  processed: Processed;
  by: string;
  now: Date;
  existing?: MediaDoc | null;
}): MediaDoc {
  const { processed: p, existing } = input;
  const now = input.now.toISOString();
  return {
    _id: mediaDocId(input.id),
    ...(existing?._rev ? { _rev: existing._rev } : {}),
    type: "media",
    id: input.id,
    name: input.name,
    alt: input.meta.alt,
    caption: input.meta.caption,
    credit: input.meta.credit,
    kind: p.kind,
    format: p.format,
    width: p.width,
    height: p.height,
    bytes: p.original.data.length,
    hash: p.original.hash,
    original: p.original.name,
    variants: p.variants.map(({ data: _data, ...v }) => v),
    ...(p.kind === "icon" ? { monochrome: Boolean(p.monochrome) } : {}),
    ...(p.kind === "video"
      ? {
          durationMs: p.durationMs,
          codecs: p.codecs,
          hasAudio: p.hasAudio,
          captions: p.captions
            ? { name: p.captions.name, hash: p.captions.hash, lang: p.captions.lang, label: p.captions.label, bytes: p.captions.data.length }
            : null,
          /* A replaced video keeps its tracks in other languages; they are its own files. */
          ...(existing?.moreCaptions?.length ? { moreCaptions: existing.moreCaptions.filter((t) => t.lang !== p.captions?.lang) } : {}),
        }
      : {}),
    ...(existing?.he ? { he: existing.he, heMeta: existing.heMeta ?? null } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    createdBy: existing?.createdBy ?? input.by,
  };
}

export const filesOf = (p: Processed) => [
  { name: p.original.name, contentType: p.original.contentType, data: p.original.data },
  ...p.variants.map((v) => ({ name: v.name, contentType: MIME[v.format], data: v.data })),
  ...(p.captions ? [{ name: p.captions.name, contentType: p.captions.contentType, data: p.captions.data }] : []),
];

/* ---------------------------------------------------------------- store -- */

export const mediaStore = {
  async get(id: string): Promise<MediaDoc | null> {
    try {
      const doc = await couch.get<MediaDoc>(mediaDocId(id));
      return doc.type === "media" ? doc : null;
    } catch (e) {
      if (e instanceof CouchError && e.status === 404) return null;
      throw e;
    }
  },
  async list(): Promise<MediaDoc[]> {
    // Page by bookmark: a single capped _find silently dropped everything past the cap.
    const all: MediaDoc[] = [];
    let bookmark: string | undefined;
    for (;;) {
      const page = (await couch.find<MediaDoc>({ selector: { type: "media" }, limit: 500, bookmark })) as {
        docs: MediaDoc[];
        bookmark?: string;
      };
      all.push(...page.docs);
      if (page.docs.length < 500 || !page.bookmark) return all;
      bookmark = page.bookmark;
    }
  },
  async save(doc: MediaDoc, files: ReturnType<typeof filesOf>): Promise<MediaDoc> {
    const { _attachments: _old, ...plain } = doc;
    const { rev } = await attachments.putWith(doc._id, plain, files);
    return { ...plain, _rev: rev };
  },
  /* Metadata only: the attachment stubs go back as they came, so CouchDB keeps the bytes. */
  async saveMeta(doc: MediaDoc): Promise<MediaDoc> {
    const r = await couch.put<{ rev: string }>(doc._id, doc);
    return { ...doc, _rev: r.rev };
  },
  /*
   * One captions track added or replaced on a stored item (#306), as ONE
   * write: the file goes inline (base64; a VTT is small) beside the existing
   * attachment stubs and the new metadata, on the revision the caller read, so
   * the bytes and the hash that names them can never be saved apart, and a
   * concurrent edit is a 409 rather than a lost update.
   */
  async putTrack(doc: MediaDoc, file: { name: string; contentType: string; data: Buffer }, update: (fresh: MediaDoc) => MediaDoc): Promise<MediaDoc> {
    const next = update(doc);
    const stubs = { ...(doc._attachments ?? {}) };
    const sent = { ...next, _attachments: { ...stubs, [file.name]: { content_type: file.contentType, data: file.data.toString("base64") } } };
    const r = await couch.put<{ rev: string }>(doc._id, sent);
    return { ...next, _attachments: { ...stubs, [file.name]: { content_type: file.contentType, length: file.data.length, stub: true } }, _rev: r.rev };
  },
  remove: (doc: MediaDoc) => attachments.remove(doc._id, doc._rev ?? ""),
  file: (id: string, name: string) => attachments.get(mediaDocId(id), name),
  /** Bytes start..end (inclusive) of a large attachment, streamed rather than held. */
  range: (id: string, name: string, start: number, end: number) => attachments.range(mediaDocId(id), name, start, end),

  /*
   * Every content document that mentions a media id. Deliberately a scan of
   * the documents' JSON rather than a list of known fields: the editors that
   * exist today keep a picture in `coverImage`, a post can also put one in its
   * markdown body, and the content moving into the store under #163 (projects,
   * the story) will hold its own fields — a field list would be out of date
   * the day one is added. The store is small (hundreds of documents), and this
   * runs only on admin reads and on delete.
   */
  async referrers(): Promise<Array<{ _id: string; type?: string; title?: string; slug?: string; key?: string; json: string }>> {
    const { docs } = await couch.find<Record<string, unknown>>({
      selector: { type: { $nin: ["media", "audit", "apitoken"] } },
      limit: 5000,
    });
    return docs.map((d) => ({
      _id: String(d._id),
      type: typeof d.type === "string" ? d.type : undefined,
      title: typeof d.title === "string" ? d.title : undefined,
      slug: typeof d.slug === "string" ? d.slug : undefined,
      key: typeof d.key === "string" ? d.key : undefined,
      json: JSON.stringify(d),
    }));
  },
};

/*
 * Where in a document the reference sits, as a dotted path to the string that
 * holds it: `coverImage` on a post, `published.items.2.image` on the projects
 * (#163). Precise enough for the owner to find the field to change.
 */
function fieldOf(json: string, needle: string): string {
  const walk = (v: unknown, path: string[]): string[] | null => {
    if (typeof v === "string") return v.includes(needle) ? path : null;
    if (v && typeof v === "object") {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        const hit = walk(child, [...path, k]);
        if (hit) return hit;
      }
    }
    return null;
  };
  try {
    return walk(JSON.parse(json) as unknown, [])?.join(".") ?? "";
  } catch {
    return "";
  }
}

/* The site's content documents (#163) are one per key, named for the editor that owns it. */
const CONTENT_TITLE: Record<string, string> = { projects: "Projects", story: "Story", "site-copy": "Site copy" };

/** id → the documents that reference it, from one scan. */
export function usageIndex(
  ids: string[],
  referrers: Awaited<ReturnType<typeof mediaStore.referrers>>,
): Map<string, Usage[]> {
  const out = new Map<string, Usage[]>(ids.map((id) => [id, []]));
  for (const r of referrers) {
    for (const id of ids) {
      // The stable URL and the hashed one both carry `/<id>` followed by a non-id character.
      const hit = [`/api/images/media/${id}`, `/api/images/m/${id}/`].find((n) => {
        let at = r.json.indexOf(n);
        while (at !== -1) {
          const next = r.json[at + n.length];
          if (n.endsWith("/") || next === undefined || !/[a-z0-9-]/.test(next)) return true;
          at = r.json.indexOf(n, at + 1);
        }
        return false;
      });
      if (hit) {
        const key = r.type === "content" ? r.key : undefined;
        out.get(id)!.push({
          id: r._id,
          type: r.type ?? r._id.split(":")[0],
          title: r.title ?? (key ? (CONTENT_TITLE[key] ?? key) : undefined) ?? r.slug ?? r._id,
          slug: r.slug ?? key ?? null,
          field: fieldOf(r.json, hit),
        });
      }
    }
  }
  return out;
}
