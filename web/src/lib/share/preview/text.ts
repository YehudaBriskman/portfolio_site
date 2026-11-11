/** Counting and cutting text the way a reader sees it: by code point, not UTF-16 unit. */

export const URL_RE = /https?:\/\/[^\s]+/g;

export const codePoints = (s: string): string[] => Array.from(s);

export const cpLength = (s: string): number => {
  let n = 0;
  for (const _ of s) n++;
  return n;
};

/** The first `n` code points; never splits a surrogate pair. */
export const takeCp = (s: string, n: number): string => codePoints(s).slice(0, Math.max(0, n)).join("");

/** `example.com` from a link, without `www.`; the raw text when it is not a link. */
export function domainOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Cuts `text` to at most `max` code points at a word boundary: the cut falls on
 * whitespace, never inside a word or a link. A single run longer than `max`
 * (a very long link) is kept whole when it starts before the cut, because a
 * platform shows a link in full rather than half of it.
 */
export function cutAtWord(text: string, max: number): { head: string; cut: boolean } {
  if (cpLength(text) <= max) return { head: text, cut: false };
  const cps = codePoints(text);
  let end = max;
  /* Inside a word: the character at the cut and the one before are both non-space. */
  if (!/\s/u.test(cps[end] ?? " ") && !/\s/u.test(cps[end - 1] ?? " ")) {
    let back = end;
    while (back > 0 && !/\s/u.test(cps[back - 1])) back--;
    if (back > 0) end = back;
    else {
      /* One unbroken run: keep it whole up to the next whitespace. */
      end = cps.findIndex((c, i) => i >= max && /\s/u.test(c));
      if (end < 0) return { head: text, cut: false };
    }
  }
  const head = cps.slice(0, end).join("").trimEnd();
  return { head, cut: head.length < text.length };
}

export const hashtagsOf = (text: string): string[] =>
  Array.from(text.matchAll(/(?<![\p{L}\p{N}_&#/])#[\p{L}\p{N}_]+/gu), (m) => m[0]);

/** Only http(s) and same-origin paths ever reach an <img>. */
export const safeSrc = (src: string | undefined): string => (src && /^(https?:\/\/|\/(?!\/))/i.test(src) ? src : "");
