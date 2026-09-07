import { Router } from "express";
import { couch } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { PostSchema, toPublicPost, toPublicSummary, type Post } from "../schemas/content.js";

const router = Router();

/*
 * Draft filtering happens in the selector, never with a .filter() after the
 * fetch — a draft must not travel over the wire at all. A request for a draft
 * slug returns 404 rather than 403, because 403 confirms the slug exists.
 */
const publishedSelector = (extra: Record<string, unknown> = {}) => ({
  selector: { type: "post", status: "published", ...extra },
  sort: [{ publishedAt: "desc" as const }],
  limit: 50,
});

router.get(
  "/posts",
  asyncHandler(async (req, res) => {
    const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
    const { docs } = await couch.find<Post>(
      publishedSelector(tag ? { tags: { $elemMatch: { $eq: tag } } } : {})
    );
    res.json({ ok: true, items: docs.map(toPublicSummary) });
  })
);

router.get(
  "/tags",
  asyncHandler(async (_req, res) => {
    const { docs } = await couch.find<Post>(publishedSelector());
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

export default router;
