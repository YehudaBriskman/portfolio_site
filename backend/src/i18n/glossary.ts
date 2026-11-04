import glossary from "./glossary.json";

/*
 * The Hebrew tech glossary (#294), as the app reads it (#300).
 *
 * `glossary.json` is the single source: the policy and its table live in
 * docs/i18n/hebrew-tech-glossary.md, which is generated from it. This module
 * is the one reader. It gives the tests their allowlist and the lint they run
 * over every Hebrew string in the source, and it is what the admin's Hebrew
 * fields will run as advice while typing (design §7.7): the same rules, never a
 * block on saving.
 *
 * Import it from tests and the admin only. It pulls the whole JSON (sources and
 * rationale included), which no public page needs.
 */

export type ForbiddenVariant = { variant: string; use: string; term: string; note?: string };

export type GlossaryTerm = {
  term: string;
  aliases: string[];
  category: "A" | "B" | "C" | "D";
  he: string;
  he_plural?: string | null;
  he_definite?: string | null;
  gender?: string | null;
  contexts?: Record<string, string>;
  forbidden: string[];
};

export const GLOSSARY = glossary as unknown as {
  version: number;
  allowLatin: string[];
  forbidden: ForbiddenVariant[];
  terms: GlossaryTerm[];
};

/** The Latin terms a Hebrew page may show as they are (category A and the approved D forms). */
export const ALLOW_LATIN: ReadonlySet<string> = new Set(GLOSSARY.allowLatin);

/*
 * Variants the glossary forbids only in one sense, which a word match cannot
 * tell apart: `כניסה` is wrong as the sign-in button and right as "entry";
 * `תג` is wrong for a note's topic and right for a git tag; `נושא` is wrong for
 * an issue and right for a theme. The glossary marks most of them with a
 * `note`; the rest are listed here. They are left to review, and to the
 * admin's hints, rather than failed on sight.
 */
const IN_ONE_SENSE_ONLY = new Set([
  "נתונים",
  "תג",
  "טאג",
  "נושא",
  "לוג",
  "ערוץ",
  "היקף",
  "הפצה",
  "משלוח",
  "באוויר",
  "מבחן",
  "מבחנים",
  "צינור",
  "שלילה",
  "יציאה",
  "ביצוע",
  "מנהל",
  "נבחרות",
  "לנסות שוב",
  "דוא״ל",
  "מייל",
  "מסמכים",
  "ערימה",
  "מחסנית",
  "מיכל",
  "הרחבה",
  "קטגוריה",
  "עבודות",
  "ראש צוות",
  "יומן הערוץ",
  "Repository in Hebrew prose",
  "כתיבות הן הרצות יבשות",
]);

/* A note that only says how the variant is spelled is not a sense: still a variant to fail. */
const SPELLING_NOTE = /defective spelling|ASCII hyphen|with maqaf/;

/** The forbidden variants a lint can fail on sight, longest first so a phrase wins over its word. */
export const STRICT_FORBIDDEN: readonly ForbiddenVariant[] = GLOSSARY.forbidden
  .filter((f) => !IN_ONE_SENSE_ONLY.has(f.variant))
  .filter((f) => !f.note || SPELLING_NOTE.test(f.note))
  .filter((f, i, all) => all.findIndex((g) => g.variant === f.variant) === i)
  .sort((a, b) => b.variant.length - a.variant.length);

const HEB = "\\u05D0-\\u05EA";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*
 * A Hebrew word may carry up to two one-letter prefixes (ו, ש, ה, ב, כ, ל, מ)
 * glued to its front: `הרשומה`, `וברשומות`. A Latin variant matches as a word.
 */
const variantRe = new Map(
  STRICT_FORBIDDEN.map((f) => {
    const hebrew = /[א-ת]/.test(f.variant[0]);
    const before = hebrew ? `(?<![${HEB}])(?:[ושהבכלמ]{0,2}[־]?)` : `(?<![A-Za-z${HEB}])`;
    return [f.variant, new RegExp(`${before}${esc(f.variant)}(?![${HEB}A-Za-z])`, "u")];
  }),
);

export type LintIssue = {
  rule: "forbidden" | "prefix-glued" | "hyphen-maqaf" | "latin-suffix" | "apostrophe-geresh";
  /** The text that was matched. */
  match: string;
  /** What to write instead, when there is one answer. */
  use?: string;
};

/**
 * Lints one Hebrew string against the glossary's conventions (glossary §5).
 * Returns nothing for a string with no Hebrew letter.
 */
export function lintHebrew(text: string): LintIssue[] {
  if (!/[א-ת]/.test(text)) return [];
  const out: LintIssue[] = [];
  for (const f of STRICT_FORBIDDEN) {
    const m = variantRe.get(f.variant)!.exec(text);
    if (m) out.push({ rule: "forbidden", match: m[0], use: f.use });
  }
  /* בGitHub: a one-letter prefix glued to Latin or a digit, with no maqaf. */
  for (const m of text.matchAll(new RegExp(`(?<![${HEB}])[וש]?[בהוכלמ][A-Za-z0-9]+`, "gu"))) {
    out.push({ rule: "prefix-glued", match: m[0], use: m[0].replace(/^([וש]?[בהוכלמ])/u, "$1־") });
  }
  /* ב-GitHub, ב–3: a hyphen or dash where the maqaf goes. */
  for (const m of text.matchAll(new RegExp(`(?<![${HEB}])[וש]?[בהוכלמ][-–][A-Za-z0-9]+`, "gu"))) {
    out.push({ rule: "hyphen-maqaf", match: m[0], use: m[0].replace(/[-–]/, "־") });
  }
  /* PRים, API-ים: a Latin token never takes a Hebrew plural. */
  for (const m of text.matchAll(new RegExp(`[A-Za-z][-־]?(?:ים|ות)(?![${HEB}])`, "gu"))) {
    out.push({ rule: "latin-suffix", match: m[0] });
  }
  /* צ'אט: an ASCII apostrophe standing in for the geresh. */
  for (const m of text.matchAll(new RegExp(`[${HEB}]'`, "gu"))) {
    out.push({ rule: "apostrophe-geresh", match: m[0], use: `${m[0][0]}׳` });
  }
  return out;
}

/**
 * The Latin runs in a Hebrew string that are not on the allowlist. A run is a
 * stretch of Latin words, joined by spaces or the marks that sit inside a name
 * (`Claude Desktop`, `OAuth 2.1`, `claude.ai`).
 */
export function latinNotAllowed(text: string): string[] {
  if (!/[א-ת]/.test(text)) return [];
  /* A placeholder, a code span, a wikilink, an address or a path is not words a reader is asked to read as prose. */
  const prose = text.replace(/\{\w+\}|`[^`]*`|\[\[[^\]]*\]\]|https?:\/\/\S*|[\w.+-]+@[\w.-]+|(?<![\w.])\/[\w./-]+/g, " ");
  const runs = prose.match(/[A-Za-z][A-Za-z0-9.+:/-]*(?: [A-Za-z0-9][A-Za-z0-9.+:/-]*)*/g) ?? ([] as string[]);
  return runs
    .map((r) => r.replace(/[.:/-]+$/, ""))
    .filter((r) => !ALLOW_LATIN.has(r) && !r.split(" ").every((w) => ALLOW_LATIN.has(w) || /^[\d.]+$/.test(w)));
}
