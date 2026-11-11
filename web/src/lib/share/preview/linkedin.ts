import { PREVIEW_LIMITS as L } from "./constants";
import { cpLength, cutAtWord, domainOf } from "./text";

export type LinkMeta = {
  url?: string;
  title?: string;
  description?: string;
  image?: string;
  locale?: "en" | "he";
};

export type LinkCard = { title: string; domain: string; image: string };

export type LinkedInPreview = {
  /** Every line of the post, as written. */
  lines: string[];
  /** The part shown before "see more" (all of it when `folded` is false). */
  visible: string;
  /** The part behind "see more". */
  hidden: string;
  folded: boolean;
  /** Code points shown before the fold. */
  foldAt: number;
  count: number;
  limit: number;
  over: boolean;
  card: LinkCard | null;
};

export const cardOf = (meta: LinkMeta): LinkCard | null =>
  meta.url || meta.title || meta.image
    ? { title: meta.title ?? "", domain: domainOf(meta.url), image: meta.image ?? "" }
    : null;

/* Approximate: the fold is the earlier of N lines and N characters, cut at a word. */
export function previewLinkedIn(text: string, meta: LinkMeta = {}): LinkedInPreview {
  const lines = text.split("\n");
  const count = cpLength(text);
  const byLines = lines.length > L.linkedinFoldLines ? lines.slice(0, L.linkedinFoldLines).join("\n") : text;
  const { head } = cutAtWord(byLines, L.linkedinFoldChars);
  const folded = head.length < text.length;
  return {
    lines,
    visible: folded ? head : text,
    hidden: folded ? text.slice(head.length).replace(/^\s+/u, "") : "",
    folded,
    foldAt: folded ? cpLength(head) : count,
    count,
    limit: L.linkedin,
    over: count > L.linkedin,
    card: cardOf(meta),
  };
}

