import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The admin design guide is the one place the admin's components are written
 * down, so it must not rot: every component file under components/ui has an
 * entry in the guide's catalogue, and the dated appendices copied into
 * docs/design carry no path from one person's machine. Read off the files
 * (the guide is prose, so a test can only hold its skeleton).
 */

const WEB_SRC = resolve(__dirname, "../..");
const ROOT = resolve(WEB_SRC, "../..");
const GUIDE = join(ROOT, "docs/admin-design-guide.md");

const guide = existsSync(GUIDE) ? readFileSync(GUIDE, "utf8") : "";

/** The text of "## 3. ..." up to the next "## " heading. */
function catalogue(md: string): string {
  const start = md.search(/^## 3\.\s/m);
  if (start < 0) return "";
  const rest = md.slice(start + 1);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

const uiComponents = readdirSync(join(WEB_SRC, "components/ui"))
  .filter((n) => /\.tsx$/.test(n) && !/\.test\./.test(n))
  .map((n) => n.replace(/\.tsx$/, ""));

describe("docs/admin-design-guide.md", () => {
  it("exists and has the nine numbered sections", () => {
    expect(guide, "docs/admin-design-guide.md is missing").not.toBe("");
    for (let n = 1; n <= 9; n++) expect(guide, `section ${n}`).toMatch(new RegExp(`^## ${n}\\. `, "m"));
  });

  it("lists every component under web/src/components/ui in the catalogue", () => {
    const cat = catalogue(guide);
    expect(uiComponents.length).toBeGreaterThan(0);
    const missing = uiComponents.filter((c) => !cat.includes(`components/ui/${c}`));
    expect(missing, `add these to section 3 of the guide (import path components/ui/<name>): ${missing.join(", ")}`).toEqual([]);
  });

  it("names every planned component with its issue number", () => {
    const cat = catalogue(guide);
    for (const n of [669, 671, 672, 673, 674, 675]) expect(cat, `#${n}`).toContain(`#${n}`);
  });
});

describe("docs/design appendices", () => {
  const dir = join(ROOT, "docs/design");
  const files = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(".md")) : [];

  it("holds the three dated reference appendices", () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it.each(files)("%s has no local absolute path", (name) => {
    const text = readFileSync(join(dir, name), "utf8");
    expect(text).not.toMatch(/\/home\/[a-z]|\/Users\/[A-Za-z]|[A-Z]:\\Users\\/);
  });
});
