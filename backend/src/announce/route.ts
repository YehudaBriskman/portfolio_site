import { Router, type Request, type Response } from "express";
import { CouchError, couch } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { toIssues, type Issue } from "../schemas/site-content.js";
import { randomUUID } from "node:crypto";
import { SITE_URL } from "../services/seo.js";
import { renderKit } from "./kit.js";
import { previewFor } from "./preview.js";
import {
  AnnounceSettingsSchema,
  CustomBody,
  DoneBody,
  DraftBody,
  SETTINGS_DOC_ID,
  SettingsSaveBody,
  type AnnounceEvent,
  type Channel,
  type Drafts,
  type AnnounceSettingsDoc,
} from "./schemas.js";
import { createEvent, eventId, getEvent, getSettingsDoc, listEvents, loadSettings, settingsOf, updateEvent } from "./store.js";

/*
 * The owner's announce inbox, under /api/admin/announce. Behind requireAdmin
 * and audited like the rest of /api/admin.
 *
 *   GET  /                 inbox (undismissed, newest first) and unread count
 *   GET  /settings         owner settings (own doc, never in /api/settings)
 *   PUT  /settings         save them; _rev must match (409 otherwise)
 *   POST /                 create a hand-made announcement (custom; also story or home)
 *   GET  /:id              one event with its drafts and rendered kit
 *   PUT  /:id/draft        {lang, channel, text|null, _rev?}: the owner's own text; null clears it
 *   GET  /:id/preview      the head the platforms read for the event's page (?lang=en|he)
 *   POST /:id/done         {channel}: mark one channel done
 *   POST /:id/read | /dismiss
 */

const router = Router();
const conflict = { ok: false, error: "This changed elsewhere. Reload and reapply your edit." };

function invalid(res: Response, issues: Issue[]) {
  res.status(400).json({ ok: false, error: issues.length === 1 ? "1 field needs attention" : `${issues.length} fields need attention`, issues });
}

/** Normalised href when `raw` is http(s) on the site's own origin, else null. Never anything from outside. */
function ownSiteUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const site = new URL(SITE_URL);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.origin !== site.origin || u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
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

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = CustomBody.safeParse(req.body);
    if (!body.success) return invalid(res, toIssues(body.error));
    const b = body.data;
    const issues: Issue[] = [];
    const url = ownSiteUrl(b.url);
    const imageUrl = ownSiteUrl(b.imageUrl);
    if (b.url && !url) issues.push({ path: "url", message: "A link on this site (its own address)" });
    if (b.imageUrl && !imageUrl) issues.push({ path: "imageUrl", message: "An image on this site (its own address)" });
    if (issues.length) return invalid(res, issues);
    const now = new Date().toISOString();
    /* story and home are the site's own pages: their address is fixed, not an input. */
    const path = b.kind === "story" ? "/story" : b.kind === "home" ? "/" : undefined;
    const ev: AnnounceEvent = {
      _id: eventId(b.kind, randomUUID().slice(0, 8), now),
      type: "announce",
      kind: b.kind,
      ref: b.kind === "custom" ? "custom" : b.kind,
      title: b.title,
      summary: b.summary,
      tags: [],
      url: path ? `${SITE_URL}${path === "/" ? "" : path}` : url ?? SITE_URL,
      ...(path ? { path } : {}),
      ...(b.kind === "custom" ? { custom: { title: b.title, summary: b.summary, ...(url ? { url } : {}), ...(imageUrl ? { imageUrl } : {}) } } : {}),
      langs: path ? ["en", "he"] : ["en"],
      createdAt: now,
      done: {},
    };
    await createEvent(ev);
    res.locals.audit = { target: ev._id, before: null, after: ev };
    res.status(201).json({ ok: true, event: summary(ev) });
  }),
);

const detail = async (ev: AnnounceEvent) => ({
  ok: true,
  event: { ...summary(ev), _rev: ev._rev ?? null, title: ev.title, summary: ev.summary, tags: ev.tags, version: ev.version ?? null, drafts: ev.drafts ?? {}, custom: ev.custom ?? null },
  kit: renderKit(ev, await loadSettings()),
});

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const ev = await getEvent(req.params.id);
    if (!ev || ev.type !== "announce") return res.status(404).json({ ok: false, error: "No such event." });
    res.set("Cache-Control", "no-store").json(await detail(ev));
  }),
);

router.get(
  "/:id/preview",
  asyncHandler(async (req, res) => {
    const ev = await getEvent(req.params.id);
    if (!ev || ev.type !== "announce") return res.status(404).json({ ok: false, error: "No such event." });
    const lang = req.query.lang === "he" ? "he" : "en";
    if (lang === "he" && !ev.langs.includes("he") && ev.kind !== "custom") return res.status(404).json({ ok: false, error: "This event has no Hebrew page." });
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

router.put(
  "/:id/draft",
  asyncHandler(async (req, res) => {
    const body = DraftBody.safeParse(req.body);
    if (!body.success) return invalid(res, toIssues(body.error));
    const { lang, channel, text, _rev } = body.data;
    const before = await getEvent(req.params.id);
    if (!before || before.type !== "announce") return res.status(404).json({ ok: false, error: "No such event." });
    if (_rev !== undefined && _rev !== before._rev) return res.status(409).json(conflict);
    let after: AnnounceEvent | null;
    try {
      after = await updateEvent(req.params.id, (ev) => {
        const own: Partial<Record<Channel, string>> = { ...ev.drafts?.[lang] };
        if (text === null || text.trim() === "") delete own[channel];
        else own[channel] = text;
        const drafts: Drafts = { ...ev.drafts, [lang]: own };
        if (Object.keys(own).length === 0) delete drafts[lang];
        if (Object.keys(drafts).length === 0) delete ev.drafts;
        else ev.drafts = drafts;
      });
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) return res.status(409).json(conflict);
      throw e;
    }
    if (!after) return res.status(404).json({ ok: false, error: "No such event." });
    res.locals.audit = { target: req.params.id, before, after };
    res.json(await detail(after));
  }),
);

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
