/*
 * Real series from dates the admin already loaded. Nothing here invents a
 * point: a count per week is how many items existed at that week's end.
 */

const DAY = 86_400_000;

const times = (iso: string[], now: number) =>
  iso.map((s) => Date.parse(s)).filter((t) => Number.isFinite(t) && t <= now);

/**
 * Cumulative count at the end of each of the last `weeks` weeks, oldest first.
 * Empty (draw nothing) when there is nothing, or the line would be flat.
 */
export function weeklyTotals(iso: string[], now: number, weeks = 12): number[] {
  const t = times(iso, now);
  if (t.length === 0) return [];
  const out = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    return t.filter((x) => x <= end).length;
  });
  return out[0] === out[out.length - 1] ? [] : out;
}

/** How many dates fall in the last `days` days. */
export function added(iso: string[], now: number, days = 30): number {
  return times(iso, now).filter((x) => x > now - days * DAY).length;
}
