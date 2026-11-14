import { Router, type Response } from "express";
import { CouchError, couch } from "../db/couch.js";
import { attachments, type NewAttachment } from "../db/attachments.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { toIssues, type Issue } from "../schemas/site-content.js";
import { SignatureRejected, renderRaster, renderVector, type Rendered } from "./render.js";
import { sanitizeSignatureSvg } from "./sanitize.js";
import {
  DEFAULT_SHOW,
  SHOW_ID,
  SIG_LANGS,
  ShowBody,
  SigLangParam,
  SlotBody,
  slotAudit,
  slotId,
  slotView,
  urlsOf,
  type SigLang,
  type SigShow,
  type SigShowDoc,
  type SigSlotDoc,
} from "./schemas.js";
import { strokesToSvg } from "./strokes.js";

/*
 * The owner's signature image, one per language, under /api/admin/signature
 * (behind requireAdmin and audited like the rest of /api/admin), and a public
 * face that serves ONLY the rendered files:
 *
 *   GET  /                owner: the switches and both slots (strokes included, to edit again)
 *   PUT  /show            {show:{email,posts,cards}}
 *   PUT  /:lang           {kind:"strokes"|"svg"|"png", alt, ...}: render and store one slot
 *   DELETE /:lang
 *   GET  /api/signature/:lang/<hash>[-email|-email-light].<svg|png>     public, immutable
 *
 * Why its own documents and not the announce settings: those are never public,
 * and the files here are. The public route reads these documents and nothing
 * else; it cannot be pointed at a setting. A drawn signature's SVG is written
 * by us from strokes and an uploaded one is rebuilt from an allow-list
 * (sanitize.ts), so no markup from a client is ever stored or served.
 */

const adminRouter = Router();

const invalid = (res: Response, issues: Issue[]) =>
  res.status(400).json({ ok: false, error: issues.length === 1 ? "1 field needs attention" : `${issues.length} fields need attention`, issues });
const gone = (res: Response) => res.status(404).json({ ok: false, error: "Not Found" });

async function tryGet<T>(id: string): Promise<T | null> {
  try {
    return await couch.get<T>(id);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}
const getSlot = (lang: SigLang) => tryGet<SigSlotDoc>(slotId(lang));
const getShow = async (): Promise<SigShow> => {
  const d = await tryGet<SigShowDoc>(SHOW_ID);
  const p = d ? ShowBody.safeParse({ show: d.show }) : null;
  return p?.success ? p.data.show : DEFAULT_SHOW;
};

const state = async () => ({
  ok: true,
  show: await getShow(),
  slots: Object.fromEntries(await Promise.all(SIG_LANGS.map(async (l) => [l, ((d) => (d ? slotView(d) : null))(await getSlot(l))] as const))),
});

adminRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store").json(await state());
  }),
);

/* Registered before /:lang so "show" is never read as a language. */
adminRouter.put(
  "/show",
  asyncHandler(async (req, res) => {
    const body = ShowBody.safeParse(req.body);
    if (!body.success) return invalid(res, toIssues(body.error));
    const existing = await tryGet<SigShowDoc>(SHOW_ID);
    const doc: SigShowDoc = { _id: SHOW_ID, ...(existing?._rev ? { _rev: existing._rev } : {}), type: "signature-show", show: body.data.show, updatedAt: new Date().toISOString() };
    await couch.put(SHOW_ID, doc);
    res.locals.audit = { target: SHOW_ID, before: existing?.show ?? null, after: doc.show };
    res.set("Cache-Control", "no-store").json({ ok: true, show: doc.show });
  }),
);

function files(r: Rendered): NewAttachment[] {
  const out: NewAttachment[] = [{ name: "email.png", contentType: "image/png", data: r.emailPng }];
  if (r.emailLightPng) out.push({ name: "email-light.png", contentType: "image/png", data: r.emailLightPng });
  if (r.svg) out.push({ name: "web.svg", contentType: "image/svg+xml", data: Buffer.from(r.svg) });
  if (r.webPng) out.push({ name: "web.png", contentType: "image/png", data: r.webPng });
  return out;
}

adminRouter.put(
  "/:lang",
  asyncHandler(async (req, res) => {
    const lang = SigLangParam.safeParse(req.params.lang);
    if (!lang.success) return gone(res);
    const body = SlotBody.safeParse(req.body);
    if (!body.success) return invalid(res, toIssues(body.error));
    const b = body.data;

    let rendered: Rendered;
    let ink = "#1a1a1a";
    let format: SigSlotDoc["format"] = "svg";
    let strokes: SigSlotDoc["strokes"];
    try {
      if (b.kind === "strokes") {
        const made = sanitizeSignatureSvg(strokesToSvg(b.strokes).svg);
        if (!made.ok) return invalid(res, [{ path: "strokes", message: made.error }]);
        ink = b.ink;
        strokes = b.strokes;
        rendered = await renderVector(made.svg, { ink, light: b.light });
      } else if (b.kind === "svg") {
        const clean = sanitizeSignatureSvg(b.svg, { recolor: b.recolor });
        if (!clean.ok) return invalid(res, [{ path: "svg", message: `This SVG cannot be used: ${clean.error}.` }]);
        ink = b.ink;
        rendered = await renderVector(clean.svg, { ink, light: b.light && b.recolor });
      } else {
        format = "png";
        rendered = await renderRaster(Buffer.from(b.png, "base64"), { light: b.light });
      }
    } catch (e) {
      if (e instanceof SignatureRejected) return res.status(e.status).json({ ok: false, error: e.message, issues: [{ path: b.kind, message: e.message }] });
      throw e;
    }

    const existing = await getSlot(lang.data);
    const doc: SigSlotDoc = {
      _id: slotId(lang.data),
      ...(existing?._rev ? { _rev: existing._rev } : {}),
      type: "signature",
      lang: lang.data,
      mode: b.kind === "strokes" ? "drawn" : "uploaded",
      format,
      alt: b.alt,
      ink,
      light: rendered.emailLightPng !== null,
      hash: rendered.hash,
      width: rendered.width,
      height: rendered.height,
      ...(strokes ? { strokes } : {}),
      updatedAt: new Date().toISOString(),
    };
    try {
      /* One revision holds the document and every file, so a slot never names a file that is missing. */
      await attachments.putWith(doc._id, doc as unknown as Record<string, unknown>, files(rendered));
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) return res.status(409).json({ ok: false, error: "This changed elsewhere. Reload and reapply your edit." });
      throw e;
    }
    res.locals.audit = { target: doc._id, before: slotAudit(existing), after: slotAudit(doc) };
    res.set("Cache-Control", "no-store").json({ ok: true, slot: slotView(doc) });
  }),
);

adminRouter.delete(
  "/:lang",
  asyncHandler(async (req, res) => {
    const lang = SigLangParam.safeParse(req.params.lang);
    if (!lang.success) return gone(res);
    const existing = await getSlot(lang.data);
    if (!existing?._rev) return gone(res);
    await couch.del(existing._id, existing._rev);
    res.locals.audit = { target: existing._id, before: slotAudit(existing), after: null };
    res.set("Cache-Control", "no-store").json({ ok: true });
  }),
);

export const signatureAdminRoutes = adminRouter;

/* ------------------------------------------------------------- public -- */

const FILE = /^([0-9a-f]{16})(-email-light|-email)?\.(svg|png)$/;
const FOREVER = "public, max-age=31536000, immutable";
/* The SVG is ours and has no script, but if it is opened directly it must load and run nothing. */
const CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";

export const signaturePublicRoutes = Router();

signaturePublicRoutes.get(
  "/:lang/:file",
  asyncHandler(async (req, res) => {
    const lang = SigLangParam.safeParse(req.params.lang);
    const m = FILE.exec(req.params.file);
    const miss = () => (res.set("Cache-Control", "no-store"), gone(res));
    if (!lang.success || !m) return miss();
    const [, hash, variant, ext] = m;
    const email = variant !== undefined;
    /* Switched off means not served: nothing public happens until the owner turns a use on. */
    const show = await getShow();
    if (email ? !show.email : !(show.posts || show.cards)) return miss();
    const slot = await getSlot(lang.data);
    if (!slot) return miss();
    const urls = urlsOf(slot);
    const wanted = email ? (variant === "-email-light" ? urls.emailLight : urls.email) : urls.web;
    if (!wanted) return miss();
    if (ext !== (email ? "png" : slot.format)) return miss();
    if (hash !== slot.hash) {
      /* A page or an email made before the signature was changed keeps showing the current one. */
      return res.set("Cache-Control", "public, max-age=300").redirect(302, wanted);
    }
    const name = email ? (variant === "-email-light" ? "email-light.png" : "email.png") : `web.${slot.format}`;
    const file = await attachments.get(slot._id, name);
    if (!file) return miss();
    res
      .set({
        "Content-Type": ext === "svg" ? "image/svg+xml" : "image/png",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": CSP,
        "Cache-Control": FOREVER,
      })
      .send(file.data);
  }),
);
