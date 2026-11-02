import { MOTION_PAUSED_KEY } from "@/components/nav/useMotionPaused";

/*
 * Where the visit's entry is: still behind the shutter, lifting, or lifted.
 *
 * WHY THIS EXISTS (#194)
 * ----------------------
 * The hero's arrival used to start on its own clock at mount, and the shutter
 * starts lifting when the page under it is *ready* — fonts settled, the
 * first screen's images settled — which is always later than the mount. So
 * the arrival played behind the cover and the reader was shown a screen that
 * had already arrived. Measured: the first letter started 50-150ms *before*
 * the first tile left, and on a slow load the whole arrival could finish
 * under the grid.
 *
 * A delay cannot fix that, because the lift has no fixed time: it is a frame
 * or two on a warm cache and up to `CEILING_MS` on a cold one. So the shutter
 * says when it lifts, and anything that wants to arrive with the page waits
 * to be told. This module is that one signal, in three forms for three kinds
 * of reader:
 *
 *   - `getEntry` / `subscribeEntry` — a store for React, read through
 *     `useSyncExternalStore`, so a component re-renders in the same commit
 *     the shutter publishes from.
 *   - `<html data-entry="covered|lifting|lifted">` — for a stylesheet, a
 *     test or a measuring script that does not want React.
 *   - an `entry:lifting` / `entry:lifted` event on `window`.
 *
 * It only moves forward. The shutter runs once a visit, so `lifted` is final,
 * and a component that mounts after it (a client-side navigation back to the
 * home page) can tell that it is not part of the entry and has nothing to
 * wait for.
 *
 * THE THREE OFF-SWITCHES
 * ----------------------
 * Under any of them there is no shutter, so there is nothing to wait for and
 * the entry starts `lifted`. The decision is taken here, once, and the
 * shutter reads it rather than taking its own — so the shutter and anything
 * waiting on it can never disagree about whether there is a cover.
 */

export type Entry = "covered" | "lifting" | "lifted";

const ORDER: readonly Entry[] = ["covered", "lifting", "lifted"];

/**
 * Whether this reader has asked for no motion, by any of the three routes.
 *
 * Reduced motion and a missing `body.motion-paused`, plus the stored Pause
 * preference the class has not been applied from yet — the shutter mounts
 * before the nav's effect has put the class on the body, so the class alone
 * would answer "motion on" for a reader who switched it off last visit.
 */
export function motionIsOff(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false) return true;
  if (document.body.classList.contains("motion-paused")) return true;
  try {
    return localStorage.getItem(MOTION_PAUSED_KEY) === "1";
  } catch {
    /* Private browsing, or site data blocked. Not being able to read the
       stored choice is not a reason to refuse the loader; the class arrives
       an effect later and the stylesheet takes it from there. */
    return false;
  }
}

let entry: Entry | null = null;
const listeners = new Set<() => void>();

function write(next: Entry) {
  entry = next;
  if (typeof document !== "undefined") document.documentElement.dataset.entry = next;
}

/** The entry as it stands. The first read decides whether there is a cover at all. */
export function getEntry(): Entry {
  if (entry === null) write(motionIsOff() ? "lifted" : "covered");
  return entry as Entry;
}

/** Move the entry forward. Called by the shutter only; a step backwards is ignored. */
export function setEntry(next: Entry): void {
  if (ORDER.indexOf(next) <= ORDER.indexOf(getEntry())) return;
  write(next);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(`entry:${next}`));
  for (const listener of listeners) listener();
}

export function subscribeEntry(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests: forget the visit, so the next read decides afresh. */
export function resetEntryForTests(): void {
  entry = null;
  if (typeof document !== "undefined") delete document.documentElement.dataset.entry;
}
