import { Router } from "express";
import { couch } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { LOG_CHANNEL, areaChannel, buildActivityFeed, buildFeed } from "../services/seo.js";
import { buildEvents, loadSnapshot, pageEvents } from "../services/activity.js";
import { ActivityQuerySchema } from "./activity.route.js";
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

/*
 * The channel log's feed (#226): /api/seo/feed/log.xml, every event the
 * activity API serves, newest first, in the same RSS 2.0 shape and with the
 * same cache as the feeds beside it. The log page advertises it with a
 * `<link rel="alternate">`.
 *
 * It takes the log page's own filters, `kind` (repeated or comma-separated)
 * and `area`, validated by the activity API's schema, so a reader can
 * subscribe to "releases only" exactly as the page shows them. An invalid
 * filter is a 400, never cached, rather than a feed that silently ignores it.
 *
 * Registered before `/:slug.xml`, so `log` names this feed and not an area.
 * An area slugged `log` would keep its page at /blog/area/log; only its
 * per-area feed would be shadowed, which is why the admin should not use it.
 */
const LogFeedQuery = ActivityQuerySchema.pick({ area: true, kind: true });

router.get(
  "/log.xml",
  asyncHandler(async (req, res) => {
    const parsed = LogFeedQuery.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .set("Cache-Control", "no-store")
        .json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    const { area, kind } = parsed.data;
    const { items } = pageEvents(buildEvents(await loadSnapshot()), { limit: 50, area, kinds: kind });
    const qs = new URLSearchParams();
    for (const k of kind ?? []) qs.append("kind", k);
    if (area) qs.set("area", area);
    const filtered = qs.toString();
    const channel = filtered
      ? {
          ...LOG_CHANNEL,
          link: `${LOG_CHANNEL.link}?${filtered}`,
          self: `${LOG_CHANNEL.self}?${filtered}`,
        }
      : LOG_CHANNEL;
    res.type("application/rss+xml").set("Cache-Control", "public, max-age=600").set("X-Robots-Tag", "noindex");
    res.send(buildActivityFeed(items, channel));
  }),
);

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
    res.type("application/rss+xml").set("Cache-Control", "public, max-age=600").set("X-Robots-Tag", "noindex");
    res.send(buildFeed(posts, areaChannel(area)));
  }),
);

export default router;
