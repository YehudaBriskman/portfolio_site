import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), "src", p), "utf8");

/*
 * The stability pass (2026-11-10), held as text: jsdom cannot lay a page out,
 * so what these fixes decide in CSS is pinned here and measured in a browser
 * when it changes.
 */
describe("the browse sheet", () => {
  const css = read("components/dashboard/Dashboard.module.css");
  it("keeps a selector's list in flow, so opening one cannot stretch the sheet into empty space", () => {
    expect(css).toMatch(/\.sheetBody \[data-filter-popover\] \{[^}]*position: static;/);
  });
  it("contains its scroll, so it never chains into the page behind", () => {
    expect(css).toMatch(/\.sheetBody \{[^}]*overscroll-behavior: contain;/);
  });
  it("paint-contains a selector's option list, so its full height cannot stretch the rail or sheet (the real cause)", () => {
    expect(read("components/gallery/Filter.module.css")).toMatch(/\.options \{[^}]*contain: paint;/);
  });
  it("marks the list the rule hangs on", () => {
    expect(read("components/gallery/FilterControl.tsx")).toContain('data-filter-popover=""');
  });
});

describe("the projects run on a phone", () => {
  const css = read("components/projects/ProjectRun.module.css");
  const block = css.slice(css.indexOf("@media (pointer: coarse), (max-width: 700px)"));
  it("has a cheaper block for a coarse pointer or a narrow window", () => {
    expect(css).toContain("@media (pointer: coarse), (max-width: 700px)");
  });
  it("drops the gaussian haze and thins the card's shadow stack there", () => {
    expect(block).toMatch(/\.haze \{[^}]*filter: none;/);
    const shadow = block.match(/\.face \{[^}]*box-shadow:([^;]*);/)?.[1] ?? "";
    expect(shadow.split("rgb(").length - 1).toBeLessThanOrEqual(3);
  });
  it("promotes the moving boxes once", () => {
    expect(block).toMatch(/\.slot,\s*\.card \{[^}]*will-change: transform;/);
  });
});

describe("the spec plate's count", () => {
  const css = read("components/Stack.module.css");
  it("hands the figure to script on a phone, and only then turns the stylesheet's count off", () => {
    expect(css).toContain('.plate:not([data-count="js"]) .figure');
  });
  it("still rests on the true figure", () => {
    expect(css).toMatch(/--spec-n: var\(--spec-to\);\s*\n\s*counter-reset: spec var\(--spec-n\)/);
  });
});

describe("the reading pen", () => {
  it("mutes unread words well below the old 0.62, and says why", () => {
    const css = read("components/motion/Written.module.css");
    const v = Number(css.match(/--pen-muted:\s*([\d.]+)/)?.[1]);
    expect(v).toBeLessThan(0.5);
    expect(v).toBeGreaterThanOrEqual(0.3);
  });
});

describe("lazy routes", () => {
  it("never render a blank fallback", () => {
    expect(read("App.tsx")).not.toContain("fallback={null}");
  });
});
