import { describe, expect, it } from "vitest";
import { bandCuts, cityPlan, EMPTY_PLAN } from "@/components/city/cityPlan";
import type { ContributionYear } from "@/services/contributions";

/*
 * This module makes a truth claim with a drawing attached, so what is asserted
 * here is the claim and not the drawing.
 *
 * Three things can go wrong in a way nobody would see on screen. A day can be
 * drawn on the wrong weekday, which turns the whole grid into a plausible
 * picture of a different year. A band or a height can come out of something
 * other than the day's own count. And a window that is absent can come out as
 * a window that is empty, which is the one failure the whole feature was
 * designed around.
 */

function year(days: { date: string; count: number }[], over: Partial<ContributionYear> = {}) {
  const base: ContributionYear = {
    from: days[0]?.date ?? null,
    to: days[days.length - 1]?.date ?? null,
    total: days.reduce((a, d) => a + d.count, 0),
    days,
    fetchedAt: "2026-11-01T00:00:00.000Z",
    error: null,
  };
  return { ...base, ...over };
}

/** A run of consecutive days from a Sunday, so a case can state its own shape. */
function run(start: string, counts: number[]) {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  return counts.map((count, i) => ({
    date: new Date(t0 + i * 86400000).toISOString().slice(0, 10),
    count,
  }));
}

describe("bandCuts", () => {
  it("cuts on the quartiles of the non-empty days and ignores the empty ones", () => {
    /* Nine non-empty days, 1..9, plus a pile of noughts that must not drag the
       quartiles down — which is the whole reason the empty days are filtered
       before the cuts are taken rather than after. */
    const cuts = bandCuts([0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(cuts).toEqual([3, 5, 7]);
  });

  it("returns integers a real day could sit on", () => {
    /* Four non-empty days means the median lands between two of them; nearest
       rank picks one of the two rather than inventing 2.5 commits. */
    const cuts = bandCuts([1, 2, 3, 4]);
    expect(cuts.every(Number.isInteger)).toBe(true);
  });

  it("lets bands collapse when the year has no spread, rather than inventing one", () => {
    expect(bandCuts([1, 1, 1, 1, 1, 1, 2])).toEqual([1, 1, 1]);
  });

  it("answers a year with nothing in it without dividing by anything", () => {
    expect(bandCuts([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe("cityPlan", () => {
  it("puts the first day on its own weekday", () => {
    /* 2026-01-07 is a Wednesday, which is the fourth row of a calendar whose
       weeks start on Sunday. Off by one here and every day in the year is
       drawn on the wrong row — a picture of a year that did not happen. */
    const plan = cityPlan(year(run("2026-01-07", [1, 2, 3])));
    expect(plan.firstRow).toBe(4);
  });

  it("counts whole week columns, including the two partial ones", () => {
    /* Three days starting on a Wednesday: three of the first week, nothing
       else. One column. */
    expect(cityPlan(year(run("2026-01-07", [1, 1, 1]))).weeks).toBe(1);
    /* Six days from the same Wednesday crosses into the following Sunday. */
    expect(cityPlan(year(run("2026-01-07", [1, 1, 1, 1, 1, 1]))).weeks).toBe(2);
  });

  it("takes a column's height from its own count against the busiest day", () => {
    /* `sqrt(count / max)`, deliberately not `count / max` — see the
       measurement at the top of `cityPlan.ts`. Asserted as literal values
       rather than through the formula, so that a change to the mapping has to
       be made here on purpose, with the numbers in front of whoever makes it. */
    const plan = cityPlan(year(run("2026-01-04", [0, 5, 10, 2])));
    expect(plan.cells.map((c) => c.rise)).toEqual([0, 0.707, 1, 0.447]);
  });

  it("is not a ratio, and is not allowed to drift back into one", () => {
    /* Half the height is a quarter of the work. This is the cost the square
       root buys legibility with, and it is stated as a test because it is the
       one property of this chart a reader could be misled by — the comment
       that warns them is in `cityPlan.ts` and in the component. */
    const plan = cityPlan(year(run("2026-01-04", [100, 25])));
    expect(plan.cells[1].rise).toBe(0.5);
  });

  it("leaves the busiest day alone at full height", () => {
    /* The property that ruled out dividing by a percentile and clamping.
       Against the real year's top five counts, a 95th-percentile divisor puts
       five days on 1.0 together and the busiest day — the one the caption
       names by date — stops being the tallest column in its own chart. */
    const plan = cityPlan(year(run("2026-01-04", [96, 107, 148, 156, 172])));
    expect(plan.cells.filter((c) => c.rise >= 1)).toHaveLength(1);
    expect(plan.busiest?.count).toBe(172);
  });

  it("gives every distinct count its own height, which five buckets would not", () => {
    /* The property that ruled out quartile buckets for the height. The colour
       is already cut on those quartiles; a bucketed height would carry the
       same information cut at the same three numbers, and the chart would have
       one encoding drawn twice instead of two at different resolutions. */
    const counts = [0, 1, 2, 3, 4, 8, 16, 17, 27, 34, 50, 96, 172];
    const plan = cityPlan(year(run("2026-01-04", counts)));
    expect(new Set(plan.cells.map((c) => c.rise)).size).toBe(counts.length);
  });

  it("keeps an ordinary day of a bursty year off the ground", () => {
    /*
     * The failure this mapping exists to fix, in the shape it was measured in:
     * 365 days, 82 of them active, busiest 172, ordinary active day 16. Under
     * `count / max` a 16-contribution day came out at 0.093 — 0.2px of lift at
     * the phone storey, which is a day of real work drawn as paving.
     *
     * The two assertions are the acceptance criterion. Nothing below 0.05 but
     * the days that are genuinely empty, and an ordinary day standing at
     * roughly a third of the tallest column rather than a tenth of it.
     */
    const counts = [172, ...Array<number>(81).fill(16), ...Array<number>(283).fill(0)];
    const plan = cityPlan(year(run("2025-11-02", counts)));

    const flat = plan.cells.filter((c) => c.rise < 0.05);
    expect(flat).toHaveLength(283);
    expect(flat.every((c) => c.count === 0)).toBe(true);
    expect(plan.cells[1].rise).toBeGreaterThan(0.3);
  });

  it("gives an empty day no height and no band", () => {
    const plan = cityPlan(year(run("2026-01-04", [0, 4])));
    expect(plan.cells[0]).toMatchObject({ count: 0, step: 0, rise: 0 });
  });

  it("bands and heights disagree about resolution and never about order", () => {
    const counts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 20, 40];
    const plan = cityPlan(year(run("2026-01-04", counts)));
    for (let i = 1; i < plan.cells.length; i += 1) {
      const [a, b] = [plan.cells[i - 1], plan.cells[i]];
      /* Both encodings read the same integer, so neither may ever say a
         quieter day was busier. Equal is allowed; inverted is not. */
      expect(b.rise).toBeGreaterThanOrEqual(a.rise);
      expect(b.step).toBeGreaterThanOrEqual(a.step);
    }
  });

  it("reports GitHub's own total rather than a sum of the array", () => {
    /* They agree in practice. The point is which one is read, so the fixture
       makes them disagree and the plan must follow the payload. */
    const plan = cityPlan(year(run("2026-01-04", [1, 1]), { total: 99 }));
    expect(plan.total).toBe(99);
    expect(plan.active).toBe(2);
  });

  it("groups the months in window order and marks the partial ones", () => {
    /* Two days of January and two of February: a reader comparing month
       totals has to be told that neither month is whole. */
    const plan = cityPlan(year(run("2026-01-30", [1, 2, 3, 4])));
    expect(plan.months.map((m) => [m.label, m.days, m.total])).toEqual([
      ["January 2026", 2, 3],
      ["February 2026", 2, 7],
    ]);
  });

  it("has no busiest day when nothing was committed", () => {
    expect(cityPlan(year(run("2026-01-04", [0, 0, 0]))).busiest).toBeNull();
  });

  it("draws an unavailable year as the empty lattice and never as a year", () => {
    const plan = cityPlan({
      from: null,
      to: null,
      total: null,
      days: [],
      fetchedAt: "2026-11-01T00:00:00.000Z",
      error: "The contribution year could not be read from GitHub.",
    });
    expect(plan).toBe(EMPTY_PLAN);
    expect(plan.cells).toEqual([]);
    /* 53 columns, because the empty state is the same chart with the data
       taken out rather than a missing chart. */
    expect(plan.weeks).toBe(53);
  });

  it("reads dates as calendar dates, not as instants in the reader's zone", () => {
    /* The one bug a timezone introduces and a test west of Greenwich would
       otherwise ship: `new Date("2026-03-01")` reported locally is the evening
       of February 28th for anyone behind UTC, which moves the day into the
       previous month's row of the table and up one row of the grid. */
    const plan = cityPlan(year(run("2026-03-01", [3])));
    expect(plan.months[0].label).toBe("March 2026");
    expect(plan.firstRow).toBe(1);
  });
});
