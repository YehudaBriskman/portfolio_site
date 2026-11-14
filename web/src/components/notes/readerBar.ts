/*
 * When the reader's floating bar tucks away (phones only).
 *
 * Down hides it, up brings it back, and the top of the note always shows it.
 * A small wobble of the thumb (under TUCK_DELTA px) changes nothing, so the
 * bar does not flicker while a finger rests on the glass.
 */

/** Scroll position above which scrolling down tucks the bar. */
export const TUCK_AFTER = 160;
/** The smallest movement that counts as a direction. */
export const TUCK_DELTA = 6;

export function nextTucked(tucked: boolean, y: number, lastY: number): boolean {
  if (y <= TUCK_AFTER) return false;
  const dy = y - lastY;
  if (Math.abs(dy) < TUCK_DELTA) return tucked;
  return dy > 0;
}
