/*
 * The pure parts of the settings kit, kept out of the component files so they
 * can be tested and imported without pulling in React.
 */

export type SettingsItem = { id: string; label: string; info?: string };

/** A group with more controls than this, or any text field, is a sub-page; otherwise a half sheet. */
export const MAX_SHEET_CONTROLS = 4;

export function groupSurface(g: { controls: number; hasText?: boolean }): "sheet" | "page" {
  return g.hasText || g.controls > MAX_SHEET_CONTROLS ? "page" : "sheet";
}

/** The gist of a help text: up to the first full stop (or the whole text when there is none). */
export function firstSentence(text: string): string {
  const t = text.trim();
  const m = t.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : t).trim();
}

/** Items whose label or help text contains the query; an empty query matches all. */
export function matchItems<T extends SettingsItem>(items: readonly T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [...items];
  return items.filter((i) => `${i.label}\n${i.info ?? ""}`.toLocaleLowerCase().includes(q));
}
