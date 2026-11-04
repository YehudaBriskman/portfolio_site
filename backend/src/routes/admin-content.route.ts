import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { couch, CouchError } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  BUNDLE_FIELD,
  CONTENT_KEYS,
  CONTENT_SCHEMAS,
  ContentKeySchema,
  checkContent,
  toIssues,
  type ContentBundle,
  type ContentDoc,
  type ContentKey,
  type Issue,
} from "../schemas/site-content.js";
import {
  contentId,
  getContentDoc,
  previewBundle,
  publishedBundle,
  seedContent,
  seedFor,
} from "../services/site-content.js";
import { stampTexts } from "../schemas/i18n.js";

/*
 * Editing the site's content (#163), under /api/admin/content.
 *
 * Mounted from admin.route.ts, so it sits behind whatever gate /api/admin
 * has and is not a second door into it.
 *
 *   GET    /                 each key: whether it exists, has a draft, when
 *   GET    /preview          the bundle with drafts in place, for ?preview=1
 *   POST   /seed             create every missing document from the seed
 *   GET    /:key             the published version and the draft, with _rev
 *   PUT    /:key/draft       save a draft (validated, not published)
 *   POST   /:key/publish     validate everything and publish; clears the draft
 *   DELETE /:key/draft       discard the draft
 *
 * A draft is checked against its schema, so the store never holds a shape the
 * site cannot read; publishing also runs the cross-document rules
 * (`checkContent`) that `buildStory()` used to run at build time. A failure
 * answers 400 with `issues`, each a dotted path into the document and a
 * message, which the editors place under the field.
 *
 * The optimistic lock is the posts' lock: a write against an existing
 * document must name the revision it was editing, and a stale one is 409.
 */

const router = Router();

const WriteBody = z.object({ data: z.unknown(), _rev: z.string().optional() });

function keyOf(raw: string): ContentKey | null {
  const parsed = ContentKeySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const conflict = { ok: false, error: "This changed elsewhere. Reload and reapply your edit." };

function invalid(issues: Issue[]) {
  return { ok: false, error: issues.length === 1 ? "1 field needs attention" : `${issues.length} fields need attention`, issues };
}

/** Writes the document, mapping CouchDB's conflict to the lock's answer. */
async function write(doc: ContentDoc): Promise<"ok" | "conflict"> {
  try {
    const r = await couch.put<{ rev?: string }>(doc._id, doc);
    if (r && typeof r.rev === "string") doc._rev = r.rev;
    return "ok";
  } catch (e) {
    if (e instanceof CouchError && e.status === 409) return "conflict";
    throw e;
  }
}

function view(key: ContentKey, doc: ContentDoc | null) {
  return {
    ok: true,
    key,
    exists: Boolean(doc),
    _rev: doc?._rev ?? null,
    published: doc ? doc.published : seedFor(key),
    draft: doc?.draft ?? null,
    updatedAt: doc?.updatedAt ?? null,
    publishedAt: doc?.publishedAt ?? null,
    source: doc?.source ?? "seed",
  };
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const docs = await Promise.all(CONTENT_KEYS.map((k) => getContentDoc(k)));
    res.json({
      ok: true,
      items: CONTENT_KEYS.map((key, i) => ({
        key,
        exists: Boolean(docs[i]),
        hasDraft: Boolean(docs[i]?.draft),
        updatedAt: docs[i]?.updatedAt ?? null,
        publishedAt: docs[i]?.publishedAt ?? null,
      })),
    });
  }),
);

router.get(
  "/preview",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store").json({ ok: true, ...(await previewBundle()) });
  }),
);

router.post(
  "/seed",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, ...(await seedContent()) });
  }),
);

router.get(
  "/:key",
  asyncHandler(async (req, res) => {
    const key = keyOf(req.params.key);
    if (!key) return res.status(404).json({ ok: false, error: "Not Found" });
    res.set("Cache-Control", "no-store").json(view(key, await getContentDoc(key)));
  }),
);

/**
 * The shared half of a draft save and a publish: parse the body and the
 * data, and load the document. Answers the request itself on any failure.
 */
async function prepare(req: Request, res: Response) {
  const key = keyOf(req.params.key);
  if (!key) {
    res.status(404).json({ ok: false, error: "Not Found" });
    return null;
  }
  const body = WriteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json(invalid(toIssues(body.error)));
    return null;
  }
  const parsed = CONTENT_SCHEMAS[key].safeParse(body.data.data);
  if (!parsed.success) {
    res.status(400).json(invalid(toIssues(parsed.error)));
    return null;
  }
  const existing = await getContentDoc(key);
  if (existing && body.data._rev !== existing._rev) {
    res.status(409).json(conflict);
    return null;
  }
  /*
   * Fingerprints (#303): Hebrew unchanged since the draft or the published
   * version keeps the fingerprint it had; Hebrew written in this save gets the
   * English beside it. So a publish of a stamped draft keeps the draft's.
   */
  const data = stampTexts(parsed.data as unknown, [existing?.draft, existing ? existing.published : seedFor(key)]);
  return { key, data, existing };
}

function fresh(key: ContentKey, now: string, existing: ContentDoc | null): ContentDoc {
  return {
    _id: contentId(key),
    ...(existing?._rev ? { _rev: existing._rev } : {}),
    type: "content",
    key,
    published: existing ? existing.published : seedFor(key),
    draft: existing?.draft ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    publishedAt: existing?.publishedAt ?? now,
    source: existing?.source ?? "seed",
  };
}

router.put(
  "/:key/draft",
  asyncHandler(async (req, res) => {
    const p = await prepare(req, res);
    if (!p) return;
    const doc = { ...fresh(p.key, new Date().toISOString(), p.existing), draft: p.data };
    if ((await write(doc)) === "conflict") return res.status(409).json(conflict);
    res.json(view(p.key, doc));
  }),
);

router.post(
  "/:key/publish",
  asyncHandler(async (req, res) => {
    const p = await prepare(req, res);
    if (!p) return;
    /* The rules that span documents, against the others as published. */
    const bundle: ContentBundle = { ...(await publishedBundle()), [BUNDLE_FIELD[p.key]]: p.data };
    const issues = checkContent(bundle, p.key);
    if (issues.length > 0) return res.status(400).json(invalid(issues));

    const now = new Date().toISOString();
    const doc: ContentDoc = {
      ...fresh(p.key, now, p.existing),
      published: p.data,
      draft: null,
      publishedAt: now,
      source: "admin",
    };
    if ((await write(doc)) === "conflict") return res.status(409).json(conflict);
    res.json(view(p.key, doc));
  }),
);

router.delete(
  "/:key/draft",
  asyncHandler(async (req, res) => {
    const key = keyOf(req.params.key);
    if (!key) return res.status(404).json({ ok: false, error: "Not Found" });
    const existing = await getContentDoc(key);
    if (!existing) return res.json(view(key, null));
    const rev = typeof req.query.rev === "string" ? req.query.rev : undefined;
    if (rev !== existing._rev) return res.status(409).json(conflict);
    const doc: ContentDoc = { ...existing, draft: null, updatedAt: new Date().toISOString() };
    if ((await write(doc)) === "conflict") return res.status(409).json(conflict);
    res.json(view(key, doc));
  }),
);

export default router;
