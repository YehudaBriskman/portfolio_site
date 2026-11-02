import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import InkRule from "@/components/motion/InkRule";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import { cityPlan, EMPTY_PLAN, type CityPlan } from "@/components/city/cityPlan";
import { contributionYear } from "@/services/contributions";
import styles from "@/components/city/ContributionCity.module.css";

/*
 * A year of work, laid out as a year and then raised into a city.
 *
 * What this section is for
 * ------------------------
 * Every other section on the page shows a thing that was made. This one shows
 * the making: 365 real days, each at its real height, and the shape of a year
 * is a different kind of claim from a list of six projects. It is also the
 * only section whose content the owner does not write — it is whatever the
 * calendar says, which is the reason it had to be honest about being
 * unavailable before it was allowed to be beautiful.
 *
 * Where the motion lives, and what this file decides
 * --------------------------------------------------
 * Nothing that moves is here. The arrival is one scroll-driven animation on
 * one element and the whole argument for it — why a scrub, why it is not a
 * second peak, why 365 columns cost one animation rather than 365 — is at the
 * top of `ContributionCity.module.css`, next to the declarations answerable to
 * it. This file decides what a column is worth, what the caption says, and
 * which of the three states the section is in.
 *
 * There is no state, no ref, no observer and no scroll listener, which is the
 * property §7 of the motion contract asks every component on this page to
 * keep. The grid is 365 spans with one custom property each, written once when
 * the request lands and never touched again.
 *
 * Why the columns are not interactive
 * -----------------------------------
 * GitHub's grid gives every day a tooltip, and copying that here would put 365
 * focus stops in front of a reader navigating by keyboard — which is not
 * access to a chart, it is a queue in front of one. So the scene is
 * `aria-hidden` and the data has a real text equivalent instead: a caption
 * with the window, the total and the busiest day, and a `details` holding the
 * twelve months as a table. The `details` is deliberately not `sr-only`; the
 * reasoning is on `.table` in the stylesheet.
 *
 * Three states, and loading is not the same state as empty
 * ---------------------------------------------------------
 * Pending, unavailable and present. Pending and unavailable both draw the
 * flat 53-week lattice, because an empty grid is what this chart looks like
 * with no data and it is the state the three off-switches land on anyway.
 * They are not the same drawing, though, and the difference is the whole of
 * what a skeleton is for here:
 *
 *   **unavailable** — the lattice at its own height, perfectly still, with
 *   the server's sentence under it. This is a finished chart of nothing and
 *   nothing more is coming. It should not shimmer, and it should not reserve
 *   room for columns that will never stand in it.
 *
 *   **pending** — the same lattice, standing in the city's full height, with
 *   one band of light crossing it. The reserved height is the point of it
 *   and it was measured rather than assumed: the frame is `height: auto`
 *   when empty and `clamp(140px, 16vw, 240px)` when a year is in it, so the
 *   arriving city used to push everything under it down by 108.69px at
 *   1440x900 — a layout shift of 0.0345 for a reader parked on the section,
 *   invisible from the top of the page, which is why it survived this long.
 *
 * So a reserved height and a moving band mean *coming*; the collapsed height
 * and stillness mean *this is the chart*. Nothing in this file can produce a
 * column from anything other than a real count — the plan is derived in
 * `cityPlan.ts` from `days`, and `days` is empty in every failure the
 * service reports — so the lattice is honest in both.
 */

/** The window a trailing year spans, in week columns. See `EMPTY_PLAN`. */
const EMPTY_WEEKS = EMPTY_PLAN.weeks;

/**
 * A calendar date, printed as one.
 *
 * `timeZone: "UTC"` for the reason `cityPlan.ts` gives at more length: GitHub
 * sends calendar dates with no time in them, and reporting one in the reader's
 * own zone prints the day before it for everyone west of Greenwich.
 */
function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function count(n: number): string {
  return n.toLocaleString("en-GB");
}

/**
 * The window, for the section's eyebrow.
 *
 * Short form — `Nov 2025 – Nov 2026` — because the eyebrow shares a row with a
 * display heading and the long form wraps that row onto two lines at every
 * width below a desktop. The long form is in the caption, where there is a
 * measure to hold it.
 */
function windowLabel(plan: CityPlan, from: string | null, to: string | null): string {
  if (!from || !to || plan.cells.length === 0) return "Trailing twelve months";
  const short = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${short(from)} – ${short(to)}`;
}

/**
 * The cells to draw.
 *
 * A plan with days in it is drawn as its days. A plan without — pending, or
 * unavailable — is drawn as the empty lattice at its full 53 weeks, which is
 * the same object with the data taken out rather than a second component. The
 * placeholders carry no date and no rise, so they are paving and can never be
 * mistaken for a day that scored nothing: a reader is told which they are
 * looking at by the caption, not by the grid.
 */
function cellsOf(plan: CityPlan) {
  if (plan.cells.length > 0) return plan.cells;
  return Array.from({ length: EMPTY_WEEKS * 7 }, (_, i) => ({
    date: `blank-${i}`,
    count: 0,
    step: 0 as const,
    rise: 0,
  }));
}

export default function ContributionCity() {
  const { data, isPending } = useQuery({
    queryKey: ["github", "contributions"],
    queryFn: contributionYear,
    /*
     * Half an hour, matching the server's own refresh interval. A shorter
     * window would spend requests on a value that cannot have changed, and
     * `contributionYear` never rejects — so there is nothing for the default
     * retry policy to retry and no `isError` branch to render. The unavailable
     * year *is* the resolved value.
     */
    staleTime: 30 * 60 * 1000,
  });

  const year = data ?? null;
  const plan = year ? cityPlan(year) : EMPTY_PLAN;
  const cells = cellsOf(plan);
  const empty = plan.cells.length === 0;

  return (
    <section id="year" className="wrap section-y">
      {/* The same centred head every section on this page takes; the layout
          is `.section-head` in index.css. */}
      <div className="section-head">
        <InkRule className="section-head-rule" />
        <h2 className="display text-section leading-[0.9]">The year</h2>
        <InkRule className="section-head-rule" />
        <p className="eyebrow section-head-note tabular-nums">
          {windowLabel(plan, year?.from ?? null, year?.to ?? null)}
        </p>
      </div>

      <figure className={styles.figure}>
        {/*
          The frame owns the clock and the camera; the scene is the one thing
          that moves. `data-city` switches the act off from the data side and
          carries three values, not two — see the fourth exit in the
          stylesheet, and the argument at the top of this file for why a year
          that is still coming is not the same state as a year that is not.

          `aria-hidden` on the scene and not on the frame, so the frame stays
          an ordinary box in the tree and the figure keeps its caption.
        */}
        <div
          className={styles.frame}
          data-city={isPending ? "pending" : empty ? "empty" : "year"}
        >
          <div className={styles.scene} aria-hidden="true">
            {/* The week count is the one thing the grid cannot derive: a
                trailing year is 53 columns, a shorter window is fewer, and
                `grid-auto-flow: column` with no declared track count would run
                the year off the end of the frame instead of fitting it in. */}
            <div
              className={styles.plane}
              style={{ "--city-weeks": plan.weeks } as CSSProperties}
            >
              {cells.map((cell, i) => (
                <span
                  key={cell.date}
                  className={styles.cell}
                  data-step={cell.step}
                  /*
                    Two values, and only the first cell gets the second.

                    `--city-rise` is the day's own height, the only
                    per-element value in the whole scene and the reason the
                    stylesheet needs one keyframe rather than 365. It is
                    `sqrt(count / busiest)` and NOT a proportion of the
                    busiest day — two columns are not a ratio, which is a
                    thing a reader is owed and the measurement behind it is
                    in `cityPlan.ts`.

                    `gridRowStart` puts the first day on its own weekday. The
                    other 364 flow from it; writing it on every cell would be
                    364 declarations that agree with the one before them.
                  */
                  style={
                    {
                      "--city-rise": cell.rise,
                      ...(i === 0 ? { gridRowStart: plan.firstRow } : {}),
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {/*
          The caption, and it is the chart's sentence rather than its title.

          Three states print three different things and one of them is the
          server's own line, used as it stands: the service generalises every
          failure to one sentence on purpose — "bad credentials" is between the
          deploy and its operator — so there is nothing here to translate.
        */}
        <figcaption className={styles.caption}>
          {isPending && "Reading the year…"}
          {!isPending && year?.error}
          {!isPending && !empty && plan.total !== null && (
            <>
              {count(plan.total)} contributions over {count(plan.cells.length)} days,{" "}
              {year?.from && year?.to && (
                <>
                  {longDate(year.from)} to {longDate(year.to)}
                </>
              )}
              . {count(plan.active)} of those days have something in them
              {plan.busiest && (
                <>
                  ; the busiest is {longDate(plan.busiest.date)}, at{" "}
                  {count(plan.busiest.count)}
                </>
              )}
              .
            </>
          )}
        </figcaption>
      </figure>

      {/*
        The disclosure's own place in the page, held while the year is on its
        way.

        It is the last of the three things this section grows by when the
        request lands, and the largest: 36.19px of control plus its 36px of
        margin, measured at 1440x900. Reserved rather than left to arrive,
        because a skeleton that reserves the chart and not the row under it
        has moved the shift rather than removed it.

        A line of skeleton and not an empty `details`. The component's own
        rule below is that a disclosure promising a table and opening onto
        nothing is worse than no control at all — so what stands here is the
        box the control will occupy, at the control's own type step, with a
        capsule where its label will be. It is `aria-hidden` and not
        focusable, so there is nothing for a keyboard reader to find and no
        promise made that the response has not kept.

        The one state this is wrong for is a year that turns out unavailable,
        where it disappears and the page shrinks by the same 72.19px. That is
        the failure path trading places with the success path, which is the
        right way round: the shift used to be paid on every successful load
        and is now paid only when the server could not answer.
      */}
      {isPending && (
        <div className={styles.table} aria-hidden="true">
          <p className="eyebrow">
            <SkeletonLines lines={1} tail="11rem" />
          </p>
        </div>
      )}

      {/*
        The text equivalent. Present only when there is a year to tabulate —
        an empty `details` promising a table and opening onto nothing is worse
        than no control at all, and the caption has already said why it is
        empty.
      */}
      {!empty && plan.months.length > 0 && (
        <details className={styles.table}>
          <summary className={`eyebrow ${styles.summary}`}>The year as a table</summary>
          <table className={styles.months}>
            <caption className="sr-only">
              Contributions by month over the trailing year, with the number of
              days of each month that fall inside the window.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="eyebrow">
                  Month
                </th>
                <th scope="col" className="eyebrow">
                  Days
                </th>
                <th scope="col" className="eyebrow">
                  Contributions
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.months.map((m) => (
                <tr key={m.label}>
                  <th scope="row">{m.label}</th>
                  {/* The first and last month of a trailing window are both
                      partial, which a reader comparing twelve totals has to be
                      told before the comparison means anything. */}
                  <td>{m.days}</td>
                  <td>{count(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
