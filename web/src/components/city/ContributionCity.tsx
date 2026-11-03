import { useRef, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import InkRule from "@/components/motion/InkRule";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import { cityPlan, EMPTY_PLAN, monthLabel, type CityPlan } from "@/components/city/cityPlan";
import { INTL, useLang, type Lang } from "@/components/dashboard/i18n";
import { useCityWords } from "@/i18n/pages";
import { useCityHand } from "@/components/city/useCityHand";
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
 * The arrival is two scroll-driven animations — the tilt-and-rise on the
 * scene and the camera's dolly inside it — and the whole argument for them —
 * why a scrub, why a held runway is still not a second peak, why 365 columns
 * cost two animations rather than 365 — is at the top of
 * `ContributionCity.module.css`, next to the declarations answerable to it.
 * This file decides what a column is worth, what the caption says, which of
 * the three states the section is in, and (since #111) where the reader's own
 * hand is let in.
 *
 * The scroll still has no listener. The grid is 365 spans with one custom
 * property each, written once when the request lands and never touched again
 * by React. What #111 added is three refs and one hook, `useCityHand`, which
 * listens to POINTER events on the frame — never to scroll — and writes a
 * single inline `rotateZ` and two data attributes. It runs a settle loop only
 * between a release and the city coming to rest, under a second or so; that
 * is the one documented exception to §7's "no rAF loops", and the reasoning
 * (and what it costs, measured) is at the top of `useCityHand.ts`.

 * The ground, and why this section is the one that got the second one
 * --------------------------------------------------------------------
 * It stands on the dark act now. The obvious reason is the nice sentence — a
 * city, at night — and that is the weaker one, because it would justify a
 * dark ground under any section that happened to have a 3D act in it. The
 * reason that holds is the rule `index.css` already applies to every ground
 * on the site: a ground changes where the SUBJECT changes. Work is the work
 * that was made and this is the making of it, and those two are the only
 * sections on the page whose subject is the work itself. Everything between
 * and after is the page talking about the work, and it talks on paper.
 *
 * The ceiling is two, the argument is in `components/ground/DarkAct.tsx`, and
 * the thing it cost is in the stylesheet beside this file: the cells are ink
 * over the ground, so the whole five-band ramp had to be re-derived and
 * re-measured on the other side of it. The claim in `cityPlan.ts` that colour
 * and height "differ in resolution and not in source" is untouched by that —
 * it is a claim about `count`, and the ground does not get a vote.
 *
 * Why the columns are touchable, and one stop rather than 365
 * -------------------------------------------------------------
 * GitHub's grid gives every day a tooltip and a focus stop, and copying that
 * here would put 365 stops in front of a reader navigating by keyboard —
 * which is not access to a chart, it is a queue in front of one. So the scene
 * is `aria-hidden` and the data has a real text equivalent: a caption with the
 * window, the total and the busiest day, and a `details` holding the twelve
 * months as a table. The `details` is deliberately not `sr-only`; the
 * reasoning is on `.table` in the stylesheet.
 *
 * #111 let a pointer turn the city and read one day. #190 asked that every
 * object, buildings included, show its date and count on hover, on keyboard
 * focus and on tap — so there is ONE shared tooltip, stood over whichever
 * object is being read, and the frame is ONE focus stop whose arrow keys rove
 * between days (the grid pattern without 365 tabindexes). No column has a
 * tabindex, a role or a label. The tooltip is `aria-hidden` like the scene;
 * a keyboard reader hears one polite status line instead, written only on
 * keyboard moves. `data-date` and `data-count` are on real cells only, so the
 * empty lattice has nothing to read and the frame is not focusable then.

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
 *   and it was measured rather than assumed: before #111 the frame was
 *   `height: auto` when empty and `clamp(140px, 16vw, 240px)` when a year
 *   was in it, and the arriving city pushed everything under it down by
 *   108.69px at 1440x900 — a layout shift of 0.0345 for a reader parked on
 *   the section. Since #111 the stage is the held frame plus its runway, and
 *   pending keeps that whole height for the same reason; only unavailable
 *   gives it up.
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
function longDate(date: string, lang: Lang): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(INTL[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function count(n: number, lang: Lang): string {
  return n.toLocaleString(INTL[lang]);
}

/**
 * The window, for the section's eyebrow.
 *
 * Short form — `Nov 2025 – Nov 2026` — because the eyebrow shares a row with a
 * display heading and the long form wraps that row onto two lines at every
 * width below a desktop. The long form is in the caption, where there is a
 * measure to hold it.
 */
function windowLabel(plan: CityPlan, from: string | null, to: string | null, lang: Lang): string {
  if (!from || !to || plan.cells.length === 0) return useCityWords.of(lang).trailing;
  const short = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(INTL[lang], {
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
  const lang = useLang();
  const w = useCityWords();
  const plan = year ? cityPlan(year) : EMPTY_PLAN;
  const cells = cellsOf(plan);
  const empty = plan.cells.length === 0;
  const live = !isPending && !empty;

  /* Four refs for the hand, and the only four in the file. They are read
     once, by the effect in `useCityHand`, and never drive a render. */
  const frameRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const sayRef = useRef<HTMLSpanElement>(null);
  useCityHand(frameRef, orbitRef, tipRef, sayRef, live);

  return (
    <section id="year" data-chrome="dark" className="on-panel relative isolate">
      {/*
        The ground is on the <section> and the measure is one level in, which
        is the shape `Work.tsx` argues for and the reason is the same: the
        ground has to drop out from under the act edge to edge. With
        `.on-panel` and `.wrap` on one element the dark act would be a 1152px
        rectangle standing on paper.

        `data-chrome="dark"` is the other half of a dark act and it is the half
        that fails silently if it is left off — it is the hook
        `nav/useDarkChrome.ts` observes to switch the nav island's material
        while this section passes under it. `.on-panel` alone would leave the
        bar in its paper material over a near-black ground.
      */}
      <div className="wrap section-y">
        {/* The same centred head every section on this page takes; the layout
            is `.section-head` in index.css. */}
        <div className="section-head">
          <InkRule className="section-head-rule" />
          <h2 className="display text-section leading-[0.9]">{w.title}</h2>
          <InkRule className="section-head-rule" />
          <p className="eyebrow section-head-note tabular-nums">
            {windowLabel(plan, year?.from ?? null, year?.to ?? null, lang)}
          </p>
        </div>

        <figure className={styles.figure}>
          {/*
            Three boxes where there was one, and each owns one thing.

            The STAGE owns the clock and the scroll it costs. It is the static
            wrapper §1 of the motion contract prescribes for anything held: as
            tall as the frame plus the travel the act is allowed to buy, still
            moving through the scrollport while the frame is held, so its view
            timeline keeps ticking. `data-city` is on it because the data side
            switches the travel off along with the act, and it carries three
            values, not two — see the fourth exit in the stylesheet, and the
            argument at the top of this file for why a year that is still
            coming is not the same state as a year that is not.

            The FRAME is the camera, held in the window by `position: sticky`
            while the stage runs past it. It is also the one surface the hand
            touches: the listeners in `useCityHand` are on it, and its
            `touch-action` decides what a finger may do here.

            The SCENE is what moves. `aria-hidden` on the scene and not on the
            frame, so the frame stays an ordinary box in the tree and the
            figure keeps its caption.
          */}
          <div
            className={styles.stage}
            data-city={isPending ? "pending" : empty ? "empty" : "year"}
          >
            {/*
              One focus stop for the whole year (#190), and only once there is
              a year in it. The arrows rove between days inside; the label says
              so, because a group is otherwise silent about its keys.
            */}
            <div
              ref={frameRef}
              className={styles.frame}
              {...(live
                ? {
                    tabIndex: 0,
                    role: "group",
                    "aria-label": w.frame,
                  }
                : {})}
            >
              <div className={styles.scene} aria-hidden="true">
                {/* The hand's turn, written by `useCityHand` as one inline
                    transform, and the scroll's dolly inside it. The nesting
                    order is the geometry — `.orbit` in the stylesheet says
                    why. */}
                <div ref={orbitRef} className={styles.orbit}>
                  <div className={styles.dolly}>
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
                            The date and the count ride on the cell for the pointer's
                            readout and nothing else: the hand hit-tests a column and
                            reads them back off it, so the readout can never disagree
                            with the column it lit. Placeholders carry neither, so a
                            pending or empty lattice has nothing to read.
                          */
                          data-date={empty ? undefined : cell.date}
                          data-count={empty ? undefined : cell.count}
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
              </div>

              {/*
                The hint line, shared by all 365 columns.

                `aria-hidden` with the scene, because it is the scene's legend
                and says nothing the table does not: a screen reader reaching it
                would hear a hint about dragging, which it cannot do, and a date
                it did not ask for. Not a live region for the same reason —
                announcing every column a mouse crosses is noise on a path that
                already has the year as text.

                Two hints, one per kind of pointer; the stylesheet shows the one
                that matches `(hover: hover)`. Drawn only with a year in the
                scene: a lattice with nothing in it has nothing to read and
                nothing worth turning.
              */}
              {live && (
                <div className={`eyebrow ${styles.readout}`} aria-hidden="true">
                  <span className={styles.hint} data-hint="pointer">
                    {w.drag}
                  </span>
                  <span className={styles.hint} data-hint="touch">
                    {w.swipe}
                  </span>
                </div>
              )}

              {/*
                The tooltip, shared by every object in the scene: the date and
                the count of whichever day is pointed at, tapped or reached by
                the arrows, stood over that object by `useCityHand`. Out of
                flow and moved by `transform` alone, so showing it shifts
                nothing. `aria-hidden` for the readout's reason; the keyboard's
                spoken copy is the status line under it, written only when the
                keyboard moves.
              */}
              {live && (
                <>
                  <span ref={tipRef} className={styles.tip} aria-hidden="true" />
                  <span ref={sayRef} className="sr-only" role="status" />
                </>
              )}
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
            {isPending && w.reading}
            {!isPending && year?.error}
            {!isPending && !empty && plan.total !== null && (
              <>
                {w.contributionsOver(count(plan.total, lang), count(plan.cells.length, lang))}
                {year?.from && year?.to && w.between(longDate(year.from, lang), longDate(year.to, lang))}
                {w.active(count(plan.active, lang))}
                {plan.busiest && w.busiest(longDate(plan.busiest.date, lang), count(plan.busiest.count, lang))}
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
            {/*
              A `div` and not a `p`, and on this ground that is worth 0.97px.

              `index.css` gives the dark act a leading and tracking
              compensation for body copy — `.on-panel :is(p, li, dd, .body)`
              at `line-height: 1.68` — because the text face needs more air
              over a near-black ground. A `p` picks it up at a specificity
              `.eyebrow` cannot beat. The control this line stands in for is a
              `summary`, which is not in that list and keeps the eyebrow's own
              1.6, so the placeholder was 20.16px against the summary's
              19.19px and the row 37.16px against 36.19px — measured at
              1440x900, in the rendered page, on both arms.
            */}
            <div className="eyebrow">
              <SkeletonLines lines={1} tail="11rem" />
            </div>
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
            <summary className={`eyebrow ${styles.summary}`}>{w.table}</summary>
            <table className={styles.months}>
              <caption className="sr-only">
                {w.tableCaption}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="eyebrow">
                    {w.month}
                  </th>
                  <th scope="col" className="eyebrow">
                    {w.days}
                  </th>
                  <th scope="col" className="eyebrow">
                    {w.contributions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.months.map((m) => (
                  <tr key={m.label}>
                    <th scope="row">{monthLabel(m.ym, INTL[lang])}</th>
                    {/* The first and last month of a trailing window are both
                        partial, which a reader comparing twelve totals has to be
                        told before the comparison means anything. */}
                    <td>{m.days}</td>
                    <td>{count(m.total, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>
    </section>
  );
}
