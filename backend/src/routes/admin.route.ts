import { Router } from "express";
import { couch, CouchError } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  CollectionSchema,
  PostSchema,
  SlugSchema,
  readingMinutes,
  type Collection,
  type Post,
} from "../schemas/content.js";
import { z } from "zod";
import { fetchRepoStats } from "../services/github.js";

const router = Router();

const LinkSchema = z.object({ label: z.string().min(1).max(60), url: z.string().url() });

const PostWrite = z.object({
  slug: SlugSchema,
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).nullable().default(null),
  excerpt: z.string().max(320).default(""),
  body: z.string().default(""),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8).default([]),
  collection: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).default("site"),
  coverImage: z.string().url().nullable().default(null),
  links: z.array(LinkSchema).max(8).default([]),
  publishedAt: z.string().datetime().nullable().default(null),
  _rev: z.string().optional(),
});

const RepoWrite = z.object({
  owner: z.string().min(1).max(60),
  name: z.string().min(1).max(100),
  branch: z.string().min(1).max(60).default("main"),
  docPaths: z.array(z.string().max(200)).max(20).default([]),
});

const CollectionWrite = z.object({
  slug: SlugSchema,
  title: z.string().min(1).max(120),
  tagline: z.string().max(160).default(""),
  kind: z.enum(["site", "project"]).default("project"),
  repo: RepoWrite.nullable().default(null),
  description: z.string().max(400).default(""),
  coverImage: z.string().url().nullable().default(null),
  links: z.array(LinkSchema).max(8).default([]),
  order: z.coerce.number().int().default(50),
  status: z.enum(["published", "hidden"]).default("published"),
  _rev: z.string().optional(),
});

const postId = (slug: string) => `post:${slug}`;
const colId = (slug: string) => `collection:${slug}`;

async function tryGet<T>(id: string): Promise<T | null> {
  try {
    return await couch.get<T>(id);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}

router.get("/me", (req, res) => res.json({ ok: true, ...req.admin }));

/* ---------------------------------------------------------------- posts -- */

router.get(
  "/posts",
  asyncHandler(async (_req, res) => {
    const { docs } = await couch.find<Post>({
      selector: { type: "post" },
      sort: [{ type: "desc" }, { updatedAt: "desc" }],
      limit: 300,
    });
    res.json({ ok: true, items: docs });
  })
);

router.get(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    const doc = await tryGet<Post>(postId(req.params.slug));
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    res.json({ ok: true, post: doc });
  })
);

router.put(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    const parsed = PostWrite.safeParse({ ...req.body, slug: req.params.slug });
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    const i = parsed.data;
    const now = new Date().toISOString();
    const existing = await tryGet<Post>(postId(i.slug));

    /*
     * The optimistic lock must not be defeatable by omission. Falling back to
     * `existing._rev` meant a client that simply left `_rev` out overwrote
     * whatever was there unconditionally — which is the one thing the lock
     * exists to prevent. A write against an existing document has to name the
     * revision it was editing.
     */
    if (existing?._rev && !i._rev) {
      return res.status(409).json({
        ok: false,
        error: "This changed elsewhere. Reload and reapply your edit.",
      });
    }

    const doc: Post & { _rev?: string } = {
      _id: postId(i.slug),
      ...(existing?._rev ? { _rev: i._rev } : {}),
      type: "post",
      slug: i.slug,
      title: i.title,
      subtitle: i.subtitle,
      excerpt: i.excerpt || i.body.replace(/[#*`>_-]/g, "").slice(0, 300),
      body: i.body,
      bodyFormat: "markdown",
      status: i.status,
      // Stamped once on first publish, never moved by later edits.
      publishedAt: i.status === "published" ? existing?.publishedAt ?? i.publishedAt ?? now : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      tags: i.tags,
      collection: i.collection,
      coverImage: i.coverImage,
      links: i.links,
      source: existing?.source ?? "authored",
      readingMinutes: readingMinutes(i.body),
      seo: existing?.seo ?? { title: null, description: null, canonical: null, noindex: false },
    };

    const ok = PostSchema.safeParse(doc);
    if (!ok.success) {
      return res.status(400).json({ ok: false, error: "invalid document", details: ok.error.flatten() });
    }
    try {
      await couch.put(doc._id!, doc);
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) {
        return res.status(409).json({ ok: false, error: "This post changed elsewhere. Reload and reapply." });
      }
      throw e;
    }
    res.json({ ok: true, post: doc });
  })
);

router.delete(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    const doc = await tryGet<Post>(postId(req.params.slug));
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    await couch.put(doc._id!, { ...doc, status: "archived", updatedAt: new Date().toISOString() });
    res.json({ ok: true });
  })
);

/* ---------------------------------------------------------- collections -- */

router.get(
  "/collections",
  asyncHandler(async (_req, res) => {
    /*
     * Sorted here rather than in the query. CouchDB's Mango rejects a sort
     * whose fields disagree on direction, and this asked for type descending
     * with order ascending — so every request 400'd and the admin's Areas list
     * was permanently empty. The selector already pins `type` to one value, so
     * sorting on it bought nothing anyway, and a hundred rows sort for free.
     */
    const { docs } = await couch.find<Collection>({
      selector: { type: "collection" },
      limit: 100,
    });
    docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    res.json({ ok: true, items: docs });
  })
);

router.put(
  "/collections/:slug",
  asyncHandler(async (req, res) => {
    const parsed = CollectionWrite.safeParse({ ...req.body, slug: req.params.slug });
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    const i = parsed.data;
    const now = new Date().toISOString();
    const existing = await tryGet<Collection>(colId(i.slug));

    /*
     * The optimistic lock must not be defeatable by omission. Falling back to
     * `existing._rev` meant a client that simply left `_rev` out overwrote
     * whatever was there unconditionally — which is the one thing the lock
     * exists to prevent. A write against an existing document has to name the
     * revision it was editing.
     */
    if (existing?._rev && !i._rev) {
      return res.status(409).json({
        ok: false,
        error: "This changed elsewhere. Reload and reapply your edit.",
      });
    }

    const doc: Collection & { _rev?: string } = {
      _id: colId(i.slug),
      ...(existing?._rev ? { _rev: i._rev } : {}),
      type: "collection",
      slug: i.slug,
      title: i.title,
      description: i.description,
      coverImage: i.coverImage,
      links: i.links,
      order: i.order,
      status: i.status,
      kind: i.kind,
      tagline: i.tagline,
      repo: i.repo,
      // Stats belong to the sync job, not to this form — never clear them here.
      stats: existing?.stats ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const ok = CollectionSchema.safeParse(doc);
    if (!ok.success) {
      return res.status(400).json({ ok: false, error: "invalid document", details: ok.error.flatten() });
    }
    try {
      await couch.put(doc._id!, doc);
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) {
        return res.status(409).json({ ok: false, error: "This collection changed elsewhere. Reload." });
      }
      throw e;
    }
    res.json({ ok: true, collection: doc });
  })
);

router.delete(
  "/collections/:slug",
  asyncHandler(async (req, res) => {
    if (req.params.slug === "site") {
      return res.status(400).json({ ok: false, error: "The site collection cannot be removed." });
    }
    const doc = await tryGet<Collection>(colId(req.params.slug));
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    // Hidden, not deleted — posts still reference it by slug.
    await couch.put(doc._id!, { ...doc, status: "hidden", updatedAt: new Date().toISOString() });
    res.json({ ok: true });
  })
);

/* Refresh one project's repository numbers on demand. The schedule does this
   anyway; this exists so a change is visible immediately after editing a repo. */
router.post(
  "/collections/:slug/sync",
  asyncHandler(async (req, res) => {
    const doc = await tryGet<Collection>(colId(req.params.slug));
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    if (!doc.repo) return res.status(400).json({ ok: false, error: "No repository configured for this area." });
    const stats = await fetchRepoStats(doc.repo);
    const next = { ...doc, stats, updatedAt: new Date().toISOString() };
    await couch.put(doc._id!, next);
    res.json({ ok: true, stats });
  })
);

export default router;
