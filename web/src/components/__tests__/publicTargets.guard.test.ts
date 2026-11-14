/*
 * Public touch targets (plan PR 3): the numbers live in three tokens on :root
 * and the public modules read them, so a literal 44px cannot drift in again.
 * The real measurement is scripts/a11y/public-targets.mjs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

describe("public touch-target tokens", () => {
  it("defines --tap 44, --tap-floor 24 and --tap-gap 8", () => {
    const css = src("index.css");
    expect(css).toMatch(/--tap:\s*2\.75rem/);
    expect(css).toMatch(/--tap-floor:\s*1\.5rem/);
    expect(css).toMatch(/--tap-gap:\s*0\.5rem/);
    expect(css).toMatch(/\.tap\s*\{[^}]*min-height:\s*var\(--tap\)[^}]*min-width:\s*var\(--tap\)/);
  });

  it.each([
    ["components/dashboard/Dashboard.module.css", [".rowTitle", ".chip::after"]],
    ["components/work/Work.module.css", [".notes", ".cardName a"]],
    ["components/SignupBlock.module.css", [".check", ".check input"]],
  ])("%s sizes %j from the tokens, in logical properties", (file, selectors) => {
    const css = src(file);
    for (const s of selectors) expect(css).toContain(s);
    expect(css).toMatch(/var\(--tap(-floor)?\)/);
    expect(css).not.toMatch(/min-height:\s*44px/);
  });

  it("the footer links and the help contents carry the .tap utility", () => {
    expect(src("components/SiteFooter.tsx").match(/className="tap /g)?.length).toBe(4);
    expect(src("pages/Help.tsx")).toContain("`tap ${link}");
  });
});
