import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { outsideNoPreference, readCss } from "@/test/noPreference";

/*
 * The static half of the admin motion rules (docs/admin-motion-and-behavior.md M5-M7, guide section 7.4, #833).
 * Three guards, each with a shrink-only baseline of today's offenders. A new offender fails; a fixed one
 * lowers or deletes its line (a ceiling that only goes down). The browser half is
 * web/scripts/a11y/admin-rules.mjs (`motion`: nothing moves under prefers-reduced-motion: reduce).
 *
 *  1. Reduced motion (M6): a transition or animation declared OUTSIDE `@media (prefers-reduced-motion: no-preference)`
 *     in an admin stylesheet. Counted per file.
 *  2. animationend / transitionend (M7): code that waits for one. A timer drops a ghost; headless Chromium and
 *     background tabs never deliver the event. Files only; the allow-list holds the public site's two.
 *  3. Keyframes (M5, M9): an `@keyframes` name that is not in the list below. New motion is listed in the same PR as
 *     its row in docs/motion-contract.md section 8; the list is an allow-list, not a baseline.
 */

const SRC = resolve(__dirname, "../../..");

function walk(dir: string, ext: RegExp): string[] {
  return (readdirSync(dir, { recursive: true, encoding: "utf8" }) as string[])
    .filter((f) => ext.test(f) && !/(^|\/)(__tests__|node_modules)\//.test(f) && !/\.(test|spec)\./.test(f))
    .map((f) => resolve(dir, f));
}
const rel = (p: string) => relative(SRC, p).split("\\").join("/");

/** Admin stylesheets: the admin screens, the shared kit and the popup system. */
export function adminCss(): string[] {
  return [...walk(resolve(SRC, "components/admin"), /\.css$/), ...walk(resolve(SRC, "components/ui"), /\.css$/), resolve(SRC, "styles/popup.css")];
}

/** Transition or animation declarations that really move (not `none`, not 0), in text with the no-preference blocks cut. */
export function motionDeclarations(css: string): number {
  const bare = outsideNoPreference(css);
  let n = 0;
  for (const m of bare.matchAll(/(?:^|[;{\s])(transition|animation)(?:-(?:name|duration|property))?\s*:\s*([^;}]+)/g)) {
    const v = m[2].trim();
    if (/^(none|0s?|0ms|1ms|initial|inherit|unset)(\s|$)/.test(v) && !/\b\d*\.?\d+m?s\b.*\b\d*\.?\d+m?s\b/.test(v)) continue;
    if (/^(none|0s?|0ms|1ms)$/.test(v)) continue;
    n++;
  }
  n += (bare.match(/@keyframes\s/g) ?? []).length;
  return n;
}

/* Shrink-only: file (from web/src) to the number of motion declarations outside no-preference today. */
export const REDUCED_MOTION_BASELINE: Record<string, number> = {
  "components/ui/Action.module.css": 4,
  "components/ui/Dock.module.css": 1,
  "components/ui/FloatingBack.module.css": 1,
  "components/ui/IconButton.module.css": 1,
  "components/ui/SegmentedControl.module.css": 1,
  "styles/popup.css": 9,
};

/* Shrink-only: files that wait for animationend or transitionend. All public site; the admin has none. */
export const ANIMATION_EVENT_BASELINE: string[] = ["components/help/useHelpMotion.ts", "components/motion/EntryShutter.tsx"];

/* Allow-list: every @keyframes the admin may use. Add a name only with its row in docs/motion-contract.md section 8. */
export const KEYFRAMES_ALLOWED: string[] = ["a-shimmer", "ib-spin", "pop-in", "pop-out", "panel-expand"];

export function waitsForAnimationEvent(code: string): boolean {
  return /\bonAnimationEnd\b|\bonTransitionEnd\b|addEventListener\(\s*["'`](?:animation|transition)end["'`]/.test(code);
}
export function keyframeNames(css: string): string[] {
  return [...css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
}

describe("admin motion rules (static)", () => {
  it("motionDeclarations: fails on a transition outside no-preference, passes inside it", () => {
    expect(motionDeclarations(".a{transition:opacity var(--a-dur-1)}")).toBe(1);
    expect(motionDeclarations(".a{animation: spin 1s infinite}")).toBe(1);
    expect(motionDeclarations("@keyframes x{from{opacity:0}}")).toBe(1);
    expect(motionDeclarations("@media (prefers-reduced-motion: no-preference){.a{transition:opacity 1s}}")).toBe(0);
    expect(motionDeclarations(".a{transition:none}.b{animation:none}.c{transition-duration:0s}.d{transition-duration:1ms}")).toBe(0);
    expect(motionDeclarations(".a{color:red}")).toBe(0);
  });

  it("waitsForAnimationEvent: fails on a listener, passes on a timer", () => {
    expect(waitsForAnimationEvent("<div onAnimationEnd={done} />")).toBe(true);
    expect(waitsForAnimationEvent("el.addEventListener('transitionend', f)")).toBe(true);
    expect(waitsForAnimationEvent("setTimeout(drop, EXIT_KEEP_MS) // not animationend")).toBe(false);
  });

  it("keyframeNames lists every keyframes block", () => {
    expect(keyframeNames("@keyframes a-one{} @keyframes two {}")).toEqual(["a-one", "two"]);
  });

  describe("reduced motion (M6)", () => {
    const actual: Record<string, number> = {};
    for (const f of adminCss()) {
      const n = motionDeclarations(readCss(f));
      if (n) actual[rel(f)] = n;
    }
    it("no admin stylesheet moves outside prefers-reduced-motion: no-preference more than it did", () => {
      const worse = Object.entries(actual).filter(([f, n]) => n > (REDUCED_MOTION_BASELINE[f] ?? 0));
      expect(worse, "A new transition or animation must sit inside @media (prefers-reduced-motion: no-preference). Never raise a baseline.").toEqual([]);
    });
    it("a baseline line for a stylesheet that is clean now is deleted", () => {
      expect(Object.keys(REDUCED_MOTION_BASELINE).filter((f) => !actual[f]), "Delete the fixed line.").toEqual([]);
    });
  });

  describe("animationend and transitionend (M7)", () => {
    const actual = walk(SRC, /\.(ts|tsx)$/).filter((f) => waitsForAnimationEvent(readFileSync(f, "utf8"))).map(rel);
    it("no new file waits for one", () => {
      expect(actual.filter((f) => !ANIMATION_EVENT_BASELINE.includes(f)), "Use a timer (EXIT_KEEP_MS); the event is not delivered when throttled or cancelled.").toEqual([]);
    });
    it("a listed file that no longer waits is deleted from the list", () => {
      expect(ANIMATION_EVENT_BASELINE.filter((f) => !actual.includes(f))).toEqual([]);
    });
  });

  describe("keyframes (M5, M9)", () => {
    it("every admin @keyframes is on the allow-list", () => {
      const found = new Set<string>();
      for (const f of adminCss()) for (const n of keyframeNames(readCss(f))) found.add(n);
      for (const n of keyframeNames(readCss(resolve(SRC, "index.css")))) if (/^a-/.test(n)) found.add(n);
      expect([...found].filter((n) => !KEYFRAMES_ALLOWED.includes(n)).sort(), "Add the animation to docs/motion-contract.md section 8, then to KEYFRAMES_ALLOWED.").toEqual([]);
      expect(KEYFRAMES_ALLOWED.filter((n) => !found.has(n)), "Delete an allow-list name nothing declares.").toEqual([]);
    });
  });
});
