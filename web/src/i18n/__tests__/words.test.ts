import { describe, expect, it } from "vitest";
import { allWordTables, hasHebrew, inEnglish, plural } from "../words";
import { HE_PREFIX, langOfPath, pathIn, stripLang } from "../routing";

/*
 * Every word table in `src/i18n/`, loaded eagerly so each registers itself.
 * A new table file is picked up by the glob without being listed here.
 */
import.meta.glob("../*.ts", { eager: true });

/*
 * Hebrew entries allowed to carry no Hebrew letter: names and marks that are
 * the same in both languages. Keyed `table.path`. Keep it short; a string on
 * this list is one a Hebrew reader sees in Latin letters.
 */
const KEPT_IN_LATIN = new Set<string>([]);

type Leaf = { path: string; value: unknown };

function leaves(value: unknown, path: string, out: Leaf[] = []): Leaf[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) leaves(v, path ? `${path}.${k}` : k, out);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => leaves(v, `${path}.${i}`, out));
  } else {
    out.push({ path, value });
  }
  return out;
}

/** A function entry is called with sample arguments: a count and a name. */
function sample(fn: (...args: unknown[]) => unknown): string {
  return String(fn(...Array.from({ length: Math.max(fn.length, 1) }, (_, i) => (i === 0 ? 3 : "X"))));
}

describe("the Hebrew word tables (#248)", () => {
  const tables = allWordTables();

  it("finds the tables", () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  for (const table of tables) {
    it(`${table.name}: every UI string has its Hebrew`, () => {
      const en = leaves(table.en, "");
      const he = new Map(leaves(table.he, "").map((l) => [l.path, l.value]));
      const missing: string[] = [];
      for (const { path, value: enValue } of en) {
        const value = he.get(path);
        const key = `${table.name}.${path}`;
        if (value === undefined || value === "") {
          missing.push(`${key}: missing`);
          continue;
        }
        if (typeof enValue !== typeof value) {
          missing.push(`${key}: not the same kind of entry as the English`);
          continue;
        }
        const text = typeof value === "function" ? sample(value as (...a: unknown[]) => unknown) : String(value);
        if (!hasHebrew(text) && !KEPT_IN_LATIN.has(key)) missing.push(`${key}: "${text}" has no Hebrew`);
      }
      expect(missing).toEqual([]);
    });
  }
});

describe("the language in the address", () => {
  it("reads /he and /he/... as Hebrew, and nothing else", () => {
    expect(langOfPath("/he")).toBe("he");
    expect(langOfPath("/he/blog")).toBe("he");
    expect(langOfPath("/hebrew")).toBe("en");
    expect(langOfPath("/blog/he")).toBe("en");
    expect(langOfPath("/")).toBe("en");
  });

  it("moves an address between the languages", () => {
    expect(pathIn("/", "he")).toBe(HE_PREFIX);
    expect(pathIn("/blog/x", "he")).toBe("/he/blog/x");
    expect(pathIn("/he/blog/x", "en")).toBe("/blog/x");
    expect(pathIn("/he", "en")).toBe("/");
    expect(stripLang("/he/projects")).toBe("/projects");
  });
});

describe("plurals and the English fallback", () => {
  it("uses Hebrew's dual where a word has one", () => {
    const forms = { one: "יום אחד", two: "יומיים", other: "{n} ימים" };
    expect(plural("he", 1, forms)).toBe("יום אחד");
    expect(plural("he", 2, forms)).toBe("יומיים");
    expect(plural("he", 5, forms)).toBe("5 ימים");
    expect(plural("en", 2, { one: "1 day", other: "{n} days" })).toBe("2 days");
  });

  it("marks English shown on a Hebrew page, and nothing else", () => {
    expect(inEnglish("he", "Every check must fail")).toEqual({ lang: "en", dir: "ltr" });
    expect(inEnglish("he", "כל בדיקה")).toEqual({});
    expect(inEnglish("he", "2019")).toEqual({});
    expect(inEnglish("en", "Every check")).toEqual({});
  });
});
