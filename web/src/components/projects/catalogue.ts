/*
 * Narrow the catalogue to one state, and only once there is something to
 * narrow.
 *
 * The filter has to earn its place, and with six projects it does not: the
 * whole register is two screens on a laptop, every row shows its state in the
 * same column, and a row of chips above it would hide less than it costs to
 * read. So it appears from `FILTER_FROM` projects and two distinct states up,
 * which is the point at which the register stops fitting in a glance. That is
 * a threshold on whether a control exists, not a number the motion is tuned
 * to — the rows animate the same either way.
 *
 * State rather than year: a state is a question a visitor actually has ("what
 * is he running now?"), and year is already the register's first column,
 * sorted, so it reads at a glance without a control. The selection lives in
 * the URL (`?state=`), so it can be linked and survives Back.
 */
export const FILTER_FROM = 9;

export type StateOption = { state: string; count: number };

/** Distinct states, in the order the register first shows them. */
export function statesOf(entries: { state: string }[]): StateOption[] {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.state, (counts.get(e.state) ?? 0) + 1);
  return [...counts].map(([state, count]) => ({ state, count }));
}

export function filterEarnsPlace(total: number, states: StateOption[]): boolean {
  return total >= FILTER_FROM && states.length > 1;
}

