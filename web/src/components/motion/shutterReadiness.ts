/*
 * When the entry shutter may leave, as a pure decision.
 *
 * `EntryShutter.tsx` gathers four facts about the page under it and asks this
 * what to do. Kept apart so the rule can be tested without a clock, a DOM or
 * a browser, and because the rule is the whole of what went wrong once: the
 * tiles left on fonts and images alone, so on a slow link they dissolved over
 * a page whose route chunk had not even rendered.
 *
 * THE THREE ANSWERS
 * -----------------
 *   wait   keep the sheet up
 *   tiles  run the centre-out wave; the page under it is worth looking at
 *   fade   the page never came: one opacity fade of the whole sheet, no tiles
 *   none   no shutter at all (reduced motion, Pause)
 *
 * "Content" is the route's own: the Suspense boundary has resolved (no
 * `RouteFallback` is mounted) and the page's first heading is in the document.
 * Fonts and first-screen images are *polish* on top of content, and are what
 * the soft ceiling gives up on. Content itself is never given up on, because
 * tiles over nothing are the bug.
 *
 * THE TWO DEADLINES
 * -----------------
 *   CEILING_MS   6000. Past it, fonts and images are no longer waited for:
 *                a page whose text is there but whose font or photograph is
 *                crawling is shown as it is. It was 1800 when it also decided
 *                the content, and 1800 is a warm-cache number; a mid-range phone
 *                on a congested 3G link takes 4-5 s for the route chunk alone,
 *                so 6 s covers that without making a dead connection wait much
 *                longer than it would anyway.
 *   HARD_CAP_MS  10000. If there is still no content the sheet fades out in one
 *                200 ms opacity transition and the fallback skeleton under it
 *                (or whatever the page has by then) is what the reader sees.
 *                Not forever: a black window with no way out is worse than an
 *                honest skeleton. No tiles: a wave over nothing is the bug.
 */

export const CEILING_MS = 6000;
export const HARD_CAP_MS = 10000;
/** The fade's duration; the stylesheet's transition must match. */
export const FADE_MS = 200;

export type ShutterFacts = {
  /** Milliseconds since the tiles appeared. */
  elapsed: number;
  /** `document.fonts.ready` has settled (or there is no `document.fonts`). */
  fontsReady: boolean;
  /** No first-screen image is still loading. An `error` counts as settled. */
  imagesSettled: boolean;
  /** The route's Suspense boundary has resolved: no RouteFallback is mounted. */
  routeResolved: boolean;
  /** The page's first heading is in the document. */
  hasHeading: boolean;
  /** Reduced motion or Pause: there is no shutter. */
  motionOff?: boolean;
};

export type ShutterDecision = "wait" | "tiles" | "fade" | "none";

export function decideShutter(f: ShutterFacts): ShutterDecision {
  if (f.motionOff) return "none";
  const content = f.routeResolved && f.hasHeading;
  if (content && f.fontsReady && f.imagesSettled) return "tiles";
  if (content && f.elapsed >= CEILING_MS) return "tiles";
  if (!content && f.elapsed >= HARD_CAP_MS) return "fade";
  return "wait";
}

/*
 * The route boundary's readiness signal: how many `RouteFallback`s are
 * mounted. A fallback is only in the document while a lazy chunk is pending,
 * so zero means every boundary on the page has resolved. Counting, not a
 * boolean, because a fallback can unmount a commit after the next mounts.
 */
let pending = 0;

export function routeFallbackMounted(): () => void {
  pending += 1;
  return () => {
    pending -= 1;
  };
}

export const routeResolved = () => pending === 0;

/** The first heading of the page's own content. `main h1` is what RouteAnnouncer trusts too. */
export const pageHasHeading = () => document.querySelector("main h1, main h2, h1") !== null;
