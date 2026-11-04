import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { TRANSLATION_STATUSES, TRANSLATION_TYPES } from "../schemas/i18n.js";
import { allTranslationItems, report } from "../services/translations.js";

/*
 * The translations report (#301): what is missing, stale, in draft or done in
 * Hebrew, across every note, area, project, story beat and site-copy section.
 *
 *   GET /api/admin/translations?status=missing,stale&type=post,project&visibility=public
 *
 * A read only. Mounted under /api/admin, so it sits behind requireAdmin like
 * the rest of the authoring API, and is what the Translations page (#302) and
 * the MCP tools (#307) read.
 */

const router = Router();

/** `a,b` or `a&a=b`, as a list of one enum's values. */
const list = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean)))
    .pipe(z.array(z.enum(values)));

const Query = z.object({
  status: list(TRANSLATION_STATUSES),
  type: list(TRANSLATION_TYPES),
  visibility: z.enum(["public", "private", "all"]).default("all"),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = Query.safeParse(req.query);
    if (!q.success) {
      return res.status(400).json({ ok: false, error: "Bad query", issues: q.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    }
    const { status, type, visibility } = q.data;
    const out = report(await allTranslationItems(), {
      status,
      type,
      visibility: visibility === "all" ? undefined : visibility,
    });
    res.set("Cache-Control", "no-store").json({ ok: true, ...out });
  }),
);

export default router;
