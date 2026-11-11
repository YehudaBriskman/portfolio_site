import type { ShareChannel } from "./types";

/** Platform caps in characters. Channels not listed have none. */
export const CHANNEL_LIMITS: Partial<Record<ShareChannel, number>> = {
  linkedin: 3000,
  instagram: 2200,
  x: 280,
};

/** X shortens every link to this many characters, whatever its length. */
const X_URL_WEIGHT = 23;

export const URL_RE = /https?:\/\/[^\s]+/g;

const ELLIPSIS = "…";

export function channelLimit(channel: ShareChannel): number | null {
  return CHANNEL_LIMITS[channel] ?? null;
}

const cpLength = (s: string): number => {
  let n = 0;
  for (const _ of s) n++;
  return n;
};

/** How many characters `text` costs on `channel`: code points, links weighted on X. */
export function countChars(text: string, channel?: ShareChannel): number {
  return cpLength(channel === "x" ? text.replace(URL_RE, "x".repeat(X_URL_WEIGHT)) : text);
}

function graphemes(s: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (g) => g.segment);
  }
  return Array.from(s);
}

/**
 * At most `max` code points, ending in an ellipsis when something was cut.
 * Cuts between grapheme clusters, so never inside a surrogate pair, an emoji
 * sequence or a letter with its marks.
 */
export function truncate(text: string, max: number): string {
  if (max <= 0) return "";
  if (cpLength(text) <= max) return text;
  let out = "";
  let used = 0;
  for (const g of graphemes(text)) {
    const n = cpLength(g);
    if (used + n > max - 1) break;
    out += g;
    used += n;
  }
  return `${out.trimEnd()}${ELLIPSIS}`;
}

/**
 * `truncate` for finished text: if the cut would land inside a link, the whole
 * link goes, so a half address never ships.
 */
export function truncateSafe(text: string, max: number, channel?: ShareChannel): string {
  if (countChars(text, channel) <= max) return text;
  let cut = truncate(text, max);
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const cutEnd = cut.length - ELLIPSIS.length;
    if (cutEnd > start && cutEnd < end) {
      cut = `${text.slice(0, start).trimEnd()}${ELLIPSIS}`;
      break;
    }
  }
  return cut;
}

/** Plain text from untrusted text: no tags, no control characters, one space between words. */
export function plain(input: string | undefined | null, keepNewlines = false): string {
  if (!input) return "";
  // Stripping can join the halves of a split tag ("<scr<b>ipt>"), so go until stable.
  let s = input;
  for (let i = 0; i < 10; i++) {
    const next = s.replace(/<\/?[a-zA-Z!][^>]*>/g, "");
    if (next === s) break;
    s = next;
  }
  s = s.replace(/<(?=[a-zA-Z!/])/g, "");
  // eslint-disable-next-line no-control-regex
  s = s.replace(keepNewlines ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]+/g, " ");
  return s.replace(/[ \t]+/g, " ").trim();
}

/** `#tag` words from topics: letters, digits and underscore only, so a tag is always one clickable word. */
export function hashtags(tags: readonly string[] | undefined, max = 5): string {
  const out: string[] = [];
  for (const t of tags ?? []) {
    const word = plain(t).replace(/[^\p{L}\p{N}_]+/gu, "");
    if (word && !out.some((o) => o.toLowerCase() === `#${word}`.toLowerCase())) out.push(`#${word}`);
    if (out.length >= max) break;
  }
  return out.join(" ");
}

export type Vars = { title: string; summary: string; url: string; tags: string; version: string; site: string };

const VAR_RE = /\{(title|summary|url|tags|version|site)\}/g;

/**
 * One pass over the template, so a value that happens to contain `{url}` is
 * not expanded again. Lines the variables left empty are dropped.
 */
export function renderTemplate(template: string, vars: Vars): string {
  return template
    .replace(VAR_RE, (_, k: keyof Vars) => vars[k])
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Renders a template within a cap. Gives up the summary first, then the tags,
 * then the title, each cut to just what is over, so the link and the framing
 * survive. Whatever still does not fit is cut as finished text.
 */
export function renderWithin(template: string, vars: Vars, max: number | null, channel: ShareChannel): string {
  let v = vars;
  let out = renderTemplate(template, v);
  if (max === null) return out;
  const fields: Array<"summary" | "tags" | "title"> = ["summary", "tags", "title"];
  for (const field of fields) {
    for (let i = 0; i < 6; i++) {
      const over = countChars(out, channel) - max;
      if (over <= 0) return out;
      const cur = v[field];
      if (!cur) break;
      const next = field === "tags" ? "" : truncate(cur, Math.max(0, cpLength(cur) - over));
      if (next === cur) break;
      v = { ...v, [field]: next };
      out = renderTemplate(template, v);
    }
  }
  return truncateSafe(out, max, channel);
}
