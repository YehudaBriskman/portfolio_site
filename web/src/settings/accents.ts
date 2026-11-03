import type { Accent } from "./schema";

/*
 * The accent presets (#254): `--signal` (links, the active state, the one
 * primary button) and the type on it, one pair per theme.
 *
 * Presets rather than a colour picker, so the owner cannot take a link below
 * AA: `__tests__/accents.test.ts` measures every value here against every
 * ground it stands on (paper, paper-2, paper-3) and the type on it, in both
 * themes, and holds each at 4.5:1 or more. It also holds index.css and
 * public/theme-boot.js to this table, which is the one place they are listed.
 *
 * `ink` is the site's own signal, as index.css declares it; choosing it
 * writes no attribute at all.
 *
 * The dark acts' `--accent-on-panel` is not touched: the panel is one fixed
 * ground in both themes and its accent is measured there.
 */

export type Rgb = readonly [number, number, number];

export type AccentPreset = {
  light: { signal: Rgb; ink: Rgb };
  dark: { signal: Rgb; ink: Rgb };
};

const WHITE: Rgb = [255, 255, 255];
const NEAR_BLACK: Rgb = [20, 19, 15];

export const ACCENT_PRESETS: Record<Accent, AccentPreset> = {
  ink: { light: { signal: [35, 64, 107], ink: WHITE }, dark: { signal: [122, 162, 232], ink: NEAR_BLACK } },
  pine: { light: { signal: [30, 90, 70], ink: WHITE }, dark: { signal: [109, 198, 162], ink: NEAR_BLACK } },
  plum: { light: { signal: [90, 45, 112], ink: WHITE }, dark: { signal: [201, 162, 234], ink: NEAR_BLACK } },
  rust: { light: { signal: [138, 58, 18], ink: WHITE }, dark: { signal: [240, 163, 116], ink: NEAR_BLACK } },
};

export const DEFAULT_ACCENT: Accent = "ink";

export const css = (c: Rgb) => `rgb(${c.join(" ")})`;

/** Writes the accent onto <html>, where index.css reads it. */
export function applyAccent(accent: Accent): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (accent === DEFAULT_ACCENT) root.removeAttribute("data-accent");
  else if (root.getAttribute("data-accent") !== accent) root.setAttribute("data-accent", accent);
}
