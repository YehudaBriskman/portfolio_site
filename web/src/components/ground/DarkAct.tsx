import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "@/components/ground/DarkAct.module.css";

/*
 * A dark act: the ground, the two seams and the drift, as one wrapper.
 *
 * ── there are two, and the pair is the argument ───────────────────────────
 *
 * The ceiling is two dark acts on this page and a third is a different page.
 * Which two is settled by the rule `index.css` already states for every
 * ground on the site — a ground changes where the SUBJECT changes — and under
 * that rule the pair picks itself:
 *
 *   Work      the work that was made
 *   The Year  the making of it
 *
 * Those are the only two sections on the home page whose subject is the work
 * itself. Approach is how the work gets thought about, the shelf is what gets
 * written, the spec plate is facts about the person and the close is an ask.
 * All four are the page talking ABOUT the work, and the page talks on paper.
 * So the dark ground is not a highlight applied to the two best sections; it
 * is what the page looks like when the work is the thing on screen.
 *
 * The year was the obvious candidate and the obvious reason is the weaker one.
 * "A city, at night" is a nice sentence and it is not an argument — it would
 * justify the dark ground on any section that happened to have a 3D act in
 * it. What makes it right is that the city is a year of real labour, which is
 * the one claim on the page that is not the owner's to write.
 *
 * Approach between them is not a gap; it is the separation, and it was already
 * argued for on exactly these grounds. `Index.tsx` puts the wall text between
 * the pile and the year because both of those acts carry real depth and
 * neither should read as the other's warm-up — written about motion, true
 * verbatim about ground. Two dark acts with nothing between them are one long
 * dark act with a seam in it.
 *
 * ── what a dark act needs, and the half of it that fails silently ─────────
 *
 * `.on-panel` AND `data-chrome="dark"`, and the two are not interchangeable.
 * The first re-points `--canvas`, `--canvas-2`, `--canvas-3`, `--ink`,
 * `--ink-soft`, `--rule`, `--rule-firm`, `--signal` and `--shade`, and — the
 * part that actually matters — restates `color`, because `color` inherits as a
 * computed value and redefining `--ink` on a subtree does not re-ink text that
 * already resolved on `<body>`. The second is the hook `nav/useDarkChrome.ts`
 * observes to switch the nav island's material while the act passes under it.
 *
 * Neither of them is applied here, and that is deliberate rather than an
 * omission: both belong on the `<section>` so that the ground genuinely drops
 * out from under the content edge to edge, which `Work.tsx` explains at
 * length. This wrapper paints the plate; the section inside it carries the
 * palette. `index.css` hands `.ground > .on-panel` a transparent background
 * for exactly that split.
 *
 * ── the observer, on a page that is proud of having almost none ───────────
 *
 * There is one, and §7 of the motion contract is the standard it has to meet:
 * no scroll listener, no `requestAnimationFrame`, no per-frame work, and no
 * React state churn. This fires at most twice per visit to each act — once in,
 * once out — and all it does is flip one attribute that the stylesheet reads.
 * The drift is four composited layers being translated, which is the kind of
 * work the compositor does for free and the main thread does not see at all;
 * what it is not free of is GPU time, and a layer animating under a reader who
 * is three sections away has no claim on that.
 *
 * `rootMargin: 100% 0px` puts the boundary a full viewport above and below the
 * window, so the switch is always made while the act is entirely off screen.
 * That is what makes cancelling the loops safe: cancelling restarts them at
 * 0%, and nobody is watching when it happens.
 */

/**
 * Does this reader's engine have the API the pause depends on?
 *
 * No observer, no pause — and the act drifts, which is the right fallback for
 * the same reason `useEnteredOnce` takes it: the finished state of this layer
 * is the one that moves, and an engine with no `IntersectionObserver` should
 * get the page rather than get a flat fill because an optimisation was
 * unavailable.
 */
function canObserve(): boolean {
  return typeof IntersectionObserver === "function";
}

type DarkActProps = {
  children: ReactNode;
};

export default function DarkAct({ children }: DarkActProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drifting, setDrifting] = useState(() => !canObserve());

  useEffect(() => {
    const el = ref.current;
    if (!el || !canObserve()) return;

    const observer = new IntersectionObserver(
      (entries) => {
        /*
         * `some` rather than `entries[0]`: one target, but a single callback
         * can carry several records for it when the element crosses the
         * boundary more than once inside one frame, and the last record is
         * not guaranteed to be the current one in every engine. Any
         * intersecting record means the act is in reach.
         */
        setDrifting(entries.some((entry) => entry.isIntersecting));
      },
      /*
       * A full viewport of slack on the block axis and none on the inline
       * axis. The act is always the full width of the page, so an inline
       * margin would only ever widen a box that already spans the window.
       */
      { rootMargin: "100% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      /*
       * `layer-section` and `ground` are the page's own plate classes and they
       * stay — the breathing room and the panel fill are not this component's
       * inventions. `styles.act` adds the arc, the hairline and the seams, and
       * it is unlayered CSS Modules output, so it wins over the plain radius
       * `@layer components` sets for a plate.
       */
      className={`layer-section ground ${styles.act}`}
      data-ground="panel"
      data-drift={drifting ? "on" : "off"}
    >
      {/* Both seams are in the DOM under every switch. What the switches take
          away is the movement, never the boundary — the arcs and their
          hairlines are drawn by `.act` and by `.crest` and are not animated at
          all, so a reader who has asked for no motion still gets the edge. */}
      <div className={styles.seam} data-edge="start" aria-hidden="true" />
      {children}
      <div className={styles.seam} data-edge="end" aria-hidden="true" />
      {/* Last, so it paints over the end seam. See `.crest` in the
          stylesheet: the light leaking around a near object is the point. */}
      <div className={styles.crest} aria-hidden="true" />
    </div>
  );
}
