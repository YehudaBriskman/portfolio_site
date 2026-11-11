import { PREVIEW_LIMITS as L } from "./constants";
import { cardOf, type LinkCard, type LinkMeta } from "./linkedin";
import { codePoints, cpLength, URL_RE } from "./text";

export type XPreview = {
  count: number;
  limit: number;
  over: boolean;
  /** One entry when the post fits; otherwise a suggested thread, each within the limit. */
  thread: string[];
  card: LinkCard | null;
};

/** Characters a post costs on X: code points, every link counted as 23. */
export const countX = (text: string): number => cpLength(text.replace(URL_RE, "x".repeat(L.xLinkWeight)));

/** Splits one unbroken non-link run that is longer than a post, by code point. */
function hardSplit(word: string, budget: number): string[] {
  const cps = codePoints(word);
  const out: string[] = [];
  for (let i = 0; i < cps.length; i += budget) out.push(cps.slice(i, i + budget).join(""));
  return out;
}

function split(text: string, budget: number): string[] {
  const posts: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) posts.push(cur.trim());
    cur = "";
  };
  /* Runs of words and runs of whitespace; a link is one word, so it is never cut. */
  for (const token of text.match(/\S+|\s+/gu) ?? []) {
    const isSpace = /^\s/u.test(token);
    if (isSpace) {
      if (cur) cur += token;
      continue;
    }
    if (countX(token) > budget) {
      flush();
      const parts = hardSplit(token, budget);
      parts.slice(0, -1).forEach((p) => posts.push(p));
      cur = parts[parts.length - 1];
      continue;
    }
    if (cur && countX(cur + token) > budget) flush();
    cur += token;
  }
  flush();
  return posts;
}

/* The count and limit are X's own rules; the thread is only a suggestion. */
export function previewX(text: string, meta: LinkMeta = {}): XPreview {
  const count = countX(text);
  const card = cardOf(meta);
  if (count <= L.x) return { count, limit: L.x, over: false, thread: text ? [text] : [], card };
  let parts = split(text, L.x - 6);
  if (parts.length > 9) parts = split(text, L.x - L.xThreadSuffixReserve);
  const n = parts.length;
  return {
    count,
    limit: L.x,
    over: true,
    thread: n > 1 ? parts.map((p, i) => `${p} (${i + 1}/${n})`) : parts,
    card,
  };
}
