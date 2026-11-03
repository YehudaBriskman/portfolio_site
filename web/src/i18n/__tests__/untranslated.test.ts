// @vitest-environment node
/*
 * The test that fails on a UI string with no Hebrew (#248).
 *
 * `words.test.ts` proves every table has its Hebrew; this proves the strings
 * are in a table at all. It reads every component with the TypeScript parser
 * and fails on English written straight into the markup: text between tags,
 * and the attributes a reader hears or sees (`aria-label`, `title`,
 * `placeholder`, `alt`, `label`). Strings in code (`cond ? "Show" : "Hide"`)
 * are not seen by it; the tables and review carry those.
 *
 * Two lists say what is allowed:
 *
 *   ALLOW_LATIN  text that is the same in both languages: names, marks and
 *                symbols, from the glossary's `allowLatin` (#300).
 *   PENDING files not yet moved onto the tables. It only ever shrinks: a file
 *           on it that has become clean fails too, so it is taken off.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ALLOW_LATIN } from "../glossary";

const SRC = path.resolve(__dirname, "../..");

const ATTRS = new Set(["aria-label", "title", "placeholder", "alt", "label", "aria-description"]);

/*
 * Same in both languages: the glossary's keep-in-Latin list (#300). A string
 * passes when every Latin run in it is on that list ("GitHub", "Claude Code"),
 * so a name beside a mark or a number passes and a sentence does not.
 */
const latinOnly = (t: string) => {
  const runs = t.match(/[A-Za-z][A-Za-z0-9.+:-]*(?: [A-Za-z0-9][A-Za-z0-9.+:-]*)*/g) ?? ([] as string[]);
  return runs.every((r) => ALLOW_LATIN.has(r) || r.split(" ").every((w) => ALLOW_LATIN.has(w)));
};

/*
 * Not scanned at all: the shadcn primitives (no words of their own), and the
 * admin's forms, which are the owner's editing tool rather than the site. The
 * admin's chrome is scanned; its forms stay in English for now, as #248's
 * PR says.
 */
const SKIP_DIRS = ["components/ui/", "__tests__/", "test/"];
const SKIP_FILES = /^(pages\/Admin(?!Shell)[A-Za-z]*\.tsx|components\/admin\/(?!AdminShell)[^/]+\.tsx|components\/admin\/content\/.*|components\/LinkEditor\.tsx)$/;

const PENDING = new Set<string>([
]);

function files(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) files(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function english(file: string): string[] {
  const text = fs.readFileSync(file, "utf8");
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: string[] = [];
  const check = (s: string) => {
    const t = s.replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
    /* A path (`/blog`) is an address, the same in both languages. */
    const path = /^\/[\w./-]*$/.test(t);
    if (/[A-Za-z]{2}/.test(t) && !latinOnly(t) && !path) hits.push(t.slice(0, 60));
  };
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) check(n.getText());
    if (
      ts.isJsxAttribute(n) &&
      ATTRS.has(n.name.getText()) &&
      n.initializer &&
      ts.isStringLiteral(n.initializer)
    ) {
      check(n.initializer.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return hits;
}

const scanned = files(SRC)
  .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
  .filter((f) => !SKIP_DIRS.some((d) => f.startsWith(d) || f.includes(`/${d}`)))
  .filter((f) => !SKIP_FILES.test(f));

describe("no UI string is written in English only (#248)", () => {
  it("scans the components", () => {
    expect(scanned.length).toBeGreaterThan(50);
  });

  const untranslated: string[] = [];
  const nowClean: string[] = [];
  for (const f of scanned) {
    const hits = english(path.join(SRC, f));
    if (PENDING.has(f)) {
      if (hits.length === 0) nowClean.push(f);
    } else if (hits.length > 0) {
      untranslated.push(...hits.map((h) => `${f}: "${h}"`));
    }
  }

  it("every string in the markup comes from a word table", () => {
    expect(untranslated).toEqual([]);
  });

  it("the pending list only shrinks", () => {
    expect(nowClean).toEqual([]);
  });
});
