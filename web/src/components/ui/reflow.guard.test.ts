import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * jsdom cannot lay anything out, so these hold the source of the fixes that
 * `npm run a11y:admin-reflow` measures in a browser: a failure here says which
 * rule went missing before the slower check says what it did to the page.
 */
const css = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

describe("reflow and device guards", () => {
  it("Switch draws its track and thumb with system colours under forced-colors", () => {
    const c = css("Switch.module.css");
    const block = c.slice(c.indexOf("@media (forced-colors: active)"));
    expect(block).toMatch(/forced-color-adjust:\s*none/);
    expect(block).toMatch(/border:\s*2px solid ButtonText/);
    expect(block).toMatch(/Highlight/);
  });

  it("SelectionBar wraps, caps its height and never lets the count collapse", () => {
    const c = css("SelectionBar.module.css");
    expect(c).toMatch(/\.bar \{[^}]*flex-wrap:\s*wrap/);
    expect(c).toMatch(/\.bar \{[^}]*max-block-size/);
    expect(c).toMatch(/\.count \{[^}]*flex:\s*1 0 auto/);
  });

  it("the admin top bar and main honour the side safe-area insets", () => {
    const c = css("../../index.css");
    expect(c).toMatch(/\.a-top \{[^}]*safe-area-inset-left[^}]*safe-area-inset-right/s);
    expect(c).toMatch(/\.a-main \{[^}]*safe-area-inset-left[^}]*safe-area-inset-right/s);
  });

  it("the shared mirror class flips a directional icon under :dir(rtl)", () => {
    expect(css("../../index.css")).toMatch(/\.a-mirror:dir\(rtl\)\s*\{\s*transform:\s*scaleX\(-1\)/);
  });
});
