import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// A plain .mjs script with no declaration file; its browser half runs in CI (npm run a11y:admin-rules).
import * as rules from "../../../../scripts/a11y/admin-rules.mjs";

/*
 * The pure half of web/scripts/a11y/admin-rules.mjs (#833): facts measured in a browser go in, finding lines
 * come out. Each rule has a synthetic offender that must FAIL (produce its line) and a clean fixture that must
 * PASS (produce none), so the guard cannot go silent. The baseline file is held to a per-rule ceiling that only
 * goes down: to fix an offender, delete its line from admin-rules-baseline.json and lower the number here.
 */

const { evaluate, compare, shrink, hebrewWords, corpusOf, RULES, MIN_GAP, TOUCH } = rules;

const ctl = (o: object = {}) => ({ sel: "button.a-btn", kind: "button.a-btn", shell: false, l: 0, t: 0, r: 100, b: 44, w: 100, h: 44, layer: "flow", group: -1, iconOnly: false, named: true, danger: false, row: -1, rowParent: -1, primary: false, holds: [], ...o });
const page = (o: object = {}) => ({ route: "/admin/x", w: 1280, lang: "en", coarse: false, vh: 900, h1: ["Title"], headings: ["Title", "Section"], dup: [], tables: [], overflow: [], controls: [], texts: [], corpus: "", motion: [], ...o });
const only = (f: object, rule: string) => evaluate(f).filter((k: string) => k.startsWith(rule + "|"));

describe("admin rules: each guard fails on an offender and passes on a clean fixture", () => {
  it("the clean page has no finding at all", () => {
    expect(evaluate(page())).toEqual([]);
    expect(evaluate(page({ w: 390, coarse: true }))).toEqual([]);
    expect(evaluate(page({ lang: "he", texts: ["שמירה", "Bothy"] }))).toEqual([]);
  });

  it("h1 (A2): none or two fail, exactly one passes", () => {
    expect(only(page({ h1: [] }), "h1")).toEqual(["h1|/admin/x|0"]);
    expect(only(page({ h1: ["A", "B"] }), "h1")).toEqual(["h1|/admin/x|2"]);
    expect(only(page({ h1: ["A"] }), "h1")).toEqual([]);
  });

  it("dup-head and dup-text (A2, A5): the same words twice fail", () => {
    expect(only(page({ headings: ["Audience", "Audience"] }), "dup-head")).toEqual(["dup-head|/admin/x|Audience"]);
    expect(only(page({ headings: ["Audience", "People"] }), "dup-head")).toEqual([]);
    expect(only(page({ dup: ["Unpublished changes in this post"] }), "dup-text")).toHaveLength(1);
    expect(only(page({ dup: [] }), "dup-text")).toEqual([]);
  });

  it("sticky (A11): a long table without a sticky header fails, with one it passes, a short table is free", () => {
    const t = (o: object) => page({ tables: [{ sel: "table.a-table", rows: 20, h: 1200, sticky: false, ...o }] });
    expect(only(t({}), "sticky")).toEqual(["sticky|/admin/x|desktop|table.a-table"]);
    expect(only(t({ sticky: true }), "sticky")).toEqual([]);
    expect(only(t({ rows: 4, h: 300 }), "sticky")).toEqual([]);
    expect(only(t({ rows: 4, h: 1200 }), "sticky")).toHaveLength(1); /* taller than the page, however few rows */
  });

  it("overflow (A8): clipped text fails, nothing clipped passes", () => {
    expect(only(page({ overflow: [{ sel: "span.title" }] }), "overflow")).toEqual(["overflow|/admin/x|desktop|en|span.title"]);
    expect(only(page({ overflow: [] }), "overflow")).toEqual([]);
  });

  it("gap and overlap (A7): touching boxes, a gap under the token, an intersection fail; 8px apart passes", () => {
    const row = (gap: number) => page({ controls: [ctl({ sel: "a", l: 0, r: 100 }), ctl({ sel: "b", l: 100 + gap, r: 200 + gap })] });
    expect(only(row(0), "gap")).toHaveLength(1);
    expect(only(row(MIN_GAP - 1), "gap")).toHaveLength(1);
    expect(only(row(MIN_GAP), "gap")).toEqual([]);
    expect(only(row(-30), "overlap")).toEqual(["overlap|/admin/x|desktop|a ~ b"]);
    /* stacked */
    const col = page({ controls: [ctl({ sel: "a" }), ctl({ sel: "b", t: 44, b: 88 })] });
    expect(only(col, "gap")).toHaveLength(1);
    /* a menu or tab strip joins its items on purpose; an overlap is never allowed */
    const joined = page({ controls: [ctl({ sel: "a", group: 1 }), ctl({ sel: "b", l: 100, r: 200, group: 1 })] });
    expect(only(joined, "gap")).toEqual([]);
    expect(only(page({ controls: [ctl({ sel: "a", group: 1 }), ctl({ sel: "b", l: 50, r: 150, group: 1 })] }), "overlap")).toHaveLength(1);
    /* a control that holds another, and a fixed bar over the flow, are not pairs */
    expect(evaluate(page({ controls: [ctl({ sel: "card", holds: [1] }), ctl({ sel: "inner", l: 10, r: 90, t: 4, b: 40 })] }))).toEqual([]);
    expect(evaluate(page({ controls: [ctl({ sel: "bar", layer: "fixed" }), ctl({ sel: "row" })] }))).toEqual([]);
    /* the shell is one finding for every route */
    expect(only(page({ controls: [ctl({ sel: "a", shell: true }), ctl({ sel: "b", shell: true, l: 100, r: 200 })] }), "gap")).toEqual(["gap|*|desktop|a ~ b"]);
  });

  it("target (A33): a primary control under 44 on a phone fails, 44 or a desktop pointer passes", () => {
    const p = (h: number, o: object = {}) => page({ w: 390, coarse: true, controls: [ctl({ primary: true, h, b: h })], ...o });
    expect(only(p(TOUCH - 1), "target")).toEqual(["target|/admin/x|button.a-btn"]);
    expect(only(p(TOUCH), "target")).toEqual([]);
    expect(only(page({ controls: [ctl({ primary: true, h: 30, b: 30 })] }), "target")).toEqual([]);
    expect(only(p(30, { controls: [ctl({ primary: false, h: 30, b: 30 })] }), "target")).toEqual([]);
  });

  it("icon-label (A9): an icon-only control with no name fails, a named one passes", () => {
    expect(only(page({ controls: [ctl({ sel: "button.a-icon-btn", iconOnly: true, named: false })] }), "icon-label")).toEqual(["icon-label|/admin/x|desktop|button.a-icon-btn"]);
    expect(only(page({ controls: [ctl({ iconOnly: true, named: true })] }), "icon-label")).toEqual([]);
    expect(only(page({ controls: [ctl({ iconOnly: false, named: false })] }), "icon-label")).toEqual([]);
  });

  it("destructive (A1, A12): a danger button at rest on two rows fails; on one row, or none, it passes", () => {
    const d = (rows: number[]) => page({ controls: rows.map((r) => ctl({ sel: `button "Revoke ${r}"`, kind: "button.a-btn-danger", danger: true, row: r, rowParent: 99 })) });
    expect(only(d([1, 2, 3]), "destructive")).toEqual(["destructive|/admin/x|desktop|button.a-btn-danger"]);
    expect(only(d([1]), "destructive")).toEqual([]);
    expect(only(d([]), "destructive")).toEqual([]);
    /* two danger buttons in one row are one row */
    expect(only(page({ controls: [ctl({ danger: true, row: 1, rowParent: 9 }), ctl({ danger: true, row: 1, rowParent: 9, l: 200, r: 300 })] }), "destructive")).toEqual([]);
  });

  it("hebrew (A34): an English word on a he screen fails; brand, identifiers, user content and Hebrew pass", () => {
    const he = (texts: string[], corpus = "") => page({ lang: "he", texts, corpus });
    expect(only(he(["Edit"]), "hebrew")).toEqual(["hebrew|/admin/x|edit"]);
    expect(only(he(["שמירה", "Bothy", "CSV", "MCP", "me@example.com", "/admin/posts", "v1.9.0", "abc"]), "hebrew")).toEqual([]);
    expect(only(he(["Rebuilding the admin"]), "hebrew")).toEqual(["hebrew|/admin/x|rebuilding", "hebrew|/admin/x|admin"]); /* "the" is three letters */
    expect(only(he(["Rebuilding the admin"], corpusOf({ title: "Rebuilding the admin as a tool" }).join(" ")), "hebrew")).toEqual([]);
    expect(only(page({ lang: "en", texts: ["Edit"] }), "hebrew")).toEqual([]);
    expect(hebrewWords("Edit the Media")).toEqual(["edit", "media"]);
  });

  it("motion (M6): something that moves under reduced motion fails, nothing moving passes", () => {
    expect(only(page({ motion: ["div.a-spin animation a-spin"] }), "motion")).toEqual(["motion|/admin/x|desktop|div.a-spin animation a-spin"]);
    expect(only(page({ motion: [] }), "motion")).toEqual([]);
  });

  it("every rule in the list is covered above", () => {
    expect(RULES).toEqual(["sticky", "h1", "dup-head", "dup-text", "overflow", "gap", "overlap", "target", "icon-label", "destructive", "hebrew", "motion"]);
  });
});

describe("admin rules: the baseline only shrinks", () => {
  it("compare: a new finding is added, a fixed one is stale", () => {
    expect(compare(["a", "b"], ["a"])).toEqual({ added: ["b"], stale: [] });
    expect(compare(["a"], ["a", "b"])).toEqual({ added: [], stale: ["b"] });
  });
  it("shrink removes fixed lines and refuses to add one", () => {
    expect(shrink(["a", "b"], ["a"])).toEqual(["a"]);
    expect(() => shrink(["a"], ["a", "b"])).toThrow(/shrink-only/);
  });

  /* The ceiling per rule is today's count. Fix an offender: delete its line AND lower the number. Never raise one. */
  const CEILING: Record<string, number> = { sticky: 0, h1: 5, "dup-head": 0, "dup-text": 0, overflow: 0, gap: 24, overlap: 0, target: 0, "icon-label": 0, destructive: 0, hebrew: 46, motion: 0 };
  const lines: string[] = JSON.parse(readFileSync(resolve(__dirname, "../../../../scripts/a11y/admin-rules-baseline.json"), "utf8"));

  it("is sorted, unique and every line names a known rule and a route", () => {
    expect(lines).toEqual([...new Set(lines)].sort());
    for (const l of lines) expect(l, l).toMatch(new RegExp(`^(${RULES.join("|")})\\|(/admin[^|]*|\\*)\\|`));
  });
  it("holds no more lines per rule than today", () => {
    const per = Object.fromEntries(RULES.map((r: string) => [r, lines.filter((l) => l.startsWith(r + "|")).length]));
    for (const r of RULES) expect(per[r], `${r}: ${per[r]} lines, ceiling ${CEILING[r]}. The baseline lists today's offenders only; fix the new one.`).toBeLessThanOrEqual(CEILING[r]);
  });
  it("the ceiling is lowered when a line is deleted", () => {
    for (const r of RULES) expect(lines.filter((l) => l.startsWith(r + "|")).length, `${r}: lower its ceiling to the new count`).toBe(CEILING[r]);
  });
});
