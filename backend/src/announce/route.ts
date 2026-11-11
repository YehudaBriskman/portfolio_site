import { Router, type Request, type Response } from "express";
import { CouchError, couch } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { toIssues, type Issue } from "../schemas/site-content.js";
import { renderKit } from "./kit.js";
import { previewFor } from "./preview.js";
import {
  AnnounceSettingsSchema,
  DoneBody,
  SETTINGS_DOC_ID,
  SettingsSaveBody,
  type AnnounceEvent,
  type AnnounceSettingsDoc,
} from "./schemas.js";
import { getEvent, getSettingsDoc, listEvents, loadSettings, settingsOf, updateEvent } from "./store.js";

/*
 * The owner's announce inbox, under /api/admin/announce. Behind requireAdmin
 * and audited like the rest of /api/admin.
 *
 *   GET  /                 inbox (undismissed, newest first) and unread count
 *   GET  /settings         owner settings (own doc, never in /api/settings)
 *   PUT  /settings         save them; _rev must match (409 otherwise)
 *   GET  /:id              one event with its rendered kit
 *   GET  /:id/preview      the head the platforms read for the event's page (?lang=en|he)
 *   POST /:id/done         {channel}: mark one channel done
 *   POST /:id/read | /dismiss
 */

const router = Router();
const conflict = { ok: false, error: "This changed elsewhere. Reload and reapply your edit." };

function invalid(res: Response, issues: Issue[]) {
  res.status(400).json({ ok: false, error: issues.length === 1 ? "1 field needs attention" : `${issues.length} fields need attention`, issues });
}

const summary = (e: AnnounceEvent) => ({
  id: e._id, kind: e.kind, ref: e.ref, title: e.title, url: e.url, langs: e.langs,
  createdAt: e.createdAt, readAt: e.readAt ?? null, done: e.done, dismissed: e.dismissed ?? null,
});

const settingsView = (doc: AnnounceSettingsDoc | null) => ({ ok: true, exists: Boolean(doc), _rev: doc?._rev ?? null, updatedAt: doc?.updatedAt ?? null, settings: settingsOf(doc) });

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const events = (await listEvents()).filter((e) => !e.dismissed);
    res.set("Cache-Control", "no-store").json({ ok: true, unread: events.filter((e) => !e.readAt).length, items: events.map(summary) });
  }),
);

/* Registered before /:id so "settings" is never read as an event id. */
router.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store").json(settingsView(await getSettingsDoc()));
  }),
);

router.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const body = SettingsSaveBody.safeParse(req.body);
    if (!body.success) return invalid(res, toIssues(body.error));
    const parsed = AnnounceSettingsSchema.safeParse(body.data.settings);
    if (!parsed.success) return invalid(res, toIssues(parsed.error));
    const existing = await getSettingsDoc();
    if (existing && body.data._rev !== existing._rev) return res.status(409).json(conflict);
    const doc: AnnounceSettingsDoc = {
      _id: SETTINGS_DOC_ID,
      ...(existing?._rev ? { _rev: existing._rev } : {}),
      type: "settings-announce",
      settings: parsed.data,
      updatedAt: new Date().toISOString(),
    };
    try {
      const r = await couch.put<{ rev?: string }>(doc._id, doc);
      if (r && typeof r.rev === "string") doc._rev = r.rev;
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) return res.status(409).json(conflict);
      throw e;
    }
    res.locals.audit = { target: doc._id, before: existing, after: doc };
    res.json(settingsView(doc));
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const ev = await getEvent(req.params.id);
    if (!ev || ev.type !== "announce") return res.status(404).json({ ok: false, error: "No such event." });
    res.set("Cache-Control", "no-store").json({ ok: true, event: { ...summary(ev), title: ev.title, summary: ev.summary, tags: ev.tags, version: ev.version ?? null }, kit: renderKit(ev, await loadSettings()) });
  }),
);

router.get(
  "/:id/preview",
  asyncHandler(async (req, res) => {
    const ev = await getEvent(req.params.id);
    if (!ev || ev.type !== "announce") return res.status(404).json({ ok: false, error: "No such event." });
    const lang = req.query.lang === "he" ? "he" : "en";
    if (lang === "he" && !ev.langs.includes("he")) return res.status(404).json({ ok: false, error: "This event has no Hebrew page." });
    const p = await previewFor(ev, lang);
    if (p === "no-page") return res.status(422).json({ ok: false, error: "This event has no page of its own to preview." });
    if (p === "unpublished") return res.status(404).json({ ok: false, error: "The page is not published." });
    res.set("Cache-Control", "no-store").json({ ok: true, ...p });
  }),
);

async function mutate(req: Request, res: Response, change: (ev: AnnounceEvent) => void) {
  const before = await getEvent(req.params.id);
  if (!before || before.type !== "announce") return res.status(404).json({ ok: false, error: "No such event." });
  const after = await updateEvent(req.params.id, change);
  res.locals.audit = { target: req.params.id, before, after };
  res.json({ ok: true, event: after ? summary(after) : null });
}

const now = () => new Date().toISOString();

router.post(
  "/:id/done",
  asyncHandler(async (req, res) => {
    const body = DoneBody.safeParse(req.body);
    if (!body.success) return invalid(res, toIssues(body.error));
    const { channel } = body.data;
    await mutate(req, res, (ev) => {
      ev.done = { ...ev.done, [channel]: now() };
      ev.readAt ??= now();
    });
  }),
);
router.post("/:id/read", asyncHandler((req, res) => mutate(req, res, (ev) => void (ev.readAt ??= now()))));
router.post("/:id/dismiss", asyncHandler((req, res) => mutate(req, res, (ev) => { ev.dismissed = now(); ev.readAt ??= now(); })));

export default router;
