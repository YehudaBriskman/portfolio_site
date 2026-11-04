import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { BUNDLE_FIELD, ContentKeySchema } from "../schemas/site-content.js";
import { publishedBundle } from "../services/site-content.js";
/* The English fingerprints behind each Hebrew text (#303) are the admin's. */
import { withoutFingerprints } from "../schemas/i18n.js";

/*
 * The site's content, public and read-only (#163). On the read limiter like
 * /api/blog, with a minute of shared cache like /api/activity: it changes
 * when the owner publishes, and a reader a minute behind a publish has lost
 * nothing. Drafts never travel here; they are read through the admin API.
 *
 * The web asks for the whole bundle once per page load. `/:key` exists for
 * anything that wants one part (the crawler renders read the service).
 */
const CACHE = "public, max-age=60";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const bundle = await publishedBundle();
    res.set("Cache-Control", CACHE).json({ ok: true, ...withoutFingerprints(bundle) });
  }),
);

router.get(
  "/:key",
  asyncHandler(async (req, res) => {
    const key = ContentKeySchema.safeParse(req.params.key);
    if (!key.success) return res.status(404).json({ ok: false, error: "Not Found" });
    const bundle = await publishedBundle();
    res.set("Cache-Control", CACHE).json({ ok: true, key: key.data, content: withoutFingerprints(bundle[BUNDLE_FIELD[key.data]]) });
  }),
);

export default router;
