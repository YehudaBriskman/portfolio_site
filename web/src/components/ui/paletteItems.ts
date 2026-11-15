import type { ControlIcon } from "@/components/ui/IconButton";
import type { NavNode } from "@/components/ui/SidebarGroup";

/*
 * What the command palette lists and how it ranks it. Pure, so the palette's
 * component is only the dialog and the keys.
 */

export type PaletteGroup = "go" | "create";

export interface PaletteItem {
  id: string;
  label: string;
  /** Where it lives, drawn small beside the label and matched by the query ("Marketing / Settings"). */
  hint?: string;
  group: PaletteGroup;
  icon?: ControlIcon;
  /** Extra words the query may match that the label does not say. */
  keywords?: string;
  run: () => void;
}

/** Every leaf of the nav tree that has an address, parents named in the hint. A heading with no address is only a hint. */
export function flattenNav(nodes: NavNode[], go: (to: string) => void, parents: string[] = []): PaletteItem[] {
  const out: PaletteItem[] = [];
  for (const n of nodes) {
    const to = n.to;
    if (to) out.push({ id: n.id, label: n.label, hint: parents.length ? parents.join(" / ") : undefined, group: "go", icon: n.icon, run: () => go(to) });
    if (n.children?.length) out.push(...flattenNav(n.children, go, [...parents, n.label]));
  }
  return out;
}

const norm = (s: string) => s.toLocaleLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");

/** 0 starts with it, 1 a word starts with it, 2 contains it, 3 only the hint or keywords have it. */
function score(item: PaletteItem, token: string): number {
  const label = norm(item.label);
  if (label.startsWith(token)) return 0;
  if (label.split(/[\s/\-_]+/).some((w) => w.startsWith(token))) return 1;
  if (label.includes(token)) return 2;
  return 3;
}

/** Items matching every word of the query, best first; no query is the list as given. Stable. */
export function rankItems(items: PaletteItem[], query: string): PaletteItem[] {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return items;
  const hits: Array<{ item: PaletteItem; rank: number; at: number }> = [];
  items.forEach((item, at) => {
    const hay = norm(`${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`);
    if (!tokens.every((t) => hay.includes(t))) return;
    hits.push({ item, rank: Math.max(...tokens.map((t) => score(item, t))), at });
  });
  return hits.sort((a, b) => a.rank - b.rank || a.at - b.at).map((h) => h.item);
}

/* ───────────────────────────────────────────────────────── recent */

const RECENT_KEY = "admin-palette-recent";
export const RECENT_MAX = 5;

export function readRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(id: string): void {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* blocked storage: the palette works, it just does not remember */
  }
}
