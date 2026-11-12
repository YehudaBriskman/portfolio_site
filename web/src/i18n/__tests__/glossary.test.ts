// @vitest-environment node
/*
 * The glossary lint (#300, glossary §5).
 *
 * Every Hebrew string written in the source is read with the TypeScript
 * parser (word tables, the server render's `seo-words.ts`, anything else) and
 * linted against `glossary.json`: a forbidden variant names the preferred
 * form; a prefix letter glued to Latin, or joined with a hyphen, wants the
 * maqaf; a Latin token takes no Hebrew plural; an apostrophe is not a geresh.
 *
 * Latin inside Hebrew that is not on the glossary's `allowLatin` is listed in
 * LATIN_SEEN below, the way the untranslated test's PENDING works: a new term
 * fails until it is either added to the glossary or acknowledged here, and an
 * entry nothing uses any more fails too, so the list only holds what is real.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ALLOW_LATIN, GLOSSARY, STRICT_FORBIDDEN, latinNotAllowed, lintHebrew } from "../glossary";

const SRC = path.resolve(__dirname, "../..");
const REPO = path.resolve(SRC, "../..");
const EXTRA = [path.join(REPO, "backend/src/services/seo-words.ts")];

/*
 * Latin inside Hebrew strings that is not a glossary term: code, ids, sample
 * values and names the glossary does not need to rule on. Keep it to what a
 * Hebrew reader may legitimately see in Latin letters.
 */
const LATIN_SEEN = new Set<string>([
  /* Key chords in the note editor's shortcut help (Ctrl+B is in the glossary). */
  "Ctrl+E",
  "Ctrl+I",
  "Ctrl+K",
  "Ctrl+S",
  "Ctrl+Shift+P",
  /* Hashtags in the starter pack's Hebrew snippet (library/starter.ts). */
  "typescript",
  "webdev",
  /* Claude's own menu names, quoted as the reader will see them (statement.ts mcp). */
  "Settings",
  "Connectors",
  "Add custom connector",
  /* OAuth scopes and a tool argument, quoted as typed. */
  "mcp:read",
  "mcp:write",
  "confirm: true",
  /* Service names and the two link-tag parameters, as the statement's sharing section names them. */
  "Instagram",
  "WhatsApp",
  "X",
  "utm",
  "source",
  "medium",
  /* The file format the audience import and export name, as it is written on a file. */
  "CSV",
  /* The conformance level, as the standard writes it. */
  "AA",
  /* The brand word, first in the hero's fact line in both languages (#347, data/site.ts). */
  "Portfolio",
  /*
   * The project write-ups (data/hebrew.ts): what Israeli developers say in
   * English and write in Latin in Hebrew prose, as the owner asked for them
   * (2026-11-04). Each is a practitioner's term with no Hebrew in use, or a
   * Kubernetes, git or release word that names the thing itself.
   */
  "chart",
  "charts",
  "code review",
  "deploy",
  "digest",
  "digests",
  "main",
  "manifest",
  "manifests",
  "namespace",
  "namespaces",
  "pod",
  "preprod",
  "push",
  "release",
  "release manifest",
  "Tailscale SSH",
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name !== "__tests__" && name !== "test") sourceFiles(full, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== "glossary.ts") out.push(full);
  }
  return out;
}

/** Every string literal and template piece in a file that holds a Hebrew letter. */
function hebrewStrings(file: string): string[] {
  const text = fs.readFileSync(file, "utf8");
  if (!/[א-ת]/.test(text)) return [];
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push(n.text);
    else if (ts.isJsxText(n)) out.push(n.getText());
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out.filter((s) => /[א-ת]/.test(s));
}

const files = [...sourceFiles(SRC), ...EXTRA];
const rel = (f: string) => path.relative(REPO, f).split(path.sep).join("/");
const strings = files.flatMap((f) => hebrewStrings(f).map((s) => ({ file: rel(f), s })));

describe("the glossary in the app (#300)", () => {
  it("is the glossary", () => {
    expect(GLOSSARY.version).toBe(1);
    expect(GLOSSARY.terms.length).toBeGreaterThan(100);
    expect(ALLOW_LATIN.has("GitHub")).toBe(true);
  });

  it("finds the Hebrew in the source", () => {
    expect(strings.length).toBeGreaterThan(500);
  });

  it("fails on sight only variants that have one sense", () => {
    const strict = new Set(STRICT_FORBIDDEN.map((f) => f.variant));
    expect(strict.has("רשומה")).toBe(true);
    expect(strict.has("מזלגות")).toBe(true);
    expect(strict.has("בקשת משיכה")).toBe(true);
    /* Right as "entry", wrong only as the sign-in button. */
    expect(strict.has("כניסה")).toBe(false);
    /* Right for a git tag. */
    expect(strict.has("תג")).toBe(false);
  });
});

describe("lintHebrew", () => {
  const rules = (s: string) => lintHebrew(s).map((i) => `${i.rule}:${i.match}`);

  it("names the preferred form of a forbidden variant, prefixed or not", () => {
    expect(lintHebrew("הרשומה נשמרה")).toEqual([{ rule: "forbidden", match: "הרשומה", use: "רשימה" }]);
    expect(rules("שלוש בקשות משיכה")).toEqual(["forbidden:בקשות משיכה"]);
    expect(rules("כמה מזלגות")).toEqual(["forbidden:מזלגות"]);
  });

  it("does not match a variant inside a longer word", () => {
    expect(rules("רשימה חדשה")).toEqual([]);
    expect(rules("מאגר")).toEqual([]);
  });

  it("wants the maqaf between a prefix letter and Latin", () => {
    expect(rules("ב־GitHub")).toEqual([]);
    expect(rules("בGitHub")).toEqual(["prefix-glued:בGitHub"]);
    expect(rules("ב-GitHub")).toEqual(["hyphen-maqaf:ב-GitHub"]);
    expect(rules("מ־3 ימים")).toEqual([]);
    expect(lintHebrew("שלGitHub")[0].use).toBe("של־GitHub");
  });

  it("never inflects a Latin token", () => {
    expect(rules("שלושה PRים")).toContain("latin-suffix:Rים");
    expect(rules("שלושה PR פתוחים")).toEqual([]);
  });

  it("wants a geresh, not an apostrophe", () => {
    expect(rules("צ'אט")).toEqual(["apostrophe-geresh:צ'"]);
    expect(rules("צ׳אט")).toEqual([]);
  });

  it("ignores a string with no Hebrew", () => {
    expect(lintHebrew("a note on PRs")).toEqual([]);
  });

  it("lists Latin runs that are not on the allowlist", () => {
    expect(latinNotAllowed("ב־GitHub וב־Claude Desktop")).toEqual([]);
    expect(latinNotAllowed("פתחו את Settings → Connectors")).toEqual(["Settings", "Connectors"]);
  });
});

describe("every Hebrew string in the source follows the glossary (#300)", () => {
  it("has no forbidden variant, glued prefix, inflected Latin or apostrophe geresh", () => {
    const issues = strings.flatMap(({ file, s }) =>
      lintHebrew(s).map((i) => `${file}: ${i.rule} "${i.match}"${i.use ? ` → ${i.use}` : ""}  in "${s.slice(0, 70)}"`),
    );
    expect(issues).toEqual([]);
  });

  const seen = new Set(strings.flatMap(({ s }) => latinNotAllowed(s)));

  it("shows in Latin only what the glossary allows or LATIN_SEEN acknowledges", () => {
    expect([...seen].filter((r) => !LATIN_SEEN.has(r)).sort()).toEqual([]);
  });

  it("acknowledges nothing that is no longer there", () => {
    expect([...LATIN_SEEN].filter((r) => !seen.has(r))).toEqual([]);
  });
});
