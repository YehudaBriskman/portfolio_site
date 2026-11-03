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
 * A column's HEIGHT is the SQUARE ROOT of the day's count against the busiest
 * day of the year. THE HEIGHT SCALE IS NOT LINEAR AND TWO COLUMNS ARE NOT A
 * RATIO: a column half as tall as another stands for roughly a quarter of its
 * work, not half of it. That is a real cost and it was paid deliberately, for
 * a reason that is measured rather than preferred — see the next block.
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
 *
 * ── why the height is not linear: the measurement ─────────────────────────
 *
 * It was `count / max`, and that was profiled and photographed against a
 * SYNTHETIC year — 365 days, 260 of them non-empty, busiest 45 — because no
 * token was available at the time. On a calendar of roughly that shape a
 * linear rise is an even skyline and the right encoding.
 *
 * The real calendar is not that shape. Measured against the live account over
 * 2025-11-02 → 2026-11-01, with the service's own query:
 *
 *   365 days   2,206 contributions   82 active   busiest 172
 *   median active day 16.5   mean active day 26.9
 *   top five counts 172, 156, 148, 107, 96
 *
 * 82 active days out of 365 is a bursty pattern — a few long sessions rather
 * than a daily streak — and a tenfold gap between the median active day and
 * the busiest one is what a linear divisor has to absorb. It cannot:
 *
 *   rise      count / max      sqrt(count / max)
 *   < 0.02    302 / 365  83%   283 / 365  78%
 *   < 0.05    311 / 365  85%   283 / 365  78%
 *   < 0.10    326 / 365  89%   293 / 365  80%
 *   < 0.25    351 / 365  96%   314 / 365  86%
 *   < 0.50    359 / 365  98%   351 / 365  96%
 *
 * The year has 283 empty days, so 283/365 is the floor: a mapping that leaves
 * 283 columns under 0.05 is leaving exactly the empty ones there. Linear left
 * 311, which is 28 days of real work drawn as paving. Read off the rendered
 * page, where the storey measures 93.6px at 1440 and 40.0px on a 390px phone,
 * a single-contribution day went from 0.6px of lift to 7.1px on a desktop and
 * from 0.2px to 3.0px on a phone, and the median active day went from 9.3px
 * to 29.4px. 0.2px is not a building a reader can see, and the day it stands
 * for was not nothing.
 *
 * ── the two mappings that were measured and rejected ──────────────────────
 *
 * PERCENTILE-CLAMPED LINEAR — divide by the 95th percentile of the non-empty
 * days (96 here) and clamp. It keeps a linear reading over most of the range
 * and fails at both ends of this year: five days land on 1.0 together, so the
 * busiest day the caption names by date is no longer the tallest column, and a
 * single-contribution day is still only 0.9px up at the desktop storey.
 *
 * QUARTILE BUCKETS of the non-empty days, five discrete heights, matching what
 * the colour bands already do. Most legible of the three, and it throws away
 * the thing the height is for: it collapses this year's 43 distinct active
 * counts to 4 heights and ties 20 days at the top. The height would then carry
 * exactly the information the colour already carries, cut at exactly the same
 * three numbers, and the claim above — that the two encodings differ in
 * RESOLUTION and not in source — would stop being true. A redundant channel is
 * a reasonable thing to build; it is not this chart.
 *
 * SQRT keeps all 43 of them distinct, keeps the busiest day alone at 1.0, is
 * monotonic so neither encoding can invert the other, and is one `Math.sqrt`
 * in a derivation that runs once per request. It is the compromise that gives
 * up the ratio reading and nothing else.
 */

/** The five bands. `0` is an empty day and is the only one with a fixed
    meaning; `1`–`4` are quartiles of whatever the year actually holds. */
export type CityStep = 0 | 1 | 2 | 3 | 4;

export type CityCell = {
  date: string;
  count: number;
  step: CityStep;
  /**
   * `0`–`1`, and NOT a proportion of the busiest day: it is
   * `sqrt(count / max)`, so twice the height is about four times the work.
   * The stylesheet multiplies it by one storey; see `--city-storey`, and see
   * the measurement at the top of this file for why it is not linear.
   */
  rise: number;
};

/** One month of the window, for the text equivalent. */
export type CityMonth = {
  /** `January 2026`. Built in UTC — see the note in `monthLabel`. */
  label: string;
  /** `2026-01`: the month itself, for a label in another language. */
  ym: string;
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

export function monthLabel(ym: string, locale = "en-GB"): string {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString(locale, {
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
  return [...byMonth].map(([ym, row]) => ({ label: monthLabel(ym), ym, ...row }));
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
   * The divisor inside every height on the page. `max(1)` is not defensiveness
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
    /*
     * NON-LINEAR, and the whole argument for it is at the top of this file.
     * `sqrt` and not a division: on the real calendar a plain `count / max`
     * put 28 days of real work under 0.05 — a fifth of a pixel of lift at the
     * phone storey — because the busiest day is 172 and the median active day
     * is 16.5. The square root lifts that median from 0.099 to 0.314 while
     * leaving the busiest day alone at 1.0.
     *
     * Three decimals. The storey measures 93.6px at a desktop width, so the
     * third decimal is a tenth of a pixel and the fourth is noise in an inline
     * style that ships 365 times.
     */
    rise: Math.round(Math.sqrt(d.count / max) * 1000) / 1000,
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
