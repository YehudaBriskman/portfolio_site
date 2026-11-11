/*
 * The pure half of an area's history (#225): the short id, the day groups,
 * the "updated" test, the topic breakdown, and a note's address (sharing itself
 * lives in `lib/share`). No React here, so
 * every rule is a unit test away.
 */

/* ─────────────────────────────────────────────────────────────── id */

/**
 * A note's short id, like a short commit hash: seven hex digits of a 32-bit
 * FNV-1a over the slug. Stable for as long as the slug is, which is the only
 * thing a permalink depends on as well, and the same in every browser — it is
 * a label to recognise a note by, not a key the site resolves.
 */
export function noteId(slug: string): string {
  let h = 2166136261;
  for (const ch of new TextEncoder().encode(slug)) {
    h ^= ch;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 7);
}

/* ─────────────────────────────────────────────────────────────── days */

export type Dated = { publishedAt?: string | null };

export type DayGroup<T> = {
  /** `YYYY-MM-DD` in the reader's time zone, or "" for undated notes. */
  day: string;
  /** Any one instant on that day, for formatting the heading. */
  at: string | null;
  items: T[];
};

/** The calendar day an instant falls on where the reader is. */
export function dayKey(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Notes grouped by the day they went out, newest day first and newest note
 * first inside a day — GitHub's "Commits on 2 Nov 2026". Undated notes are
 * one group at the end rather than lost.
 */
export function groupByDay<T extends Dated>(items: T[], timeZone?: string): DayGroup<T>[] {
  const sorted = [...items].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const groups: DayGroup<T>[] = [];
  for (const item of sorted) {
    const day = item.publishedAt ? dayKey(item.publishedAt, timeZone) : "";
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, at: day ? item.publishedAt : null, items: [item] });
  }
  return groups;
}

/* ─────────────────────────────────────────────────────────────── updated */

/** Saves within this long of publishing are the publishing, not a change. */
export const SETTLE_MS = 60 * 60 * 1000;

/** True when a note was saved again well after it went out. */
export function wasUpdated(p: { publishedAt?: string | null; updatedAt?: string | null }): boolean {
  if (!p.publishedAt || !p.updatedAt) return false;
  const pub = Date.parse(p.publishedAt);
  const upd = Date.parse(p.updatedAt);
  if (Number.isNaN(pub) || Number.isNaN(upd)) return false;
  return upd - pub > SETTLE_MS;
}

/* ─────────────────────────────────────────────────────────────── topics */

export type TopicShare = { tag: string; count: number };

/**
 * How the area's notes divide by topic, biggest first and alphabetical on a
 * tie, with everything past `keep` folded into one "other" share so the bar
 * stays readable. A note with three topics counts once for each.
 */
export function topicBreakdown(items: { tags: string[] }[], keep = 4): { shares: TopicShare[]; other: number; total: number } {
  const counts = new Map<string, number>();
  for (const p of items) for (const t of new Set(p.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const all = [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  const shares = all.slice(0, keep);
  const other = all.slice(keep).reduce((n, s) => n + s.count, 0);
  return { shares, other, total: shares.reduce((n, s) => n + s.count, other) };
}

/* ─────────────────────────────────────────────────────────────── sharing */

export function permalink(slug: string, origin: string): string {
  return `${origin}/blog/${encodeURIComponent(slug)}`;
}

/* ─────────────────────────────────────────────────────────────── keys */

/**
 * Where `j` or `k` moves from `current` in a list of `length`: one step,
 * clamped at both ends. From nowhere (-1), `j` enters at the top and `k`
 * at the bottom.
 */
export function stepIndex(current: number, delta: 1 | -1, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + delta));
}

/** A key press that belongs to something else: typing, a modifier, a menu. */
export function isForeignKey(e: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "target">): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey) return true;
  const el = e.target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  if (el.isContentEditable) return true;
  return el.closest("input, textarea, select, [contenteditable], dialog[open], [role='menu']") !== null;
}
