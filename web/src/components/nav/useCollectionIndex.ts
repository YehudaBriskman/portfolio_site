import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NavIndexItem } from "./navIndex";

/*
 * Which plates are on this page, and which one the reader is on.
 *
 * Two answers from one pass over the DOM, because they are two readings of
 * the same question — "where is this object" — and asking twice would mean
 * two element lookups that could disagree about what the page contains.
 *
 *   present   the keys whose plate is in this document. An index item with a
 *             plate jumps; one without routes to the object's own page. This
 *             is why an item is never hidden and never dead: the destination
 *             changes, the item does not.
 *
 *   current   the one object the reader is actually looking at, which is what
 *             `aria-current` is for.
 *
 * No scroll listener, and that is a standing rule rather than a preference —
 * `hooks/useScrollProgress.ts` carries the measurements that got the site down
 * to one, and the chrome is not spending the budget again. An
 * IntersectionObserver wakes this up on crossings only; between crossings the
 * answer cannot have changed by more than the thresholds allow.
 */

/**
 * How many steps of a plate's visibility wake the observer.
 *
 * A single `threshold: 0` is not enough for this question. A plate taller than
 * the viewport fires once on the way in and once on the way out, so the
 * reader can scroll through two thousand pixels of one object while the bar
 * still marks the one before it. Eleven steps means a wake-up every tenth of
 * the plate's visible area — frequent enough that the mark never lags a
 * screen behind, and nowhere near the per-frame cost of a scroll handler.
 */
const THRESHOLDS = Array.from({ length: 11 }, (_, i) => i / 10);

/*
 * Where the page is read from.
 *
 * The probe is a point, not a line, and it sits just below the bar and in the
 * horizontal middle of the window. The first version of this was a 1px line
 * under the bar and "current is whatever straddles it", which is correct for
 * plates stacked vertically and completely wrong for the one place the
 * collection is laid out sideways: on a shelf, four cards share the same
 * vertical span, so all four straddled the line at once and the bar marked
 * the first of them whatever the reader had scrolled to. Measuring distance
 * from a point resolves both — vertical travel moves the probe between plates,
 * lateral travel moves the plates past the probe — with one expression and no
 * knowledge of which layout a beat happens to use.
 */
const PROBE_MIN_Y = 96;
const PROBE_FRACTION = 0.28;

/**
 * One late re-read, in milliseconds.
 *
 * `useProjects` is seeded from the project table, so every plate is in the
 * document on the first paint and the layout pass below finds them all. What
 * can still change is their *order*: a published collection arriving from the
 * API outranks a seed, and the home page shows the first few, so the set of
 * slugs with a plate can change once, shortly after mount. This is that once.
 * It is deliberately not a MutationObserver — the whole page re-renders on
 * that response and a subtree observer would be woken by every unrelated
 * commit for the lifetime of the session.
 */
const LATE_READ_MS = 900;

export type CollectionIndexState = {
  present: ReadonlySet<string>;
  current: string | null;
};

/**
 * @param items the index, in the order the bar prints it.
 * @param pathname the current route; the plates are re-read when it changes,
 *   because a different page has different plates and the chrome does not
 *   unmount between routes.
 */
export function useCollectionIndex(
  items: readonly NavIndexItem[],
  pathname: string
): CollectionIndexState {
  const [present, setPresent] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [current, setCurrent] = useState<string | null>(null);

  /* The last answer, read inside the observer callback. State would be a
     stale closure there and a dependency here would tear the observer down
     and rebuild it on every crossing. */
  const currentRef = useRef<string | null>(null);
  /* The decision itself, hoisted so the resize listener below can ask for it
     again without the observer being rebuilt to reach it. */
  const pickRef = useRef<() => void>(() => {});

  /*
   * A layout effect, not an effect.
   *
   * The destination of every index item depends on `present`, so resolving it
   * after the browser has painted would show one frame of an index pointing
   * at the wrong places — and on the home page that frame is the one the
   * reader's eye is already on. React commits the whole tree before effects
   * run, so the plates exist by the time this reads for them either way.
   */
  useLayoutEffect(() => {
    let observer: IntersectionObserver | null = null;
    /* Element -> index key, so the callback can name what it found without
       searching the list again. */
    let keyed = new Map<Element, string>();
    const visible = new Map<Element, boolean>();

    const pick = () => {
      const probeY = Math.max(PROBE_MIN_Y, window.innerHeight * PROBE_FRACTION);
      const probeX = window.innerWidth / 2;
      let bestKey: string | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const [el, key] of keyed) {
        /*
         * Off-screen plates are not candidates, which is what makes the mark
         * stick. Scrolled past the last plate into the footer, nothing is
         * visible and nothing wins — so the bar keeps marking the object the
         * reader came out of rather than blanking, which is the honest answer
         * to "where am I" and the one a table of contents gives.
         */
        if (!visible.get(el)) continue;
        /*
         * One rect per visible plate, inside a callback that fires on
         * crossings. Eight reads a few times a second is not the thing the
         * scroll budget was spent on; a layout read per frame was.
         */
        const r = el.getBoundingClientRect();
        const dy = r.top > probeY ? r.top - probeY : r.bottom < probeY ? probeY - r.bottom : 0;
        const dx = r.left > probeX ? r.left - probeX : r.right < probeX ? probeX - r.right : 0;
        const score = Math.hypot(dx, dy);
        if (score < bestScore) {
          bestScore = score;
          bestKey = key;
        }
      }

      if (bestKey && bestKey !== currentRef.current) {
        currentRef.current = bestKey;
        setCurrent(bestKey);
      }
    };

    pickRef.current = pick;

    const read = () => {
      const found = new Map<Element, string>();
      for (const item of items) {
        const el = document.getElementById(item.anchor);
        if (el) found.set(el, item.key);
      }

      /* Nothing moved: keep the observer and its accumulated visibility
         rather than rebuilding both and losing the current mark for a frame. */
      const same =
        found.size === keyed.size && [...found].every(([el, key]) => keyed.get(el) === key);
      if (same && observer) return;

      keyed = found;
      visible.clear();
      observer?.disconnect();

      const names = new Set(found.values());
      setPresent((was) =>
        was.size === names.size && [...names].every((k) => was.has(k)) ? was : names
      );

      /* A plate that has left the page cannot still be where the reader is. */
      if (currentRef.current && !names.has(currentRef.current)) {
        currentRef.current = null;
        setCurrent(null);
      }

      if (found.size === 0) {
        observer = null;
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) visible.set(e.target, e.isIntersecting);
          pick();
        },
        { threshold: THRESHOLDS }
      );
      for (const el of found.keys()) observer.observe(el);
    };

    read();
    const late = window.setTimeout(read, LATE_READ_MS);

    return () => {
      window.clearTimeout(late);
      observer?.disconnect();
    };
  }, [items, pathname]);

  /*
   * Resize is not a crossing.
   *
   * The probe is a fraction of the window's height, so a window that changes
   * shape moves it without any plate having crossed anything — and the
   * observer, quite correctly, says nothing. One re-pick on resize covers it;
   * it is the same trade `useScrollProgress` makes, and resize is not the
   * event the per-frame rule was written about.
   */
  useEffect(() => {
    const onResize = () => pickRef.current();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return { present, current };
}
