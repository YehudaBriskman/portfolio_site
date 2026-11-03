import express, { Router, type Request, type Response } from "express";
import { z } from "zod";
import { CouchError } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  ICON_MAX_BYTES,
  MEDIA_KINDS,
  MEDIA_MAX_BYTES,
  MediaRejected,
  processIcon,
  processUpload,
  type MediaKind,
  type Processed,
} from "../services/mediaImage.js";
import { VIDEO_MAX_BYTES, VIDEO_UPLOAD_MAX_BYTES, processVideo, sniffVideo } from "../services/mediaVideo.js";
import {
  MEDIA_ID,
  MediaMeta,
  buildDoc,
  cleanName,
  filesOf,
  mediaStore,
  newMediaId,
  publicMedia,
  usageIndex,
  type MediaDoc,
} from "../services/media.js";

/*
 * The media library's admin API (#253), mounted at /api/admin/media behind
 * the same gate, limiter and audit log as every other admin route. A read
 * token may list; uploading, editing and deleting need a write token or the
 * signed-in session (requireAdmin enforces that by method).
 *
 * An image or an icon is uploaded as the raw bytes of the request body, with
 * the metadata in the query string: the browser's `fetch(url, { body: file })`
 * sends exactly that. A video is three files — the video, its poster, and
 * optional captions — so it goes as multipart/form-data, read by the
 * runtime's own `Request.formData()`: still no parser in the dependency tree.
 * The metadata stays in the query either way, and the audit log records the
 * path without it.
 *
 *   GET    /                 ?q=&kind=   list, with each item's usage
 *   GET    /:id                          one, with its usage
 *   POST   /                 ?kind=image|icon|video&alt=&caption=&credit=&filename=
 *                            [&captionsLang=&captionsLabel=]   upload
 *   PUT    /:id                          metadata: { alt, caption, credit, _rev }
 *   PUT    /:id/file         ?rev=       replace the file, keep the id and kind
 *   DELETE /:id              ?rev=       only when nothing uses it
 */
const router = Router();

/*
 * express.json() upstream ignores these: it only parses application/json. The
 * ceiling is a video's (with its poster and captions); each kind's own, much
 * smaller, limit is checked on the bytes.
 */
const rawUpload = express.raw({ type: () => true, limit: VIDEO_UPLOAD_MAX_BYTES });

const Lang = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, "A language tag, like en or he.");
const CaptionsQuery = z.object({
  captionsLang: Lang.optional(),
  captionsLabel: z.string().trim().min(1).max(60).optional(),
});
const UploadQuery = MediaMeta.extend({
  filename: z.string().max(200).optional(),
  kind: z.enum(MEDIA_KINDS).default("image"),
}).merge(CaptionsQuery);

async function readForm(req: Request): Promise<FormData> {
  const buf = bodyBytes(req);
  try {
    return await new Request("http://upload.invalid/", {
      method: "POST",
      headers: { "content-type": req.header("content-type") ?? "" },
      body: new Uint8Array(buf.buffer, buf.byteOffset, buf.length),
    }).formData();
  } catch {
    throw new MediaRejected(400, "The upload form could not be read.");
  }
}

async function part(form: FormData, name: string): Promise<Buffer | null> {
  const v = form.get(name);
  if (v === null || typeof v === "string") return null;
  return Buffer.from(await v.arrayBuffer());
}

/** The bytes of an upload, checked and processed by the rules of its kind. */
async function processBody(
  req: Request,
  kind: MediaKind,
  captions: { lang: string; label: string },
): Promise<Processed> {
  if (kind === "video") {
    if (!/^multipart\/form-data/i.test(req.header("content-type") ?? "")) {
      throw new MediaRejected(400, "Send a video as multipart/form-data: `file`, `poster`, and optionally `captions`.");
    }
    const form = await readForm(req);
    const video = await part(form, "file");
    if (!video) throw new MediaRejected(400, "The video file is missing.");
    const vtt = await part(form, "captions");
    return processVideo(video, await part(form, "poster"), vtt ? { data: vtt, ...captions } : null);
  }
  const bytes = bodyBytes(req);
  if (sniffVideo(bytes)) throw new MediaRejected(415, "This is a video: upload it as a video, with a poster image.");
  return kind === "icon" ? processIcon(bytes) : processUpload(bytes);
}
const MetaBody = MediaMeta.extend({ _rev: z.string().min(1, "Missing _rev: reload and reapply.") });
const RevQuery = z.object({ rev: z.string().min(1, "Missing rev: reload and reapply.") });
/* Every query value is a single string: `?kind=a&kind=b` (an array) is a 400, not a guess. */
const ListQuery = z.object({
  q: z.string().max(200).optional(),
  kind: z.enum(MEDIA_KINDS).optional(),
});
const ReplaceQuery = RevQuery.merge(CaptionsQuery).extend({ filename: z.string().max(200).optional() });

/*
 * express.raw() leaves a Buffer in req.body; anything else (an array or an
 * object from a parser upstream, a string) is not an upload. Checked as an
 * array first, so a tampered body can never be read as a different type.
 */
function bodyBytes(req: Request): Buffer {
  const body: unknown = req.body;
  if (Array.isArray(body) || typeof body !== "object" || body === null) return Buffer.alloc(0);
  return Buffer.isBuffer(body) ? body : Buffer.alloc(0);
}

function rejected(res: Response, e: unknown) {
  if (e instanceof MediaRejected) return res.status(e.status).json({ ok: false, error: e.message });
  throw e;
}

/* An oversize body is refused by express.raw before the handler; answer it in our words. */
function tooLarge(err: unknown, _req: Request, res: Response, next: (e?: unknown) => void) {
  if ((err as { type?: string } | null)?.type === "entity.too.large") {
    const mb = (n: number) => `${n / 1024 / 1024} MB`;
    return res.status(413).json({
      ok: false,
      error: `Too large. Videos are limited to ${mb(VIDEO_MAX_BYTES)}, images to ${mb(MEDIA_MAX_BYTES)}, icons to ${ICON_MAX_BYTES / 1024} KB.`,
    });
  }
  next(err);
}

const idParam = (req: Request) => {
  const id = req.params.id;
  return MEDIA_ID.test(id) && id.length <= 60 ? id : null;
};

const conflict = (res: Response) =>
  res.status(409).json({ ok: false, error: "This picture changed elsewhere. Reload and reapply." });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = ListQuery.safeParse(req.query);
    if (!query.success) return res.status(400).json({ ok: false, error: "invalid", details: query.error.flatten() });
    const q = (query.data.q ?? "").trim().toLowerCase().slice(0, 100);
    const kind = query.data.kind ?? null;
    const [docs, refs] = await Promise.all([mediaStore.list(), mediaStore.referrers()]);
    const usage = usageIndex(docs.map((d) => d.id), refs);
    const items = docs
      .filter((d) => !kind || d.kind === kind)
      .filter((d) => !q || [d.name, d.alt, d.caption, d.credit, d.id].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((d) => publicMedia(d, usage.get(d.id)));
    res.json({ ok: true, items });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const doc = id ? await mediaStore.get(id) : null;
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    const usage = usageIndex([doc.id], await mediaStore.referrers());
    res.json({ ok: true, item: publicMedia(doc, usage.get(doc.id)) });
  }),
);

router.post(
  "/",
  rawUpload,
  tooLarge,
  asyncHandler(async (req, res) => {
    const parsed = UploadQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    let processed;
    try {
      processed = await processBody(req, parsed.data.kind, {
        lang: parsed.data.captionsLang ?? "en",
        label: parsed.data.captionsLabel ?? "Captions",
      });
    } catch (e) {
      return rejected(res, e);
    }
    const name = cleanName(parsed.data.filename);
    const doc = buildDoc({
      id: newMediaId(name),
      name,
      meta: parsed.data,
      processed,
      by: req.admin!.login,
      now: new Date(),
    });
    const saved = await mediaStore.save(doc, filesOf(processed));
    res.locals.audit = { target: saved._id, before: null, after: saved };
    res.status(201).json({ ok: true, item: publicMedia(saved, []) });
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const parsed = MetaBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    const existing = id ? await mediaStore.get(id) : null;
    if (!existing) return res.status(404).json({ ok: false, error: "Not Found" });
    if (existing._rev !== parsed.data._rev) return conflict(res);
    const next: MediaDoc = {
      ...existing,
      alt: parsed.data.alt,
      caption: parsed.data.caption,
      credit: parsed.data.credit,
      updatedAt: new Date().toISOString(),
    };
    let saved: MediaDoc;
    try {
      saved = await mediaStore.saveMeta(next);
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) return conflict(res);
      throw e;
    }
    res.locals.audit = { target: saved._id, before: existing, after: saved };
    res.json({ ok: true, item: publicMedia(saved) });
  }),
);

router.put(
  "/:id/file",
  rawUpload,
  tooLarge,
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const rev = ReplaceQuery.safeParse(req.query);
    if (!rev.success) return res.status(400).json({ ok: false, error: "invalid", details: rev.error.flatten() });
    const existing = id ? await mediaStore.get(id) : null;
    if (!existing) return res.status(404).json({ ok: false, error: "Not Found" });
    if (existing._rev !== rev.data.rev) return conflict(res);
    let processed;
    try {
      // The same kind as before: an icon stays an icon wherever it is used.
      // A video is replaced whole — video, poster and captions — like it was uploaded.
      processed = await processBody(req, existing.kind, {
        lang: rev.data.captionsLang ?? existing.captions?.lang ?? "en",
        label: rev.data.captionsLabel ?? existing.captions?.label ?? "Captions",
      });
    } catch (e) {
      return rejected(res, e);
    }
    const name = cleanName(rev.data.filename ?? existing.name);
    const doc = buildDoc({
      id: existing.id,
      name,
      meta: { alt: existing.alt, caption: existing.caption, credit: existing.credit },
      processed,
      by: req.admin!.login,
      now: new Date(),
      existing,
    });
    let saved: MediaDoc;
    try {
      saved = await mediaStore.save(doc, filesOf(processed));
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) return conflict(res);
      throw e;
    }
    res.locals.audit = { target: saved._id, before: existing, after: saved };
    res.json({ ok: true, item: publicMedia(saved) });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const existing = id ? await mediaStore.get(id) : null;
    if (!existing) return res.status(404).json({ ok: false, error: "Not Found" });
    const rev = RevQuery.safeParse(req.query);
    if (!rev.success) return res.status(400).json({ ok: false, error: "invalid", details: rev.error.flatten() });
    if (existing._rev !== rev.data.rev) return conflict(res);
    const usedBy = usageIndex([existing.id], await mediaStore.referrers()).get(existing.id) ?? [];
    if (usedBy.length > 0) {
      return res.status(409).json({
        ok: false,
        error: `In use by ${usedBy.length === 1 ? "1 item" : `${usedBy.length} items`}. Remove it from them first.`,
        usedBy,
      });
    }
    try {
      await mediaStore.remove(existing);
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) return conflict(res);
      throw e;
    }
    res.locals.audit = { target: existing._id, before: existing, after: null };
    res.json({ ok: true });
  }),
);

export default router;
