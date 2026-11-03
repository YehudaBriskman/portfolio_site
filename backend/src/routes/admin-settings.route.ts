import { Router, type Response } from "express";
import { z } from "zod";
import { couch, CouchError } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { toIssues, type Issue } from "../schemas/site-content.js";
import { SiteSettingsSchema, type SiteSettings } from "../schemas/site-settings.js";
import { getSettingsDoc, nextDoc, settingsOf, type SettingsDoc } from "../services/site-settings.js";

/*
 * Editing the site's settings (#254), under /api/admin/settings.
 *
 * Mounted from admin.route.ts, behind the same gate and audit as the rest
 * of /api/admin.
 *
 *   GET    /          the settings, their version, _rev, and the history
 *   PUT    /          save new settings (validated); the old go on the history
 *   POST   /revert    put an earlier version back, as a new version
 *
 * There is no draft: the settings are a handful of switches, and the
 * history is the undo. Every save is validated against the schema, which
 * holds the ledger rule, and a failure answers 400 with `issues` the admin
 * places beside the section it names. The optimistic lock is the content
 * editors': a save must name the revision it was made against.
 */

const router = Router();

const SaveBody = z.object({ settings: z.unknown(), _rev: z.string().optional() }).strict();
const RevertBody = z.object({ version: z.number().int().min(0), _rev: z.string().optional() }).strict();

const conflict = { ok: false, error: "This changed elsewhere. Reload and reapply your edit." };

function invalid(res: Response, issues: Issue[]) {
  res.status(400).json({ ok: false, error: issues.length === 1 ? "1 field needs attention" : `${issues.length} fields need attention`, issues });
}

function view(doc: SettingsDoc | null) {
  return {
    ok: true,
    exists: Boolean(doc),
    _rev: doc?._rev ?? null,
    version: doc?.version ?? 0,
    updatedAt: doc?.updatedAt ?? null,
    settings: settingsOf(doc),
    history: (doc?.history ?? []).map((h) => ({ version: h.version, at: h.at, settings: h.settings })),
  };
}

async function write(doc: SettingsDoc): Promise<"ok" | "conflict"> {
  try {
    const r = await couch.put<{ rev?: string }>(doc._id, doc);
    if (r && typeof r.rev === "string") doc._rev = r.rev;
    return "ok";
  } catch (e) {
    if (e instanceof CouchError && e.status === 409) return "conflict";
    throw e;
  }
}

async function commit(res: Response, existing: SettingsDoc | null, rev: string | undefined, next: SiteSettings) {
  if (existing && rev !== existing._rev) return res.status(409).json(conflict);
  const doc = nextDoc(existing, next, new Date().toISOString());
  if ((await write(doc)) === "conflict") return res.status(409).json(conflict);
  res.json(view(doc));
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store").json(view(await getSettingsDoc()));
  }),
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const body = SaveBody.safeParse(req.body);
    if (!body.success) return invalid(res, toIssues(body.error));
    const parsed = SiteSettingsSchema.safeParse(body.data.settings);
    if (!parsed.success) return invalid(res, toIssues(parsed.error));
    await commit(res, await getSettingsDoc(), body.data._rev, parsed.data);
  }),
);

router.post(
  "/revert",
  asyncHandler(async (req, res) => {
    const body = RevertBody.safeParse(req.body);
    if (!body.success) return invalid(res, toIssues(body.error));
    const existing = await getSettingsDoc();
    const target = existing?.history.find((h) => h.version === body.data.version);
    if (!target) return res.status(404).json({ ok: false, error: "No such version." });
    /* An old version is validated again: the schema may have tightened since
       it was saved, and the store must never hold a shape the site refuses. */
    const parsed = SiteSettingsSchema.safeParse(target.settings);
    if (!parsed.success) return invalid(res, toIssues(parsed.error));
    await commit(res, existing, body.data._rev, parsed.data);
  }),
);

export default router;
