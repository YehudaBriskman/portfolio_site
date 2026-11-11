import type { AnnounceChannel, AnnounceLang } from "@/services/adminAnnounce";

/*
 * Template variables and how a template reads against a sample. One pass over
 * the text, so a value that happens to contain "{url}" is not expanded again
 * (the server's kit does the same). {first_name} is for mail to a person; the
 * kit does not fill it for the owner's own captions, so the preview shows a
 * sample name and the picker says so.
 */

export const OWNER_VARS = ["title", "summary", "url", "tags", "version", "site", "first_name"] as const;
export const VISITOR_VARS = ["title", "summary", "url", "tags", "version", "site"] as const;
export type VarName = (typeof OWNER_VARS)[number];
export type Vars = Record<VarName, string>;

const RE = /\{(title|summary|url|tags|version|site|first_name)\}/g;

export const fill = (text: string, vars: Vars) => text.replace(RE, (_m, k: VarName) => vars[k] ?? "");

/** The same tidy-up the server applies to a finished caption. */
export const tidy = (text: string) => text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

export const SAMPLE: Record<AnnounceLang, Vars> = {
  en: {
    title: "Notes on building in public",
    summary: "What I learned shipping a small site every week, and what I would skip next time.",
    url: "https://example.com/notes/building-in-public",
    tags: "#buildinpublic #webdev",
    version: "v1.6.0",
    site: "example.com",
    first_name: "Dana",
  },
  he: {
    title: "הערות על בנייה בפומבי",
    summary: "מה למדתי מלהעלות אתר קטן כל שבוע, ומה הייתי מדלג עליו בפעם הבאה.",
    url: "https://example.com/he/notes/building-in-public",
    tags: "#buildinpublic #webdev",
    version: "v1.6.0",
    site: "example.com",
    first_name: "דנה",
  },
};

/** Inserts `piece` where the selection is, replacing it; returns the new text and where the caret goes. */
export function insertAt(value: string, piece: string, start: number, end: number) {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(s, Math.min(end, value.length));
  return { text: value.slice(0, s) + piece + value.slice(e), caret: s + piece.length };
}

export const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const PLAIN_CHANNELS: readonly AnnounceChannel[] = ["email", "gmail"];
