import type { ContributionDay, ContributionYear } from "@/services/contributions";

/*
 * Turning a year of real numbers into a city, and nothing else.
 *
 * Everything in this file is derived from `days` and from `days` only. There
 * is no padding, no interpolation and no synthetic day: a calendar that
 * arrives three days short of a year is drawn three days short of a year,
 * because the alternative is a chart with invented buildings in it. That is
 * the whole reason this is a module with a test beside it rather than a few
 * expressions inside the component — a derivation that can be checked is the
 * only kind that can be trusted with a truth claim.
 *
 * ── the two encodings, and why they are not the same shape ────────────────
 *
 * A column's HEIGHT is linear in the day's count against the busiest day of
 * the year. That is the honest reading of a bar: twice as tall is twice as
 * much, and it is the encoding a reader measures without being told how.
 *
 * A column's COLOUR is one of five bands, cut at the quartiles of the year's
 * own non-empty days. Five swatches cannot be linear in anything — a linear
 * ramp across a year with one forty-commit day puts every ordinary day in the
 * palest band and the whole chart reads as empty. The quartiles come from the
 * data rather than from a table of constants, so the bands mean "a quiet day
 * for this year" rather than "a quiet day by somebody's standard". It is also
 * GitHub's own rule for the grid this replaces in perspective.
 *
 * Both come off `count`, which is the acceptance criterion: the two encodings
 * differ in resolution and not in source, and neither of them can disagree
 * with the other about which day was busier.
 */

/** The five bands. `0` is an empty day and is the only one with a fixed
    meaning; `1`–`4` are quartiles of whatever the year actually holds. */
export type CityStep = 0 | 1 | 2 | 3 | 4;

export type CityCell = {
  date: string;
  count: number;
  step: CityStep;
  /** `0`–`1`, the day's count against the busiest day. The stylesheet
      multiplies it by one storey; see `--city-storey`. */
  rise: number;
};

/** One month of the window, for the text equivalent. */
export type CityMonth = {
  /** `January 2026`. Built in UTC — see the note in `monthLabel`. */
  label: string;
  total: number;
  /** How many of the month's days are in the window at all. The first and
      last months of a trailing year are both partial, and a reader of the
      table needs to know that before comparing them with the ten between. */
  days: number;
};

export type CityPlan = {
  cells: CityCell[];
  /** Columns in the grid: whole weeks, including the two partial ones. */
  weeks: number;
  /**
   * Which of the seven rows the first day belongs in, `1`–`7`.
   *
   * GitHub's calendar starts on a Sunday and its first week is usually
   * partial, so the grid cannot simply flow from the top-left corner: the
   * first cell has to start on its own weekday or every day in the year is
   * drawn on the wrong row. One `grid-row-start` on the first cell and
   * `grid-auto-flow: column` does the rest — see the stylesheet.
   */
  firstRow: number;
  /** The busiest day in the window. `null` only when the window is empty. */
  busiest: CityCell | null;
  /** GitHub's own total, kept as it arrived. `null` when unavailable. */
  total: number | null;
  /** Days with at least one contribution, which is what the bands are cut on. */
  active: number;
  months: CityMonth[];
};

/** A year that could not be read. The grid is still drawn; it is just empty. */
export const EMPTY_PLAN: CityPlan = {
  cells: [],
  /* 53, because a trailing year spans 53 week columns and the empty state is
     the same object as the full one with the data taken out. A 0-week grid
     would be a missing chart where the design calls for an empty one. */
  weeks: 53,
  firstRow: 1,
  busiest: null,
  total: null,
  active: 0,
  months: [],
};

/**
 * The weekday of a `YYYY-MM-DD`, read in UTC.
 *
 * UTC and not local time, here and in `monthLabel`. `new Date("2026-01-04")`
 * is parsed as midnight UTC and then reported in the reader's zone, so west of
 * Greenwich `getDay()` answers for the evening of the 3rd — which shifts every
 * cell in the grid up one row, and moves the first and last day of each month
 * into the neighbouring month in the table. The dates GitHub sends are
 * calendar dates with no time in them, and a calendar date has no zone.
 */
function utcWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function monthLabel(ym: string): string {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The three cuts between the four non-empty bands.
 *
 * Quartiles of the sorted non-empty counts, by nearest rank — the value at
 * position `q * (n - 1)`, rounded. Nearest rank rather than an interpolated
 * quantile because every count is an integer and a cut of 2.5 commits is a
 * threshold no day can sit on; a cut has to be a number a day could be.
 *
 * Duplicate cuts are left alone deliberately. A year whose non-empty days are
 * almost all 1 produces cuts of `[1, 1, 2]`, which collapses bands 1 and 2
 * into one colour — and that is the truth about that year rather than a bug to
 * spread out. Forcing four distinct bands would be inventing a spread the data
 * has not got.
 */
export function bandCuts(counts: number[]): [number, number, number] {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (active.length === 0) return [0, 0, 0];
  const at = (q: number) => active[Math.round(q * (active.length - 1))];
  return [at(0.25), at(0.5), at(0.75)];
}

function bandOf(count: number, cuts: [number, number, number]): CityStep {
  if (count <= 0) return 0;
  if (count <= cuts[0]) return 1;
  if (count <= cuts[1]) return 2;
  if (count <= cuts[2]) return 3;
  return 4;
}

function monthsOf(days: ContributionDay[]): CityMonth[] {
  /* A Map and not an object, so the twelve entries come back in the order
     they were inserted — which is the order of the window, and the order the
     table has to print. An object's integer-like keys would reorder, and
     `2026-01` is not integer-like today and would be one key format change
     away from being so. */
  const byMonth = new Map<string, { total: number; days: number }>();
  for (const d of days) {
    const ym = d.date.slice(0, 7);
    const row = byMonth.get(ym) ?? { total: 0, days: 0 };
    row.total += d.count;
    row.days += 1;
    byMonth.set(ym, row);
  }
  return [...byMonth].map(([ym, row]) => ({ label: monthLabel(ym), ...row }));
}

/**
 * The city, from the year the server sent.
 *
 * An unavailable year and an empty one come out as the same plan, because they
 * are the same drawing: the service already reports an empty calendar as
 * unavailable, so there is no third case in which `days` is present and
 * meaningless.
 */
export function cityPlan(year: ContributionYear): CityPlan {
  const days = year.days;
  if (days.length === 0) return EMPTY_PLAN;

  const counts = days.map((d) => d.count);
  const cuts = bandCuts(counts);
  /*
   * The divisor for every height on the page. `max(1)` is not defensiveness
   * about a zero: a year of entirely empty days is reported unavailable by the
   * service and never reaches here, so this guards the arithmetic rather than
   * the data — a `0 / 0` would put `NaN` into 365 inline styles, which CSS
   * discards silently and which would read as a city that failed to rise.
   */
  const max = Math.max(...counts, 1);

  const cells: CityCell[] = days.map((d) => ({
    date: d.date,
    count: d.count,
    step: bandOf(d.count, cuts),
    /* Three decimals. The storey is ~100px, so the third decimal is a tenth
       of a pixel and the fourth is noise in an inline style that ships 365
       times. */
    rise: Math.round((d.count / max) * 1000) / 1000,
  }));

  const firstWeekday = utcWeekday(days[0].date);
  const busiest = cells.reduce((best, c) => (c.count > best.count ? c : best), cells[0]);

  return {
    cells,
    weeks: Math.ceil((firstWeekday + days.length) / 7),
    firstRow: firstWeekday + 1,
    /* Only a day that actually happened. A year in which nothing was
       committed has a busiest day of zero, and printing "busiest day: 0" in
       the caption would be a fact about an empty set. */
    busiest: busiest.count > 0 ? busiest : null,
    total: year.total,
    active: counts.filter((c) => c > 0).length,
    months: monthsOf(days),
  };
}
