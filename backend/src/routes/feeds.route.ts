import { Router } from "express";
import { couch } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { areaChannel, buildFeed } from "../services/seo.js";
import type { Collection, Post } from "../schemas/content.js";

/*
 * One area's RSS feed, beside the site-wide one: /api/seo/feed/<area>.xml
 * next to /api/seo/feed.xml, in the same RSS 2.0 shape and with the same
 * cache (#225). Its own file so the crawler routes in seo.route.ts stay as
 * they are.
 *
 * A hidden or unknown area is a 404 that is never cached: the slug may be
 * published a minute later, and a shared cache would keep the miss.
 */
const router = Router();

router.get(
  "/:slug.xml",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return res.status(404).set("Cache-Control", "no-store").json({ ok: false, error: "Not Found" });
    }
    const { docs: areas } = await couch.find<Collection>({
      selector: { type: "collection", status: "published", slug },
      limit: 1,
    });
    const area = areas[0];
    if (!area) return res.status(404).set("Cache-Control", "no-store").json({ ok: false, error: "Not Found" });

    const { docs } = await couch.find<Post>({
      selector: { type: "post", status: "published", collection: slug },
      limit: 500,
    });
    // Filtered again here: a draft must not reach a feed reader even if the
    // selector above is ever loosened.
    const posts = docs.filter((p) => p.status === "published" && p.collection === slug);
    res.type("application/rss+xml").set("Cache-Control", "public, max-age=600");
    res.send(buildFeed(posts, areaChannel(area)));
  }),
);

export default router;
