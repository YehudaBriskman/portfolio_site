import { z } from "zod";
import { invalidateTranslations } from "@/services/translations";
import { ltrValue } from "@/i18n/words";

/*
 * The media library's admin API (#253). Same origin as the rest of the admin
 * (the gated admin host), same error envelope, same "not-authorised" signal.
 */

const UsageSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  slug: z.string().nullable(),
  field: z.string(),
});

const MediaSchema = z.object({
  id: z.string(),
  _rev: z.string().optional(),
  name: z.string(),
  alt: z.string(),
  caption: z.string(),
  credit: z.string(),
  kind: z.enum(["image", "icon", "video"]),
  format: z.enum(["jpeg", "png", "webp", "avif", "svg", "mp4", "webm"]),
  mime: z.string(),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  url: z.string(),
  preview: z.string().nullable(),
  /* An icon's or a video's own file, same-origin; null for an image. */
  file: z.string().nullable(),
  monochrome: z.boolean().optional(),
  durationMs: z.number().optional(),
  hasAudio: z.boolean().optional(),
  captions: z.object({ url: z.string(), lang: z.string(), label: z.string() }).nullable().optional(),
  /* Every captions track, one per language (#306). */
  tracks: z.array(z.object({ url: z.string(), lang: z.string(), label: z.string() })).optional(),
  /* The Hebrew alt and caption (#306); null when there is none. */
  he: z.object({ alt: z.string(), caption: z.string() }).nullable().optional(),
  srcset: z.object({ avif: z.string(), webp: z.string() }),
  /* An image's widest size; a video's widest poster. */
  largest: z.object({ avif: z.string().nullable(), webp: z.string().nullable() }).optional(),
  usedBy: z.array(UsageSchema).optional(),
});

export type MediaItem = z.infer<typeof MediaSchema>;

/*
 * What may go into a media element's src. Only two things ever should: the
 * library's own /api/images/ path (relative, or absolute on http(s)), or a
 * blob: URL this page made from a file the owner picked. Anything else, such
 * as javascript:, data: or another path, is dropped before it reaches an
 * attribute.
 *
 * Neither pattern admits `%` or any character encodeURI would change, so the
 * encodeURI() on the way out leaves an accepted URL exactly as it was; it is
 * there so the value is visibly URL-encoded wherever it is used.
 */
const LIBRARY_SRC = /^(?:https?:\/\/[\w.:-]+)?\/api\/images\/[\w./?&=-]*$/;
const BLOB_SRC = /^blob:(?:https?:\/\/[\w.:-]+|null)\/[\w-]+$/;

export function librarySrc(url: string | null | undefined): string | undefined {
  return typeof url === "string" && LIBRARY_SRC.test(url) ? encodeURI(url) : undefined;
}

export function blobSrc(url: string | null | undefined): string | undefined {
  return typeof url === "string" && BLOB_SRC.test(url) ? encodeURI(url) : undefined;
}
export type MediaUsage = z.infer<typeof UsageSchema>;
export type MediaKind = MediaItem["kind"];
export const MEDIA_KINDS: readonly MediaKind[] = ["image", "icon", "video"];

/* Mirrors the server's checks, so the obvious refusals happen before a large upload. */
const MB = 1024 * 1024;
export const LIMITS: Record<MediaKind | "poster" | "captions", { bytes: number; accept: string; says: string }> = {
  image: { bytes: 10 * MB, accept: "image/jpeg,image/png,image/webp,image/avif,image/svg+xml", says: "a JPEG, PNG, WebP, AVIF or SVG image" },
  icon: { bytes: 64 * 1024, accept: "image/svg+xml,image/png", says: "an SVG or PNG icon" },
  video: { bytes: 25 * MB, accept: "video/mp4,video/webm", says: "an MP4 or WebM video" },
  poster: { bytes: 5 * MB, accept: "image/jpeg,image/png,image/webp,image/avif", says: "a JPEG, PNG, WebP or AVIF poster" },
  captions: { bytes: 200 * 1024, accept: ".vtt,text/vtt", says: "a WebVTT (.vtt) captions file" },
};
export const MEDIA_MAX_BYTES = LIMITS.image.bytes;
export const MEDIA_ACCEPT = LIMITS.image.accept;

export function checkFile(file: File, kind: keyof typeof LIMITS = "image"): string | null {
  const rule = LIMITS[kind];
  const typed = kind === "captions" ? /\.vtt$/i.test(file.name) || file.type === "text/vtt" : rule.accept.split(",").includes(file.type);
  if (!typed) return `${file.name} is not ${rule.says}.`;
  if (file.size > rule.bytes) return `${file.name} is ${formatBytes(file.size)}; the limit is ${formatBytes(rule.bytes)}.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

/** A video's companions: the poster it must have, the captions it may. */
export type VideoParts = { poster: File; captions?: File | null; captionsLang?: string; captionsLabel?: string };

function uploadInit(file: File, kind: MediaKind, video?: VideoParts): { qs: Record<string, string>; init: RequestInit } {
  if (kind !== "video") {
    return {
      qs: { kind },
      init: { headers: { "Content-Type": file.type || "application/octet-stream" }, body: file },
    };
  }
  if (!video?.poster) throw new Error("A video needs a poster image.");
  const form = new FormData();
  form.append("file", file);
  form.append("poster", video.poster);
  if (video.captions) form.append("captions", video.captions);
  const qs: Record<string, string> = { kind };
  if (video.captions && video.captionsLang) qs.captionsLang = video.captionsLang;
  if (video.captions && video.captionsLabel) qs.captionsLabel = video.captionsLabel;
  // No Content-Type: the browser writes multipart/form-data with its boundary.
  return { qs, init: { body: form } };
}

export class MediaInUseError extends Error {
  constructor(
    message: string,
    readonly usedBy: MediaUsage[],
  ) {
    super(message);
    this.name = "MediaInUseError";
  }
}

const ErrorBody = z.object({ error: z.string().optional(), usedBy: z.array(UsageSchema).optional() });

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/media${path}`, init);
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new Error("The admin API did not respond. It may be restarting.");
  }
  if (res.status === 401 || res.status === 403) throw new Error("not-authorised");
  if (!res.ok) {
    const e = ErrorBody.safeParse(body);
    const message = e.success && e.data.error ? e.data.error : `Request failed (${res.status})`;
    if (e.success && e.data.usedBy?.length) throw new MediaInUseError(message, e.data.usedBy);
    throw new Error(message);
  }
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type MediaMeta = { alt: string; caption: string; credit: string };
/** What the details form saves: the English, and the Hebrew beside it (#306). */
export type MediaDetails = MediaMeta & { he: { alt: string; caption: string } | null };

/** A track's language, as the captions list names it. */
export const TRACK_LANGS = [
  { lang: "en", label: "English" },
  { lang: "he", label: "עברית" },
] as const;

export const media = {
  list: async (q = "") => {
    const r = await call<{ items: unknown[] }>(q ? `?q=${encodeURIComponent(q)}` : "");
    return z.array(MediaSchema).parse(r.items);
  },
  upload: async (file: File, meta: MediaMeta, kind: MediaKind = "image", video?: VideoParts) => {
    const { qs, init } = uploadInit(file, kind, video);
    const params = new URLSearchParams({ ...meta, filename: file.name, ...qs });
    const r = await call<{ item: unknown }>(`?${params}`, { method: "POST", ...init });
    return MediaSchema.parse(r.item);
  },
  update: async (item: MediaItem, meta: MediaMeta | MediaDetails) => {
    const r = await call<{ item: unknown }>(`/${item.id}`, json("PUT", { ...meta, _rev: item._rev }));
    invalidateTranslations();
    return MediaSchema.parse(r.item);
  },
  /** A video's captions in one language, added or replaced (#306). */
  putCaptions: async (item: MediaItem, lang: string, file: File) => {
    const params = new URLSearchParams({ rev: item._rev ?? "" });
    const r = await call<{ item: unknown }>(`/${item.id}/captions/${encodeURIComponent(lang)}?${params}`, {
      method: "PUT",
      headers: { "Content-Type": "text/vtt" },
      body: file,
    });
    return MediaSchema.parse(r.item);
  },
  removeCaptions: async (item: MediaItem, lang: string) => {
    const params = new URLSearchParams({ rev: item._rev ?? "" });
    const r = await call<{ item: unknown }>(`/${item.id}/captions/${encodeURIComponent(lang)}?${params}`, { method: "DELETE" });
    return MediaSchema.parse(r.item);
  },
  replace: async (item: MediaItem, file: File, video?: VideoParts) => {
    const { qs, init } = uploadInit(file, item.kind, video);
    delete qs.kind; // the server keeps the item's kind
    const params = new URLSearchParams({ rev: item._rev ?? "", filename: file.name, ...qs });
    const r = await call<{ item: unknown }>(`/${item.id}/file?${params}`, { method: "PUT", ...init });
    return MediaSchema.parse(r.item);
  },
  remove: async (item: MediaItem) => {
    await call<{ ok: true }>(`/${item.id}?rev=${encodeURIComponent(item._rev ?? "")}`, { method: "DELETE" });
  },
};

/** Whether a content field's URL is a library picture, and which. */
export function mediaIdOf(url: string): string | null {
  return /\/api\/images\/(?:media|m)\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:[/?#]|$)/.exec(url)?.[1] ?? null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return ltrValue(`${n} B`);
  if (n < 1024 * 1024) return ltrValue(`${Math.round(n / 1024)} KB`);
  return ltrValue(`${(n / 1048576).toFixed(1).replace(/\.0$/, "")} MB`);
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const KIND_LABEL: Record<MediaKind, { one: string; many: string }> = {
  image: { one: "Picture", many: "Pictures" },
  icon: { one: "Icon", many: "Icons" },
  video: { one: "Video", many: "Videos" },
};

/** The library is small, so search is a filter over what is already loaded. */
export function filterMedia(items: MediaItem[], q: string, kinds?: readonly MediaKind[] | null): MediaItem[] {
  const needle = q.trim().toLowerCase();
  return items.filter(
    (m) =>
      (!kinds || kinds.includes(m.kind)) &&
      (!needle || [m.alt, m.caption, m.credit, m.name, m.id].some((s) => s.toLowerCase().includes(needle))),
  );
}
