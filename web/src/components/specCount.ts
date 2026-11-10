/*
 * The spec plate's count, driven from script where the stylesheet's own
 * scroll-driven count cannot be trusted (#stability).
 *
 * The stylesheet counts `--spec-n` from nought to the figure on a view
 * timeline. On a phone that is the weak point: an animated registered custom
 * property is main-thread work, a touch scroll is a stream of coarse jumps,
 * and the figure arrived as a few unrelated numbers and then the final one, a
 * lag from 0 to the real value, not a count. So on a coarse pointer (and on an
 * engine with no view timelines at all) the number is eased here instead: the
 * reader's scroll still decides where it should be, and a short damped
 * follower walks the printed figure there, so the count is smooth whatever the
 * scroll did. Same range as the stylesheet's, same resting value, same
 * off-switches (reduced motion, Pause).
 */

/** Where the plate's count stands, 0..1, for the plate's top edge `top` in a window `vh` tall. */
export function countProgress(top: number, vh: number): number {
  if (!Number.isFinite(top) || !Number.isFinite(vh) || vh <= 0) return 1;
  /* Starts as the plate's top is 5% up from the window's foot, ends when it
     reaches 45% down from the top: a little over half a window of scroll. */
  const start = vh * 0.95;
  const end = vh * 0.45;
  const p = (start - top) / (start - end);
  return Math.min(1, Math.max(0, p));
}

/** One step of the damped follower: `shown` moves toward `target` by a fraction of the gap that depends on `dt` seconds. */
export function follow(shown: number, target: number, dt: number): number {
  const d = Math.min(Math.max(dt, 0), 0.1);
  const next = shown + (target - shown) * (1 - Math.exp(-d * 8));
  return Math.abs(target - next) < 0.0005 ? target : next;
}

/** The integer printed for a figure of `value` at progress `p`. */
export function printed(value: number, p: number): number {
  const v = Math.max(0, Math.round(value));
  return Math.min(v, Math.max(0, Math.round(v * p)));
}

/** Whether the count should be driven from script on this device and in this state. */
export function scriptCounts(env: { coarse: boolean; viewTimelines: boolean; reducedMotion: boolean; paused: boolean }): boolean {
  if (env.reducedMotion || env.paused) return false;
  return env.coarse || !env.viewTimelines;
}
