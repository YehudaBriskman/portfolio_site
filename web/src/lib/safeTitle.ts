/*
 * A title that is only whitespace or invisible characters names nothing, and
 * `title || slug` keeps it because the string is not empty. Strip what draws
 * nothing, then fall back to the slug, then to a word.
 *
 * Only the characters that are invisible on their own are removed (zero-width
 * space/non-joiner/joiner, word joiner, BOM, soft hyphen, bidi marks and
 * isolates); a joiner inside a real word still makes the word non-blank.
 */
const INVISIBLE = new Set([0x00ad, 0x034f, 0xfeff]);
const invisible = (c: number): boolean =>
  INVISIBLE.has(c) || (c >= 0x200b && c <= 0x200f) || (c >= 0x202a && c <= 0x202e) || (c >= 0x2060 && c <= 0x2064) || (c >= 0x2066 && c <= 0x2069);

const blank = (s: string | null | undefined): boolean =>
  typeof s !== "string" || [...s].every((ch) => /\s/u.test(ch) || invisible(ch.codePointAt(0) ?? 0));

export function titleOf(title: string | null | undefined, slug?: string | null, fallback = "Untitled"): string {
  if (!blank(title)) return title as string;
  if (!blank(slug)) return slug as string;
  return fallback;
}
