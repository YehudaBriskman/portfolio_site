/*
 * Warm-up for a new sender: a mailbox provider has no history for a domain that
 * never sent bulk mail, so the first days are kept small and grow (Google's and
 * Resend's sender guidance: consistent rate, no bursts, never double suddenly).
 *
 * Pure. The ramp only ever LOWERS what the owner configured; it never raises a
 * cap and never writes to the saved settings. Day 1 starts at the first
 * newsletter send (`firstSendAt` on the rate doc); before that it is day 1.
 */
const DAY_MS = 24 * 3_600_000;

export const WARMUP_DAYS = 14;
/* Day 1..4, then a plateau until the window ends. Deliberately below Resend's new-domain table: a personal list is small. */
const DAILY = [20, 30, 50, 75, 100];
const HOURLY = [10, 10, 15, 20, 30];

export type WarmupLimits = { day: number; daily: number; hourly: number };

export function warmupDay(firstSendAt: string | undefined, now: number): number {
  const first = firstSendAt ? Date.parse(firstSendAt) : NaN;
  if (!Number.isFinite(first)) return 1;
  return Math.max(1, Math.floor((now - first) / DAY_MS) + 1);
}

/** What the ramp allows today, or null when it is off or over. */
export function warmupLimits(enabled: boolean, firstSendAt: string | undefined, now: number): WarmupLimits | null {
  if (!enabled) return null;
  const day = warmupDay(firstSendAt, now);
  if (day > WARMUP_DAYS) return null;
  const i = Math.min(day, DAILY.length) - 1;
  return { day, daily: DAILY[i]!, hourly: HOURLY[i]! };
}

export function effectiveCaps(
  s: { throttlePerHour: number; dailyCap: number; warmup: boolean },
  firstSendAt: string | undefined,
  now: number,
): { throttlePerHour: number; dailyCap: number; warming: boolean; day: number | null } {
  const w = warmupLimits(s.warmup, firstSendAt, now);
  if (!w) return { throttlePerHour: s.throttlePerHour, dailyCap: s.dailyCap, warming: false, day: null };
  return { throttlePerHour: Math.min(s.throttlePerHour, w.hourly), dailyCap: Math.min(s.dailyCap, w.daily), warming: true, day: w.day };
}
