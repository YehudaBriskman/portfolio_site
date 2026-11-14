import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * An action in a table row keeps its label on one line (#747).
 *
 * jsdom cannot lay a table out, so the measured guard is
 * `npm run a11y:admin-desktop`; this one holds the rules that make it pass.
 * `.a-btn` wraps with overflow-wrap:anywhere (its min-content is one letter),
 * so inside an auto-layout table a long neighbour starved the action column
 * and "Edit" stacked one letter per line.
 */
const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
const rule = (selector: string) => {
  const at = css.indexOf(selector);
  expect(at, `${selector} is missing from index.css`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
};

describe("admin table actions", () => {
  it("a button in a table cell never wraps or shrinks", () => {
    const r = rule(".a-table .a-fit .a-btn");
    expect(r).toMatch(/white-space:\s*nowrap/);
    expect(r).toMatch(/overflow-wrap:\s*normal/);
    expect(r).toMatch(/flex:\s*none/);
    expect(r).toContain(".a-table td > .a-btn");
  });

  it("the identifying cell has a minimum measure", () => {
    expect(rule(".a-table .a-main")).toMatch(/min-width:/);
  });

  it("a machine string column is one clipped line", () => {
    const r = rule(".a-table .a-path");
    expect(r).toMatch(/white-space:\s*nowrap/);
    expect(r).toMatch(/text-overflow:\s*ellipsis/);
    expect(r).toMatch(/max-width:/);
  });

  it("fixed layout takes its column widths from tokens", () => {
    expect(rule(".a-table-fixed {")).toMatch(/table-layout:\s*fixed/);
    expect(rule(".a-table-fixed .a-col-path")).toMatch(/clamp\(/);
    expect(rule(".a-clamp-2")).toMatch(/line-clamp:\s*2/);
  });

  it("the Translations table uses them", () => {
    const page = readFileSync(resolve(__dirname, "../pages/AdminTranslations.tsx"), "utf8");
    expect(page).toContain("a-table a-table-fixed");
    expect(page).toContain('className="a-main"');
    expect(page).toMatch(/className="a-path[^"]*"/);
  });
});
