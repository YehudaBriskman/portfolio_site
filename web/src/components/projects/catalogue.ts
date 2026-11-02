import type { ProjectEntry } from "@/hooks/useProjects";
import { FEATURED_BELOW } from "@/hooks/useProjects";

/*
 * The catalogue's facts: what a project's year, stack and size are, and how
 * the three filters narrow the set. No React here, so all of it is tested
 * without a renderer.
 *
 * THE FILTERS (#175)
 * ------------------
 * State, year and stack, each a facet of the URL (`?state=&year=&stack=`), so
 * a filtered view can be linked and survives Back. They are always on screen.
 * #169 hid the state filter until nine projects; the owner asked for them
 * outright, and a gallery of mixed sizes is harder to scan by eye than a
 * register was, so the filters are now how a reader narrows it, not a
 * concession to a long list.
 *
 * Each chip's count is the number of projects it would show given the OTHER
 * two filters, so a count is the honest answer to "what happens if I press
 * this" and a zero is visible before it is pressed.
 */

export type Facet = "state" | "year" | "stack";
export const FACETS: Facet[] = ["state", "year", "stack"];

export type Filters = Partial<Record<Facet, string>>;

/** An API-only collection has no seeded year; its last push is the nearest honest one. */
export function yearOf(entry: ProjectEntry): string | null {
  return entry.year ?? entry.collection.stats?.pushedAt?.slice(0, 4) ?? null;
}

/** The seed's stack, or the one language the repository reports. */
export function stackOf(entry: ProjectEntry): string[] {
  if (entry.tech.length > 0) return entry.tech;
  const lang = entry.collection.stats?.language;
  return lang ? [lang] : [];
}

function valuesOf(entry: ProjectEntry, facet: Facet): string[] {
  if (facet === "state") return [entry.state];
  if (facet === "year") {
    const y = yearOf(entry);
    return y ? [y] : [];
  }
  return stackOf(entry);
}

export function matches(entry: ProjectEntry, filters: Filters, except?: Facet): boolean {
  return FACETS.every((f) => f === except || !filters[f] || valuesOf(entry, f).includes(filters[f]!));
}

export function applyFilters(entries: ProjectEntry[], filters: Filters): ProjectEntry[] {
  return entries.filter((e) => matches(e, filters));
}

export type FacetOption = { value: string; count: number };

/*
 * The stack list is the one that grows without bound — every project brings
 * its own libraries — so it is cut to the ones that group something: used by
 * two projects or more, at most `STACK_CHIPS` of them. A stack outside that
 * cut still filters from the URL; it just has no chip unless it is the one
 * selected.
 */
export const STACK_CHIPS = 10;

export function optionsFor(entries: ProjectEntry[], facet: Facet, filters: Filters): FacetOption[] {
  const all = new Map<string, number>();
  const narrowed = new Map<string, number>();
  for (const e of entries) {
    const hit = matches(e, filters, facet);
    for (const v of valuesOf(e, facet)) {
      all.set(v, (all.get(v) ?? 0) + 1);
      if (hit) narrowed.set(v, (narrowed.get(v) ?? 0) + 1);
    }
  }
  let values = [...all.keys()];
  if (facet === "year") values.sort((a, b) => b.localeCompare(a));
  if (facet === "stack") {
    values.sort((a, b) => all.get(b)! - all.get(a)! || a.localeCompare(b));
    values = values.filter((v) => all.get(v)! > 1).slice(0, STACK_CHIPS);
  }
  const active = filters[facet];
  if (active && !values.includes(active)) values.push(active);
  return values.map((value) => ({ value, count: narrowed.get(value) ?? 0 }));
}

/** The URL for the current filters with one facet set, or cleared when it is already the active one. */
export function hrefWith(filters: Filters, facet: Facet, value: string | null): string {
  const next: Filters = { ...filters, [facet]: value ?? undefined };
  const params = new URLSearchParams();
  for (const f of FACETS) if (next[f]) params.set(f, next[f]!);
  const q = params.toString();
  return q ? `/projects?${q}` : "/projects";
}

/*
 * THE SIZES
 * ---------
 * A gallery hangs its important pieces larger, and which piece is important
 * is a fact about the piece, not about where it lands. So size comes from
 * data, never from position:
 *
 *   lead  2 x 2   featured (curated, order under FEATURED_BELOW) and from the
 *                 newest two years on the list
 *   wide  2 x 1   in use or live and from those same two years, or featured
 *                 but older
 *   tile  1 x 1   everything else
 *
 * "Recent" is relative to the newest year on the list, not to today, so the
 * catalogue does not quietly shrink every tile on New Year's Day. A filter
 * does not change a project's size: it is computed over the whole set, so the
 * same project is the same size however the reader narrows the view.
 */
export type Size = "lead" | "wide" | "tile";

const ACTIVE = /live|in use|open source/i;

export function sizesOf(entries: ProjectEntry[]): Map<string, Size> {
  const newest = Math.max(0, ...entries.map((e) => Number(yearOf(e)) || 0));
  const out = new Map<string, Size>();
  for (const e of entries) {
    const recent = newest > 0 && (Number(yearOf(e)) || 0) >= newest - 1;
    const featured = e.collection.order < FEATURED_BELOW;
    const active = ACTIVE.test(e.state);
    out.set(e.collection.slug, featured && recent ? "lead" : (active && recent) || featured ? "wide" : "tile");
  }
  return out;
}

/*
 * A state's family, for the one dot of colour beside its word. The word is
 * always printed; the hue only groups (live, in use, open source, a release
 * tag, everything else), so nothing is told by colour alone.
 */
export type StateKind = "live" | "use" | "open" | "release" | "rest";

export function kindOf(state: string): StateKind {
  const s = state.toLowerCase();
  if (s.includes("live")) return "live";
  if (s.includes("in use")) return "use";
  if (s.includes("open")) return "open";
  if (/^v\d/.test(s)) return "release";
  return "rest";
}

export type Summary = {
  byState: FacetOption[];
  byYear: { year: number; count: number }[];
};

/** Counts by state, and projects per year with the empty years in between kept. */
export function summarise(entries: ProjectEntry[]): Summary {
  const states = new Map<string, number>();
  const years = new Map<number, number>();
  for (const e of entries) {
    states.set(e.state, (states.get(e.state) ?? 0) + 1);
    const y = Number(yearOf(e));
    if (y) years.set(y, (years.get(y) ?? 0) + 1);
  }
  const ys = [...years.keys()].sort((a, b) => a - b);
  const byYear: Summary["byYear"] = [];
  if (ys.length) for (let y = ys[0]; y <= ys.at(-1)!; y += 1) byYear.push({ year: y, count: years.get(y) ?? 0 });
  return {
    byState: [...states]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    byYear,
  };
}
