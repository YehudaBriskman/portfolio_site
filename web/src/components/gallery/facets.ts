/*
 * Facets, for any gallery (#193): the URL is the state, every facet takes
 * several values, and a count says what a choice would show before it is made.
 *
 * Shared by /projects (state, year, stack) and /blog (topic, year, filed
 * under). No React here, so all of it is tested without a renderer.
 *
 * THE RULES
 * ---------
 * - A facet is a query parameter, repeated for each value it holds:
 *   `?stack=Go&stack=Rust`. A link from before #193 (`?stack=Go`) is the
 *   one-value case of the same thing, so it still works.
 * - Inside a facet the values are alternatives (Go OR Rust); between facets
 *   they narrow (Go AND 2024). That is what a reader means by ticking two
 *   boxes in one list and one in another.
 * - An option's count is the number of items it would add to the view given
 *   the OTHER facets, so a zero is visible before it is pressed.
 * - A value the data no longer offers (a stale link) is honoured and listed,
 *   so the reader can see it and take it off.
 */

export type Selection<F extends string = string> = Partial<Record<F, string[]>>;

export type FacetOption = { value: string; count: number };

export type ValuesOf<T, F extends string> = (item: T, facet: F) => string[];

export function readSelection<F extends string>(params: URLSearchParams, facets: readonly F[]): Selection<F> {
  const out: Selection<F> = {};
  for (const f of facets) {
    const values = [...new Set(params.getAll(f).map((v) => v.trim()).filter(Boolean))];
    if (values.length) out[f] = values;
  }
  return out;
}

export function activeCount<F extends string>(sel: Selection<F>): number {
  return Object.values<string[] | undefined>(sel).reduce((n, v) => n + (v?.length ?? 0), 0);
}

export function matchesSelection<T, F extends string>(
  item: T,
  sel: Selection<F>,
  facets: readonly F[],
  valuesOf: ValuesOf<T, F>,
  except?: F
): boolean {
  return facets.every((f) => {
    const want = sel[f];
    if (f === except || !want?.length) return true;
    const have = valuesOf(item, f);
    return want.some((v) => have.includes(v));
  });
}

export type OptionRules<T = unknown> = {
  /** How the values are ordered: newest first for a year, most used first for a tag. */
  order?: "desc" | "count" | "first-seen";
  /** Another condition an item must meet to be counted (a search), without hiding the value. */
  also?: (item: T) => boolean;
  /** Values used by fewer items than this are left out, unless selected. */
  min?: number;
  /** At most this many, the most used first; a selected value is always kept. */
  cap?: number;
};

export function facetOptions<T, F extends string>(
  items: T[],
  facet: F,
  sel: Selection<F>,
  facets: readonly F[],
  valuesOf: ValuesOf<T, F>,
  { order = "first-seen", min = 1, cap = Infinity, also }: OptionRules<T> = {}
): FacetOption[] {
  const all = new Map<string, number>();
  const narrowed = new Map<string, number>();
  for (const item of items) {
    const hit = matchesSelection(item, sel, facets, valuesOf, facet) && (!also || also(item));
    for (const v of new Set(valuesOf(item, facet))) {
      all.set(v, (all.get(v) ?? 0) + 1);
      if (hit) narrowed.set(v, (narrowed.get(v) ?? 0) + 1);
    }
  }
  let values = [...all.keys()];
  if (order === "desc") values.sort((a, b) => b.localeCompare(a));
  if (order === "count") values.sort((a, b) => all.get(b)! - all.get(a)! || a.localeCompare(b));
  values = values.filter((v) => all.get(v)! >= min).slice(0, cap);
  for (const v of sel[facet] ?? []) if (!values.includes(v)) values.push(v);
  return values.map((value) => ({ value, count: narrowed.get(value) ?? 0 }));
}

/**
 * The URL for `search` with one facet's values replaced. Every other
 * parameter (another facet, a search query) is carried over untouched.
 */
export function hrefWithValues(path: string, search: string, facet: string, values: string[]): string {
  const params = new URLSearchParams(search);
  params.delete(facet);
  for (const v of values) params.append(facet, v);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

/** The URL with a value added to its facet, or taken off it if it is already there. */
export function hrefToggled(path: string, search: string, facet: string, value: string): string {
  const current = new URLSearchParams(search).getAll(facet);
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return hrefWithValues(path, search, facet, next);
}

/** The URL with every facet cleared. Parameters that are not facets (a search) stay. */
export function hrefCleared(path: string, search: string, facets: readonly string[]): string {
  const params = new URLSearchParams(search);
  for (const f of facets) params.delete(f);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
