/*
 * The site's default theme, in one place (#247).
 *
 * A reader who has never chosen gets this. It is a constant today so that the
 * site settings (#254) have exactly one thing to override later; nothing else
 * in the app or the build names a default.
 *
 * How it reaches the page: `vite.config.ts` writes it into
 * `<meta name="site-theme-default">` in index.html at build time, and both
 * readers take it from there — `public/theme-boot.js` before first paint, and
 * `lib/theme.ts` afterwards. The meta is the runtime seam on purpose: the API
 * already rewrites the shell's head per URL (backend/src/services/seo.ts), so
 * a stored setting can replace one attribute without a rebuild.
 *
 * No DOM in this file: vite.config.ts imports it, and the config is
 * type-checked against Node's libs rather than the browser's.
 */
export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const SITE_THEME_DEFAULT: ThemeChoice = "system";

/* The localStorage key, beside the motion pause's `yb-motion-paused`.
   `public/theme-boot.js` spells it out too; a test holds the two equal. */
export const THEME_KEY = "yb-theme";

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return typeof v === "string" && (THEME_CHOICES as readonly string[]).includes(v);
}
