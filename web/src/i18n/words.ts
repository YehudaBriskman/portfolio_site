import { INTL, useLang, type Lang } from "@/components/dashboard/i18n";

/*
 * The site's words, in both languages (#248).
 *
 * One small mechanism rather than a library. Each part of the site defines
 * its table once, English first, and gets back a hook:
 *
 *   export const useFooterWords = defineWords("footer", { pages: "Pages" }, { pages: "עמודים" });
 *   const w = useFooterWords();   // w.pages
 *
 * The Hebrew table is typed from the English one, so a key added to English
 * and not to Hebrew is a type error, not a string that quietly renders in
 * English on a Hebrew page. Every table is also registered here, and
 * `__tests__/words.test.ts` walks all of them: a Hebrew entry that is empty,
 * or carries no Hebrew letter and is not on its short list of names kept in
 * Latin, fails the build.
 *
 * The language is the document's own — `lang` on <html>, which
 * `routing.ts` sets from the address — so a table needs no provider and the
 * dashboards' existing `useLang` is the one subscription.
 */

/** A string, or a function of anything that returns one, in the Hebrew table. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : { [K in keyof T]: Widen<T[K]> };

export type WordTable<T> = { name: string; en: T; he: T };

const registry = new Map<string, WordTable<unknown>>();

/** Every table defined so far, for the completeness test. */
export function allWordTables(): WordTable<unknown>[] {
  return [...registry.values()];
}

export type WordsHook<T> = (() => T) & { of: (lang: Lang) => T; table: WordTable<T> };

export function defineWords<T extends object>(name: string, en: T, he: Widen<T>): WordsHook<T> {
  const table: WordTable<T> = { name, en, he: he as unknown as T };
  registry.set(name, table as WordTable<unknown>);
  const use = () => table[useLang()];
  return Object.assign(use, { of: (lang: Lang) => table[lang], table });
}

/* ───────────────────────────────────────────────────────── plurals */

export type PluralForms = { one: string; two?: string; other: string };

/**
 * Picks the plural form `Intl.PluralRules` names for `n`.
 *
 * Hebrew has three categories — one, two and other — so a word with a dual
 * (יומיים, שעתיים) gets it, and a word without one falls back to `other`
 * ("2 רשימות"). `{n}` in a form is replaced with the number, formatted for
 * the language.
 */
export function plural(lang: Lang, n: number, forms: PluralForms): string {
  const rule = new Intl.PluralRules(INTL[lang]).select(n);
  const form = rule === "one" ? forms.one : rule === "two" ? (forms.two ?? forms.other) : forms.other;
  return form.replace("{n}", new Intl.NumberFormat(INTL[lang]).format(n));
}

/* ───────────────────────────────────────────────────────── arrows */

/**
 * The arrow that points onward, and the one that points back, in the reading
 * direction. A "→" written into the markup points backwards on a Hebrew page.
 */
export const ARROWS: Record<Lang, { on: string; back: string; out: string }> = {
  en: { on: "→", back: "←", out: "↗" },
  he: { on: "←", back: "→", out: "↖" },
};

/** A date in the reader's language, from an ISO string; "" for no date. */
export function dateIn(lang: Lang, iso: string | null | undefined, options: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  const when = new Date(iso);
  return Number.isNaN(when.getTime()) ? "" : when.toLocaleDateString(INTL[lang], options);
}

/** A count in the reader's language. */
export function numberIn(lang: Lang, n: number): string {
  return new Intl.NumberFormat(INTL[lang]).format(n);
}

/* ───────────────────────────────────────────────────────── fallback */

const HEBREW = /[֐-׿]/;

/** Whether a string has any Hebrew in it. */
export function hasHebrew(text: string | null | undefined): boolean {
  return Boolean(text && HEBREW.test(text));
}

/** Left-to-right isolate and its closing pop (UAX #9): the run between them lays out LTR. */
export const LRI = "\u2066";
export const PDI = "\u2069";

/**
 * English standing in for missing Hebrew, as text that lays out left to right
 * wherever it lands.
 *
 * `inEnglish` below fixes this per element, and only where a component
 * remembered to spread it: /story's role lines did not, so on /he/story
 * "Still writing and reviewing code every day." printed with its full stop at
 * the left, the English run reordered by the RTL paragraph round it. This
 * fixes it in the string, at the one place a missing `he` becomes its `en`
 * (`content/convert.ts`, `pick`), so every surface the store's text reaches
 * (a paragraph, a list item, a heading, an `alt`) gets an isolated LTR run
 * whatever element it is put in. LRI…PDI is the plain-text form of
 * `<bdi dir="ltr">` / `unicode-bidi: isolate; direction: ltr`; the words of
 * `Written` are inline spans, which the bidi algorithm does not see, so the
 * isolate holds across them.
 *
 * Only text that needs it is wrapped: something with a Latin letter and no
 * Hebrew. A number is left alone, and so is text already isolated.
 */
export function ltrFallback(text: string): string {
  if (!text || hasHebrew(text) || !/[A-Za-z]/.test(text) || text.startsWith(LRI)) return text;
  return `${LRI}${text}${PDI}`;
}

/**
 * A sentence with its full stop, inside the isolate when the sentence is one:
 * "⁦Every new tab⁩" + "." would put the stop outside the LTR run, at the RTL
 * paragraph's end, which is the left: the bug `ltrFallback` exists to fix.
 */
export function withStop(text: string): string {
  if (text.endsWith(PDI)) return `${text.slice(0, -PDI.length)}.${PDI}`;
  return `${text}.`;
}

/**
 * The attributes for a piece of content that may have fallen back to English.
 *
 * Content from the store is optional in Hebrew and shows its English when the
 * Hebrew is missing. On a Hebrew page that English is marked `lang="en"
 * dir="ltr"`, so a screen reader pronounces it as English and it reads left
 * to right as an isolated run rather than being reordered by the paragraph
 * around it. On an English page, or for text that is Hebrew, nothing is
 * added.
 *
 * Spread onto the element that holds the text: `<p {...inEnglish(lang, s)}>`.
 */
export function inEnglish(
  lang: Lang,
  text: string | null | undefined,
): { lang?: "en"; dir?: "ltr" } {
  if (lang !== "he" || !text || hasHebrew(text) || !/[A-Za-z]/.test(text)) return {};
  return { lang: "en", dir: "ltr" };
}
