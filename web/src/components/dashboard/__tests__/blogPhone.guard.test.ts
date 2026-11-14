import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Direction A on the public blog (docs/public-mobile-guide.md, section 6) is
 * phone only: everything keyed on `data-phone-page` sits inside the one 640px
 * phone query, so a tablet or a desktop cannot change by accident. No blur,
 * no hover, no physical left/right, in the part this PR added.
 */
const read = (f: string) => readFileSync(resolve(process.cwd(), "src/components/dashboard", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe.each(["Dashboard.module.css", "History.module.css"])("%s: the blog's phone look", (file) => {
  const css = read(file);
  const open = css.indexOf("@media (max-width: 639px) {\n  :global([data-phone-page") >= 0 ? css.indexOf("@media (max-width: 639px) {\n  :global([data-phone-page") : css.indexOf('@media (max-width: 639px) {\n  .ground[data-phone-page');

  it("keeps every data-phone-page rule inside the phone query", () => {
    expect(open).toBeGreaterThan(0);
    expect(css.slice(0, open)).not.toContain("data-phone-page");
    // the phone block closes where the @media closes (a line that is just "}")
    expect(css.slice(open).indexOf("\n}\n")).toBeGreaterThan(0);
  });

  it("has no blur, hover or physical sides in it", () => {
    const block = css.slice(open, open + css.slice(open).indexOf("\n}\n"));
    expect(block).not.toMatch(/backdrop-filter|blur\(/);
    expect(block).not.toMatch(/:hover/);
    expect(block).not.toMatch(/\b(margin|padding|border)-(left|right)\b|\b(left|right)\s*:/);
  });
});
