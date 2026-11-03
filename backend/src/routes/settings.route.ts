import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { publishedSettings } from "../services/site-settings.js";

/*
 * The site's settings, public and read-only (#254). The same terms as
 * /api/content: the read limiter, a minute of shared cache, and a failure
 * answers as one, so the web keeps the defaults it already rendered.
 */
const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "public, max-age=60").json({ ok: true, settings: await publishedSettings() });
  }),
);

export default router;
