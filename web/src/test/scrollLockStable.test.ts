import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * A modal popup must not move the page (#889).
 *
 * jsdom cannot lay anything out, so the measured guard is
 * `npm run a11y:admin-popup-stability`; this holds the rule that makes it pass.
 * react-remove-scroll sets `overflow: hidden` and a padding/margin on the body
 * while a Radix menu is open. With `html { overflow-x: clip }` that turns the
 * body into a scroll container and drags every sticky bar up by the scroll.
 */
const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
const at = css.indexOf("html body[data-scroll-locked] {");

describe("scroll lock", () => {
  it("neutralises the library's body overflow and compensation", () => {
    expect(at, "the data-scroll-locked override is missing from index.css").toBeGreaterThan(-1);
    const r = css.slice(at, css.indexOf("}", at));
    expect(r).toMatch(/overflow:\s*clip visible\s*!important/);
    expect(r).toMatch(/padding-right:\s*0\s*!important/);
    expect(r).toMatch(/margin-right:\s*0\s*!important/);
  });
  it("sits inside a cascade layer, so its !important outranks the library's unlayered one", () => {
    const layerOpen = css.lastIndexOf("@layer", at);
    expect(layerOpen).toBeGreaterThan(-1);
    expect(css.slice(layerOpen, at)).not.toMatch(/\n}\n/);
  });
  it("html keeps overflow-x clip (the premise of the override)", () => {
    expect(css).toMatch(/html\s*\{\s*overflow-x:\s*clip;/);
  });
});
