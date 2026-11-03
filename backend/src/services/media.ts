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
  captions?: { name: string; hash: string; lang: string; label: string; bytes: number } | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  _attachments?: Record<string, unknown>;
};

export type Usage = { id: string; type: string; title: string; slug: string | null; field: string };

export const MediaMeta = z.object({
  alt: z.string().trim().min(1, "Alt text is required.").max(300),
  caption: z.string().trim().max(500).default(""),
  credit: z.string().trim().max(200).default(""),
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
  const site = env.SITE_URL.replace(/\/+$/, "");
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
        }
      : {}),
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
    const { docs } = await couch.find<MediaDoc>({ selector: { type: "media" }, limit: 2000 });
    return docs;
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
  async referrers(): Promise<Array<{ _id: string; type?: string; title?: string; slug?: string; json: string }>> {
    const { docs } = await couch.find<Record<string, unknown>>({
      selector: { type: { $nin: ["media", "audit", "apitoken"] } },
      limit: 5000,
    });
    return docs.map((d) => ({
      _id: String(d._id),
      type: typeof d.type === "string" ? d.type : undefined,
      title: typeof d.title === "string" ? d.title : undefined,
      slug: typeof d.slug === "string" ? d.slug : undefined,
      json: JSON.stringify(d),
    }));
  },
};

function fieldOf(json: string, needle: string): string {
  try {
    const doc = JSON.parse(json) as Record<string, unknown>;
    for (const [k, v] of Object.entries(doc)) if (JSON.stringify(v).includes(needle)) return k;
  } catch {
    /* fall through */
  }
  return "";
}

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
        out.get(id)!.push({
          id: r._id,
          type: r.type ?? r._id.split(":")[0],
          title: r.title ?? r.slug ?? r._id,
          slug: r.slug ?? null,
          field: fieldOf(r.json, hit),
        });
      }
    }
  }
  return out;
}
