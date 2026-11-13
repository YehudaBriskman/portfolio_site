/*
 * What a filter is, and how a set of them lives in an address.
 *
 * The shapes are plain data so a screen can write its definitions once and
 * hand them to FilterChips, FilterSheet and useSavedFilters alike. The
 * address is the source of truth: a segmented filter and a sort are one
 * param named by the id, a multi is that param repeated, a range is
 * `<id>From` and `<id>To`. A default (an empty value, the first sort option)
 * is never written, so a clean address means a clean screen.
 */

export interface FilterOption {
  value: string;
  label: string;
  /** How many rows it would match, when the screen knows. Read out, never the only signal. */
  count?: number;
}

export interface DatePreset {
  label: string;
  /** ISO dates, YYYY-MM-DD. */
  from: string;
  to: string;
}

export type FilterDef =
  /** One of a few, or none (All). */
  | { id: string; kind: "segmented"; label: string; options: FilterOption[] }
  /** Any of many. A search field joins the list above eight options. */
  | { id: string; kind: "multi"; label: string; options: FilterOption[]; searchable?: boolean }
  /** A span of dates. */
  | { id: string; kind: "range"; label: string; presets?: DatePreset[] }
  /** The order of the list: one of its options, the first being the default. Not counted as a filter. */
  | { id: string; kind: "sort"; label: string; options: FilterOption[] };

export interface DateRange {
  from?: string;
  to?: string;
}

export type FilterValue = string | string[] | DateRange;
export type Filters = Record<string, FilterValue>;

/** More than this many options and a multi-select gets a search field. */
export const SEARCH_ABOVE = 8;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = (s: string | undefined): s is string => typeof s === "string" && ISO_DATE.test(s) && !Number.isNaN(Date.parse(s));

/** A range whose end is before its start. */
export const rangeIsBackwards = (r: DateRange | undefined): boolean => Boolean(r?.from && r.to && r.from > r.to);

const offers = (def: { options: FilterOption[] }, value: string) => def.options.some((o) => o.value === value);

/** The value a def holds, or undefined when it holds nothing (so nothing is written for it). */
export function cleanValue(def: FilterDef, raw: FilterValue | undefined): FilterValue | undefined {
  if (raw === undefined) return undefined;
  switch (def.kind) {
    case "segmented":
      return typeof raw === "string" && raw !== "" ? raw : undefined;
    case "sort":
      return typeof raw === "string" && raw !== "" && raw !== def.options[0]?.value ? raw : undefined;
    case "multi":
      return Array.isArray(raw) && raw.length > 0 ? raw : undefined;
    case "range": {
      if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
      const out: DateRange = {};
      if (raw.from) out.from = raw.from;
      if (raw.to) out.to = raw.to;
      return out.from || out.to ? out : undefined;
    }
  }
}

/** The same filters with every empty or default value dropped. */
export function tidy(defs: FilterDef[], value: Filters): Filters {
  const out: Filters = {};
  for (const d of defs) {
    const v = cleanValue(d, value[d.id]);
    if (v !== undefined) out[d.id] = v;
  }
  return out;
}

/** Filters that narrow the list: every active value except the sort. */
export function filterCount(defs: FilterDef[], value: Filters): number {
  return defs.filter((d) => d.kind !== "sort" && cleanValue(d, value[d.id]) !== undefined).length;
}

export const rangeKeys = (id: string) => [`${id}From`, `${id}To`] as const;

/** Reads the filters out of an address; anything the defs do not offer is dropped. */
export function parseFilters(defs: FilterDef[], params: URLSearchParams): Filters {
  const out: Filters = {};
  for (const d of defs) {
    if (d.kind === "range") {
      const [fk, tk] = rangeKeys(d.id);
      const from = params.get(fk) ?? undefined;
      const to = params.get(tk) ?? undefined;
      const r: DateRange = {};
      if (isIsoDate(from)) r.from = from;
      if (isIsoDate(to)) r.to = to;
      if (r.from && r.to && r.from > r.to) [r.from, r.to] = [r.to, r.from];
      const v = cleanValue(d, r);
      if (v) out[d.id] = v;
    } else if (d.kind === "multi") {
      const v = cleanValue(d, [...new Set(params.getAll(d.id).filter((x) => offers(d, x)))]);
      if (v) out[d.id] = v;
    } else {
      const raw = params.get(d.id);
      const v = raw !== null && offers(d, raw) ? cleanValue(d, raw) : undefined;
      if (v) out[d.id] = v;
    }
  }
  return out;
}

/** A copy of `params` with these filters written in (and the defs' old values removed). */
export function writeFilters(defs: FilterDef[], params: URLSearchParams, value: Filters): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const d of defs) {
    for (const k of d.kind === "range" ? rangeKeys(d.id) : [d.id]) next.delete(k);
  }
  const clean = tidy(defs, value);
  for (const d of defs) {
    const v = clean[d.id];
    if (v === undefined) continue;
    if (d.kind === "range") {
      const [fk, tk] = rangeKeys(d.id);
      const r = v as DateRange;
      if (r.from) next.set(fk, r.from);
      if (r.to) next.set(tk, r.to);
    } else if (d.kind === "multi") {
      for (const x of v as string[]) next.append(d.id, x);
    } else {
      next.set(d.id, v as string);
    }
  }
  return next;
}

/** The label of a def's active value, e.g. "Alpha, Beta" or "2026-01-01 - 2026-02-01". */
export function describeValue(def: FilterDef, value: FilterValue | undefined, dash = " - "): string {
  const v = cleanValue(def, value);
  if (v === undefined) return "";
  if (def.kind === "range") {
    const r = v as DateRange;
    return [r.from, r.to].filter(Boolean).join(dash);
  }
  const values = Array.isArray(v) ? v : [v as string];
  const options = (def as { options: FilterOption[] }).options;
  return values.map((x) => options.find((o) => o.value === x)?.label ?? x).join(", ");
}
