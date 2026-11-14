/*
 * Dates from the API are strings, and one that does not parse makes
 * `Intl.DateTimeFormat#format` throw a RangeError out of a render, which blanks
 * the screen. Every admin date helper goes through here instead.
 */

export const UNKNOWN_WHEN = { en: "unknown", he: "לא ידוע" } as const;

const LOCALE = { en: "en-GB", he: "he-IL" } as const;

/** A Date for a real timestamp, null for anything else. */
export function parseWhen(iso: string | null | undefined): Date | null {
  if (typeof iso !== "string" || iso.trim() === "") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The page's language, read from <html lang> like the rest of the admin. */
export function docLang(): "en" | "he" {
  return typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("he") ? "he" : "en";
}

/**
 * The timestamp in the reader's language: "" when there is none, the word
 * "unknown" when there is one that cannot be read (a word, not a dash, so it
 * reads right inside a sentence and a screen reader says it).
 */
export function formatWhen(iso: string | null | undefined, lang: "en" | "he", options: Intl.DateTimeFormatOptions): string {
  if (iso === null || iso === undefined || iso === "") return "";
  const d = parseWhen(iso);
  return d ? new Intl.DateTimeFormat(LOCALE[lang], options).format(d) : UNKNOWN_WHEN[lang];
}
