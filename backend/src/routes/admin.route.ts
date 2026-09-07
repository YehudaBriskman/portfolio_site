import { Router } from "express";
import { couch, CouchError } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { PostSchema, SlugSchema, readingMinutes, type Post } from "../schemas/content.js";
import { z } from "zod";

const router = Router();

const WriteSchema = z.object({
  slug: SlugSchema,
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).nullable().default(null),
  excerpt: z.string().max(320).default(""),
  body: z.string().default(""),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8).default([]),
  publishedAt: z.string().datetime().nullable().default(null),
  /* CouchDB's revision doubles as an optimistic lock: two tabs editing the same
     post produce a clean 409 instead of a silent last-write-wins. */
  _rev: z.string().optional(),
});

const id = (slug: string) => `post:${slug}`;

router.get("/me", (req, res) => res.json({ ok: true, ...req.admin }));

router.get(
  "/posts",
  asyncHandler(async (_req, res) => {
    const { docs } = await couch.find<Post>({
      selector: { type: "post" },
      sort: [{ updatedAt: "desc" }],
      limit: 200,
    });
    res.json({ ok: true, items: docs });
  })
);

router.get(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    try {
      const doc = await couch.get<Post>(id(req.params.slug));
      res.json({ ok: true, post: doc });
    } catch (e) {
      if (e instanceof CouchError && e.status === 404) {
        return res.status(404).json({ ok: false, error: "Not Found" });
      }
      throw e;
    }
  })
);

router.put(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    const parsed = WriteSchema.safeParse({ ...req.body, slug: req.params.slug });
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    const input = parsed.data;
    const now = new Date().toISOString();

    let existing: Post | null = null;
    try {
      existing = await couch.get<Post>(id(input.slug));
    } catch (e) {
      if (!(e instanceof CouchError && e.status === 404)) throw e;
    }

    const doc: Post & { _rev?: string } = {
      _id: id(input.slug),
      ...(existing?._rev ? { _rev: input._rev ?? existing._rev } : {}),
      type: "post",
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle,
      excerpt: input.excerpt || input.body.slice(0, 300),
      body: input.body,
      bodyFormat: "markdown",
      status: input.status,
      // Publishing stamps the date once and never moves it on later edits.
      publishedAt:
        input.status === "published"
          ? existing?.publishedAt ?? input.publishedAt ?? now
          : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      tags: input.tags,
      readingMinutes: readingMinutes(input.body),
      seo: existing?.seo ?? { title: null, description: null, canonical: null, noindex: false },
    };

    const validated = PostSchema.safeParse(doc);
    if (!validated.success) {
      return res.status(400).json({ ok: false, error: "invalid document", details: validated.error.flatten() });
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
    // Archive rather than destroy: a mis-click should be recoverable.
    const doc = await couch.get<Post>(id(req.params.slug));
    const next = { ...doc, status: "archived" as const, updatedAt: new Date().toISOString() };
    await couch.put(doc._id!, next);
    res.json({ ok: true });
  })
);

export default router;
