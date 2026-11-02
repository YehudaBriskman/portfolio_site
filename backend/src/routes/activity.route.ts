import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  ACTIVITY_KINDS,
  buildAreas,
  buildEvents,
  decodeCursor,
  loadSnapshot,
  pageEvents,
} from "../services/activity.js";

/*
 * The activity feed and the areas ranked by it (#223). Public and read-only,
 * on the read limiter like /api/blog.
 *
 * A minute of shared cache: the feed changes when a note is published or the
 * stats schedule runs (every fifteen minutes), so a reader never waits on the
 * store for something a minute old would have answered.
 */
const CACHE = "public, max-age=60";

/* Express hands a repeated parameter over as an array; both forms mean a list. */
const list = (v: unknown) => (Array.isArray(v) ? v.join(",") : v);

export const ActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().min(1).max(200).optional(),
  area: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  kind: z.preprocess(
    list,
    z
      .string()
      .max(100)
      .transform((s) => s.split(",").map((k) => k.trim()).filter(Boolean))
      .pipe(z.array(z.enum(ACTIVITY_KINDS)).min(1)),
  ).optional(),
});

export const activityRouter = Router();

activityRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = ActivityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "invalid", details: parsed.error.flatten() });
    }
    const q = parsed.data;
    const before = q.before ? decodeCursor(q.before) : undefined;
    if (before === null) {
      return res.status(400).json({ ok: false, error: "invalid", details: { fieldErrors: { before: ["Not a cursor"] } } });
    }
    const events = buildEvents(await loadSnapshot());
    const page = pageEvents(events, { limit: q.limit, before, area: q.area, kinds: q.kind });
    res.set("Cache-Control", CACHE).json({ ok: true, ...page });
  }),
);

export const areasRouter = Router();

/*
 * Areas with counts, most recently active first, for the dashboards' left
 * rail. /api/blog/collections stays as it is (ordered by the hand-set
 * `order`, no counts) for the clients that already read it.
 */
areasRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = buildAreas(await loadSnapshot());
    res.set("Cache-Control", CACHE).json({ ok: true, items });
  }),
);
