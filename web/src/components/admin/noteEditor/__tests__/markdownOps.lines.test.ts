import { describe, expect, it } from "vitest";
import { applyEdit, edit, type LineOp } from "../markdownOps";

const OPS: [LineOp, string][] = [
  ["h2", "## "],
  ["h3", "### "],
  ["quote", "> "],
  ["ul", "- "],
  ["ol", "1. "],
  ["task", "- [ ] "],
];
const run = (value: string, start: number, end: number, op: LineOp) =>
  applyEdit(value, edit({ value, start, end }, op));

describe("line-prefix ops on empty lines", () => {
  it.each(OPS)("%s writes its prefix into an empty document", (op, p) => {
    expect(run("", 0, 0, op)).toBe(p);
  });

  it.each(OPS)("%s writes its prefix on a blank line between paragraphs", (op, p) => {
    expect(run("one\n\ntwo", 4, 4, op)).toBe(`one\n${p}\ntwo`);
  });

  it.each(OPS)("%s on an empty line leaves the caret after the prefix", (op, p) => {
    const e = edit({ value: "one\n\ntwo", start: 4, end: 4 }, op);
    expect([e.selStart, e.selEnd]).toEqual([4 + p.length, 4 + p.length]);
  });

  it.each(OPS)("%s toggles off again on the line it just filled", (op, p) => {
    const v = `one\n${p}\ntwo`;
    expect(run(v, 4 + p.length, 4 + p.length, op)).toBe("one\n\ntwo");
  });

  it("a multi-line selection skips blank separators and still adds to the rest", () => {
    expect(run("a\n\nb", 0, 4, "ul")).toBe("- a\n\n- b");
    expect(run("a\n\nb", 0, 4, "ol")).toBe("1. a\n\n2. b");
  });

  it("toggles off by the non-empty lines only, ignoring blank ones", () => {
    expect(run("- a\n\n- b", 0, 8, "ul")).toBe("a\n\nb");
    expect(run("- a\n\nb", 0, 6, "ul")).toBe("- a\n\n- b");
  });

  it("a selection of only blank lines prefixes each of them", () => {
    expect(run("\n\n", 0, 2, "quote")).toBe("> \n> \n");
  });

  it("an empty first line is found when the caret is at offset 0", () => {
    expect(run("\nfoo", 0, 0, "h2")).toBe("## \nfoo");
  });

  it("works on right-to-left text", () => {
    expect(run("שלום\n\nעולם", 5, 5, "h2")).toBe("שלום\n## \nעולם");
    expect(run("שלום\n\nעולם", 0, 10, "quote")).toBe("> שלום\n\n> עולם");
    expect(run("> שלום", 3, 3, "quote")).toBe("שלום");
  });
});
