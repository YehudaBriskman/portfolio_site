import { stateKey } from "@/content/schema";
import type { ProjectEntry } from "@/hooks/useProjects";
import { FEATURED_BELOW } from "@/hooks/useProjects";
import {
  facetOptions,
  matchesSelection,
  type FacetOption,
  type Selection,
} from "@/components/gallery/facets";

/*
 * The catalogue's facts: what a project's year, stack and size are, and how
 * the three filters narrow the set. No React here, so all of it is tested
 * without a renderer. The URL and counting rules are the gallery's, shared
 * with /blog, and argued in `gallery/facets.ts`.
 *
 * THE FILTERS (#175, #193)
 * ------------------------
 * State, year and stack, each a facet of the URL (`?state=&year=&stack=`), so
 * a filtered view can be linked and survives Back. Since #193 each one takes
 * several values (`?stack=Go&stack=Rust` is Go or Rust) and is chosen in a
 * popover list rather than a row of chips, so the stack list no longer has to
 * be cut to fit a line: it lists every stack two projects share, the most
 * used first, and a stack only one project uses still filters from the URL.
 */

export type Facet = "state" | "year" | "stack";
export const FACETS: Facet[] = ["state", "year", "stack"];

export type Filters = Selection<Facet>;
export type { FacetOption };

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

export function valuesOf(entry: ProjectEntry, facet: Facet): string[] {
  if (facet === "state") return [entry.state];
  if (facet === "year") {
    const y = yearOf(entry);
    return y ? [y] : [];
  }
  return stackOf(entry);
}

export function matches(entry: ProjectEntry, filters: Filters, except?: Facet): boolean {
  return matchesSelection(entry, filters, FACETS, valuesOf, except);
}

export function applyFilters(entries: ProjectEntry[], filters: Filters): ProjectEntry[] {
  return entries.filter((e) => matches(e, filters));
}

export function optionsFor(entries: ProjectEntry[], facet: Facet, filters: Filters): FacetOption[] {
  return facetOptions(
    entries,
    facet,
    filters,
    FACETS,
    valuesOf,
    facet === "year" ? { order: "desc" } : facet === "stack" ? { order: "count", min: 2 } : {}
  );
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

const ACTIVE = new Set(["live", "in-use", "open-source"]);

export function sizesOf(entries: ProjectEntry[]): Map<string, Size> {
  const newest = Math.max(0, ...entries.map((e) => Number(yearOf(e)) || 0));
  const out = new Map<string, Size>();
  for (const e of entries) {
    const recent = newest > 0 && (Number(yearOf(e)) || 0) >= newest - 1;
    const featured = e.collection.order < FEATURED_BELOW;
    const active = ACTIVE.has(stateKey(e.state));
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
  const s = stateKey(state);
  if (s === "live") return "live";
  if (s === "in-use") return "use";
  if (s === "open-source") return "open";
  if (/^v\d/i.test(s)) return "release";
  return "rest";
}
