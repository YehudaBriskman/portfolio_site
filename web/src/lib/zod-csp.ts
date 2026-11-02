/*
 * zod without its eval probe, so the CSP has nothing to report.
 *
 * zod 4 compiles a fast parser for object schemas with `new Function`, and
 * decides whether it may by trying one: `new Function("")` inside a try. Under
 * the site's `script-src 'self'` (web/security-headers.conf) that probe throws,
 * zod catches it and falls back to its interpreted parser — so nothing breaks —
 * but the browser has already raised a `securitypolicyviolation` and logged
 * "Evaluating a string as JavaScript violates the following Content Security
 * Policy directive" on every route, because every route loads a schema. A
 * console that cries on every page is a console nobody reads, and the first
 * real violation would be lost in it.
 *
 * `jitless` tells zod not to probe at all (zod/v4/core/util.js checks it before
 * the `new Function`). It costs nothing measurable here: the compiled parser
 * pays off on hot loops over large arrays, and the largest thing this site
 * parses is one list of posts.
 *
 * It has to run before any schema is *constructed*, not just before one is
 * used: $ZodObject reads `allowsEval.value` in its constructor, which runs at
 * module load in src/services/*. That is why this is a module of its own and
 * the first import in main.tsx — ES modules evaluate in import order, depth
 * first, so this body runs before App's graph is touched.
 */
import { z } from "zod";

z.config({ jitless: true });
