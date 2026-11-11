import { Router } from "express";
import { couch } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { PostSchema, toPublicCollection, toPublicPost, toPublicSummary, type Collection, type Post } from "../schemas/content.js";

const router = Router();

/*
 * Draft filtering happens in the selector, never with a .filter() after the
 * fetch — a draft must not travel over the wire at all. A request for a draft
 * slug returns 404 rather than 403, because 403 confirms the slug exists.
 */
const PAGE = 100;
const MAX_PAGES = 100;

const publishedSelector = (extra: Record<string, unknown> = {}, skip = 0) => ({
  selector: { type: "post", status: "published", ...extra },
  sort: [{ type: "desc" as const }, { status: "desc" as const }, { publishedAt: "desc" as const }],
  limit: PAGE,
  skip,
});

/* A single _find silently stops at its limit, so walk the pages: a short page is the last. */
async function findAllPublished(extra: Record<string, unknown> = {}): Promise<Post[]> {
  const all: Post[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { docs } = await couch.find<Post>(publishedSelector(extra, page * PAGE));
    all.push(...docs);
    if (docs.length < PAGE) break;
  }
  return all;
}

router.get(
  "/posts",
  asyncHandler(async (req, res) => {
    const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
    const collection = typeof req.query.collection === "string" ? req.query.collection : undefined;
    const extra: Record<string, unknown> = {};
    if (tag) extra.tags = { $elemMatch: { $eq: tag } };
    if (collection) extra.collection = collection;
    const docs = await findAllPublished(extra);
    res.json({ ok: true, items: docs.map(toPublicSummary) });
  })
);

router.get(
  "/tags",
  asyncHandler(async (_req, res) => {
    const docs = await findAllPublished();
    const counts = new Map<string, number>();
    docs.forEach((d) => d.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    res.json({
      ok: true,
      tags: [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
    });
  })
);

router.get(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    const { docs } = await couch.find<Post>({
      selector: { type: "post", status: "published", slug: req.params.slug },
      limit: 1,
    });
    const doc = docs[0];
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    const parsed = PostSchema.safeParse(doc);
    if (!parsed.success) return res.status(404).json({ ok: false, error: "Not Found" });
    res.json({ ok: true, post: toPublicPost(parsed.data) });
  })
);

/* Shelves. Hidden collections are filtered in the selector, not afterwards. */
router.get(
  "/collections",
  asyncHandler(async (_req, res) => {
    const { docs } = await couch.find<Collection>({
      selector: { type: "collection", status: "published" },
      limit: 100,
    });
    const items = docs.map(toPublicCollection).sort((a, b) => a.order - b.order);
    res.json({ ok: true, items });
  })
);

/* One project by slug, for its own page. */
router.get(
  "/collections/:slug",
  asyncHandler(async (req, res) => {
    const { docs } = await couch.find<Collection>({
      selector: { type: "collection", status: "published", slug: req.params.slug },
      limit: 1,
    });
    const doc = docs[0];
    if (!doc) return res.status(404).json({ ok: false, error: "Not Found" });
    res.json({ ok: true, collection: toPublicCollection(doc) });
  })
);

export default router;
