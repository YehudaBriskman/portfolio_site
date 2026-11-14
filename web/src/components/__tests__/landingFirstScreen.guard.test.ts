import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p === "index.html" ? p : `src/${p}`), "utf8");
/* Rules, not the prose above them: a comment may say `100vh` to explain why it is not used. */
const code = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/*
 * The landing page's first screen on a phone (mobile plan PR 6), held as
 * text. jsdom cannot lay a page out, so what these decide in CSS is pinned
 * here and measured in a browser by `scripts/a11y/public-landing.mjs`.
 */
describe("the top dock and safe areas", () => {
  const nav = code(read("components/Nav.module.css"));
  it("grows the bar by the notch, so every reader of --bar-h moves with it", () => {
    expect(nav).toMatch(/--bar-inset: env\(safe-area-inset-top, 0px\);/);
    expect(nav).toMatch(/--bar-h: calc\(56px \+ var\(--bar-inset\)\);/);
  });
  it("pads the bar by the top and both side insets (physical: the notch is)", () => {
    expect(nav).toMatch(/padding-top: var\(--bar-inset, 0px\);/);
    expect(nav).toMatch(/padding-left: max\(clamp\(12px, 2vw, 28px\), env\(safe-area-inset-left, 0px\)\);/);
    expect(nav).toMatch(/padding-right: max\(clamp\(12px, 2vw, 28px\), env\(safe-area-inset-right, 0px\)\);/);
  });
  it("keeps the page gutter clear of a landscape notch", () => {
    const css = code(read("index.css"));
    expect(css).toMatch(/\.wrap \{[^}]*env\(safe-area-inset-left, 0px\)[^}]*env\(safe-area-inset-right, 0px\)/);
  });
  it("starts the hero below the taller bar", () => {
    expect(code(read("components/Hero.module.css"))).toMatch(/--screen-pad: calc\([^;]*var\(--bar-inset, 0px\)\);/);
  });
});

describe("the hero's ask", () => {
  const css = code(read("components/HeroCorners.module.css"));
  it("is a 44px target on a coarse pointer without moving the layout (an invisible ::after)", () => {
    expect(css).toMatch(/@media \(pointer: coarse\) \{\s*\.askLink::after \{[^}]*inset-block: -0\.4rem;/);
  });
  it("keeps 24px under the last line on a phone, and clear of the home indicator", () => {
    expect(css).toMatch(/padding-block: 5rem max\(1\.5rem, env\(safe-area-inset-bottom, 0px\) \+ 0\.75rem\);/);
    expect(css).toMatch(/clamp\(1\.5rem, 2\.5vh, 2rem\)/);
  });
  it("sizes the first screen in svh, never a bare 100vh", () => {
    for (const f of ["components/Hero.module.css", "components/HeroCorners.module.css", "components/Nav.module.css"]) {
      expect(code(read(f))).not.toMatch(/(?<![\w.])100vh\b/);
    }
  });
});

describe("type and the page's width", () => {
  it("never sets the counter's unit under 12px", () => {
    expect(code(read("components/Stack.module.css"))).toMatch(/font-size: max\(0\.32em, 0\.75rem\);/);
  });
  it("tells iOS not to inflate type in landscape", () => {
    expect(code(read("index.css"))).toMatch(/html \{ -webkit-text-size-adjust: 100%; text-size-adjust: 100%; \}/);
  });
  it("documents the viewport choice", () => {
    expect(read("index.html")).toMatch(/interactive-widget/);
  });
  it("stops the living line's box at the page's edges and clips it there", () => {
    expect(read("components/motion/LivingLine.tsx")).toMatch(/Math\.floor\(m\.page\.left\)/);
    expect(code(read("components/motion/LivingLine.module.css"))).toMatch(/\.svg \{[^}]*overflow-x: clip;/);
  });
});
