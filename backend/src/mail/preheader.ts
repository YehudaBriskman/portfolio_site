import type { MailBlock } from "./render.js";

/*
 * The hidden preview line clients show beside the subject. When the owner left
 * it empty, a client would otherwise show whatever comes first in the HTML
 * (often "פרסומת" or a button label). This takes the first real paragraph of
 * the body, one line, at most 100 characters. Rendering only: it adds no
 * visible text and is never stored.
 */
export const PREHEADER_MAX = 100;

const textOf = (t: string | Array<string | { text: string }>) => (typeof t === "string" ? t : t.map((p) => (typeof p === "string" ? p : p.text)).join(""));

export function autoPreheader(blocks: MailBlock[]): string {
  for (const b of blocks) {
    if (b.type !== "paragraph" || b.tone === "strong" || b.tone === "kicker" || b.htmlOnly) continue;
    const line = textOf(b.text).replace(/\s+/g, " ").trim();
    if (line) return line.length <= PREHEADER_MAX ? line : `${line.slice(0, PREHEADER_MAX - 1).trimEnd()}…`;
  }
  return "";
}
