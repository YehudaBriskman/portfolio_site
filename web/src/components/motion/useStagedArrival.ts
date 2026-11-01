import { useEffect, useState } from "react";

/**
 * One step of a sequence that waits for the step before it.
 */
export type ArrivalStage = {
  /** The token this stage publishes the moment it begins. */
  name: string;
  /**
   * The element whose animation ending means this stage is over, as a
   * selector resolved against the document.
   *
   * It is a selector and not a ref because one of the stages animates an
   * element outside the React tree that starts it, and because the thing
   * being waited for is "whatever the stylesheet is moving" — which is a
   * statement a stylesheet and a selector can agree on and a ref cannot.
   *
   * The last stage has none: nothing waits for it, so there is nothing to
   * listen for.
   */
  endsWith?: string;
};

export type StagedArrivalOptions = {
  /** The stages, in order. Must be a stable reference — a module constant. */
  stages: readonly ArrivalStage[];
  /**
   * A `data-*` key on `document.body`, for the stages that are not in the
   * React tree. The nav is fixed, rendered by a sibling of the section that
   * sequences it, and reachable from a stylesheet only through the body.
   */
  publishAs: string;
};

/**
 * Longer than the longest stage, and that is the whole constraint on it.
 *
 * A seatbelt shorter than a stage would cut the stage off mid-gesture and the
 * next one would start on top of it, which is the exact failure the sequence
 * exists to avoid. Every stage in `Hero.tsx` finishes inside a second; this
 * is 1600ms so that a stage has to have genuinely stalled, not merely run
 * long, before the sequence stops waiting for it.
 */
const SEATBELT_MS = 1600;

/**
 * Whether this reader has asked for no motion, by either of the two routes.
 *
 * Read once, during the first render, because the answer decides what the
 * first painted frame looks like. The stylesheets carry the same two
 * conditions and land every part on its arrived state — this is not the
 * off-switch, it is the sequencer declining to run a sequence whose steps
 * would never report finishing, because `animation: none` fires no events.
 *
 * The Pause class is read optimistically. `useMotionPaused` restores a stored
 * preference in an effect, so a returning reader who pressed Pause last visit
 * has not had the class applied yet at this point. That costs a sequence that
 * starts and is then cancelled out from under itself by the paused
 * stylesheet, which is what `animationcancel` below is for.
 */
function motionIsOff(): boolean {
  if (typeof window === "undefined") return true;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return reduced || document.body.classList.contains("motion-paused");
}

/*
 * A sequence whose every step waits for the one before it to finish.
 *
 * Why this is not four delays
 * ---------------------------
 * Four animations with delays of 0, 750, 1210 and 1550ms land in the right
 * order on the machine they were tuned on and nowhere else. A font that
 * arrives late, a slow first paint, a reader on a phone that throttles the
 * compositor — any of them moves one step and not the others, and the
 * sequence reads as four things that happen to be staggered. Here each step
 * publishes a token when it *begins*, the stylesheet starts that step's
 * animation when the token appears, and the token appears only when the
 * previous step's own `animationend` has fired. The order is therefore a
 * consequence of the animations rather than a prediction about them.
 *
 * What it costs, and why that is affordable here
 * ----------------------------------------------
 * One piece of React state and one listener on `document`, which is more than
 * any other motion component on this site spends — `docs/motion-contract.md`
 * §7 says so, and the reason it can say so is that nothing else here measures
 * anything per frame. This does not either: `animationend` fires a handful of
 * times for the whole sequence and the listener is removed the moment the
 * last stage begins. There is no scroll listener, no `requestAnimationFrame`
 * loop and no work in a paint.
 *
 * The three ways it can fail, and where each one lands
 * ----------------------------------------------------
 * - **A reader who asked for no motion**, by OS setting or by Pause. The
 *   stylesheets cancel every animation and restate the arrived state, so no
 *   step would ever report finishing. The sequencer sees that at first render
 *   and publishes every token at once, so the stylesheet is never waiting for
 *   a stage that is not coming.
 * - **Pause pressed mid-sequence.** The paused stylesheet cancels whatever is
 *   running, which fires `animationcancel` rather than `animationend`. Both
 *   advance, so the remaining tokens arrive promptly instead of waiting out
 *   the seatbelt.
 * - **Anything else** — a background tab, an engine that fires no animation
 *   events, a stylesheet that failed to load. The seatbelt advances the stage
 *   anyway. The sequence then degrades to the four delays this file exists
 *   not to be, which is the correct thing to degrade *to*: the page always
 *   finishes arriving.
 */
export function useStagedArrival({ stages, publishAs }: StagedArrivalOptions): string {
  /*
   * How many stages have begun, not how many have finished.
   *
   * One at the first render, because the first stage starts on the first
   * painted frame and has nothing to wait for — the hero is the top of the
   * document and is in view before an observer could be constructed.
   */
  const [begun, setBegun] = useState<number>(() => (motionIsOff() ? stages.length : 1));

  useEffect(() => {
    if (begun >= stages.length) return;

    const running = stages[begun - 1];
    const advance = () => setBegun((n) => (n === begun ? n + 1 : n));
    const seatbelt = window.setTimeout(advance, SEATBELT_MS);

    const onSettled = (e: Event) => {
      const target = e.target;
      if (!running.endsWith || !(target instanceof Element)) return;
      if (!target.matches(running.endsWith)) return;
      window.clearTimeout(seatbelt);
      advance();
    };

    /* On `document`, because one of the stages moves the fixed bar, which is
       not a descendant of the section that sequences it. An animation on any
       other element in the page reaches this handler and is dropped by the
       selector test, which is two property reads. */
    document.addEventListener("animationend", onSettled);
    document.addEventListener("animationcancel", onSettled);

    return () => {
      window.clearTimeout(seatbelt);
      document.removeEventListener("animationend", onSettled);
      document.removeEventListener("animationcancel", onSettled);
    };
  }, [begun, stages]);

  const arrived = stages
    .slice(0, begun)
    .map((s) => s.name)
    .join(" ");

  /* Published on the body as well as returned, because the chrome is outside
     the React tree. Removed on unmount: every other page on the site renders
     the same bar and must not inherit this one's pre-arrival state. */
  useEffect(() => {
    document.body.dataset[publishAs] = arrived;
    return () => {
      delete document.body.dataset[publishAs];
    };
  }, [arrived, publishAs]);

  return arrived;
}
