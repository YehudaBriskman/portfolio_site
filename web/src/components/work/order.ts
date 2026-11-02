import type { ProjectEntry } from "@/hooks/useProjects";
import { FEATURED_BELOW } from "@/hooks/useProjects";
import { yearOf } from "@/components/projects/catalogue";
import type { ActivityEvent } from "@/services/activity";

/*
 * Work's order (#227): which projects are pinned, how the rest are sorted,
 * and which events belong to which card. No React, so it is tested bare.
 *
 * PINNED is the curation the site already had: a collection ordered under
 * `FEATURED_BELOW` is the one the owner put first (the old "in use" count).
 * Nothing new to keep in sync, and the home page's work run reads the same
 * flag.
 *
 * THE SORT is a URL parameter, `?sort=`, so a sorted list can be linked and
 * survives Back. "Recently updated" is the default and is written as no
 * parameter at all, so `/projects` stays the canonical address.
 */

export const SORTS = ["updated", "newest", "name"] as const;
export type Sort = (typeof SORTS)[number];
export const DEFAULT_SORT: Sort = "updated";

export function readSort(params: URLSearchParams): Sort {
  const s = params.get("sort");
  return (SORTS as readonly string[]).includes(s ?? "") ? (s as Sort) : DEFAULT_SORT;
}

/** The address of the same view under another sort; the filters ride along. */
export function hrefSorted(search: string, sort: Sort): string {
  const p = new URLSearchParams(search);
  if (sort === DEFAULT_SORT) p.delete("sort");
  else p.set("sort", sort);
  const s = p.toString();
  return s ? `/projects?${s}` : "/projects";
}

export function isPinned(e: ProjectEntry): boolean {
  return e.collection.order < FEATURED_BELOW;
}

const time = (iso: string | null | undefined) => {
  const t = Date.parse(iso ?? "");
  return Number.isNaN(t) ? -Infinity : t;
};

/** The project's newest fact: its last push, else its latest release. */
export function updatedAt(e: ProjectEntry): string | null {
  const s = e.collection.stats;
  const a = s?.pushedAt ?? null;
  const b = s?.latestRelease?.publishedAt ?? null;
  if (!a) return b;
  if (!b) return a;
  return time(a) >= time(b) ? a : b;
}

export function sortEntries(entries: ProjectEntry[], sort: Sort, locale = "en-GB"): ProjectEntry[] {
  const byName = (a: ProjectEntry, b: ProjectEntry) =>
    a.collection.title.localeCompare(b.collection.title, locale, { sensitivity: "base" });
  const out = [...entries];
  if (sort === "name") return out.sort(byName);
  if (sort === "newest") {
    return out.sort(
      (a, b) =>
        (Number(yearOf(b)) || 0) - (Number(yearOf(a)) || 0) ||
        time(updatedAt(b)) - time(updatedAt(a)) ||
        byName(a, b)
    );
  }
  /* Recently updated. A project the repository knows nothing about has no
     date; it goes after every one that has, in the curated order. */
  return out.sort(
    (a, b) => time(updatedAt(b)) - time(updatedAt(a)) || a.collection.order - b.collection.order || byName(a, b)
  );
}

/** The feed's repository events, per area, newest first. */
export function eventsByArea(events: ActivityEvent[]): Map<string, ActivityEvent[]> {
  const out = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    if (!e.area || (e.kind !== "push" && e.kind !== "release")) continue;
    const list = out.get(e.area.slug) ?? [];
    list.push(e);
    out.set(e.area.slug, list);
  }
  for (const list of out.values()) list.sort((a, b) => time(b.at) - time(a.at));
  return out;
}

/*
 * The project page's tabs, in the URL as `?tab=`. Overview is the default and
 * is no parameter, so `/projects/bothy` is still the page every old link
 * meant.
 */
export const TABS = ["overview", "notes", "releases", "docs"] as const;
export type Tab = (typeof TABS)[number];

export function readTab(params: URLSearchParams): Tab {
  const t = params.get("tab");
  return (TABS as readonly string[]).includes(t ?? "") ? (t as Tab) : "overview";
}

export const tabId = (base: string, key: string) => `${base}-tab-${key}`;
export const panelId = (base: string, key: string) => `${base}-panel-${key}`;
