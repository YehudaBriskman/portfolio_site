/*
 * The mail budget, as pure functions. A provider's free plan limits mail per
 * day and per month, shared by everything the site sends. Nothing here reads a
 * clock, a store or the network: the caller passes counts and times in, so the
 * rules can be tested without either.
 *
 *   usable   = limit x safety
 *   reserve  = a share of the day (at least MIN_RESERVE) that newsletters never touch,
 *              kept for confirmations and the contact form
 *   capacity = usable - used - reserve, never below 0
 *
 * The reserve is what is left of the share: transactional mail spends it first,
 * and only a transactional count above the share eats into the newsletter's room.
 * The month holds back the same amount (one day's share), so a month that is
 * nearly spent still leaves room for confirmations. At 0 a campaign waits for
 * the next window. There is no overage.
 */

export const MIN_RESERVE = 10;
export const DAY_MS = 24 * 3_600_000;

export type BudgetLimits = { dailyLimit: number; monthlyLimit: number; safety: number; reserveShare: number };
export type SendCaps = { throttlePerHour: number; dailyCap: number };

/** What has been sent. Newsletters come from the send documents, transactional mail from the per-day counters. Rolling 24 h and calendar month (UTC). */
export type Usage = { newsDay: number; newsMonth: number; transDay: number; transMonth: number };

export type Budget = {
  usableDay: number;
  usableMonth: number;
  reserve: number;
  usedDay: number;
  usedMonth: number;
  /** Newsletter room left in the rolling day and in the month, each never below 0. */
  roomDay: number;
  roomMonth: number;
  /** What newsletters may send right now: the smaller room. */
  capacity: number;
  /** Why capacity is 0, or null while there is room. */
  waiting: "day" | "month" | null;
};

const whole = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

export const usableOf = (limit: number, safety: number) => whole(limit * safety);

/** The share of the day kept for transactional mail: the larger of MIN_RESERVE and the share, but never more than the whole usable day. */
export function reserveOf(usableDay: number, share: number): number {
  return Math.min(usableDay, Math.max(MIN_RESERVE, Math.ceil(usableDay * Math.max(0, share))));
}

export function computeBudget(limits: BudgetLimits, usage: Usage): Budget {
  const usableDay = usableOf(limits.dailyLimit, limits.safety);
  const usableMonth = usableOf(limits.monthlyLimit, limits.safety);
  const reserve = reserveOf(usableDay, limits.reserveShare);
  /* Transactional mail inside the share is already accounted for by holding the whole share back. */
  const roomDay = Math.max(0, usableDay - usage.newsDay - Math.max(usage.transDay, reserve));
  const roomMonth = Math.max(0, usableMonth - usage.newsMonth - Math.max(usage.transMonth, reserve));
  const capacity = Math.min(roomDay, roomMonth);
  return {
    usableDay, usableMonth, reserve,
    usedDay: usage.newsDay + usage.transDay,
    usedMonth: usage.newsMonth + usage.transMonth,
    roomDay, roomMonth, capacity,
    waiting: capacity > 0 ? null : roomMonth === 0 ? "month" : "day",
  };
}

/** How many a tick may send: the room, the hourly pace and the daily cap together. */
export function sendable(capacity: number, hourLeft: number, dayCapLeft: number): number {
  return Math.max(0, Math.min(whole(capacity), whole(hourLeft), whole(dayCapLeft)));
}

/* --- windows -------------------------------------------------------------- */

/** The first instant of the UTC calendar month holding `ms`, and of the next one. */
export const monthStart = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
export const nextMonthStart = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
};
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const monthKey = (ms: number) => new Date(ms).toISOString().slice(0, 7);

/** How many of `times` fall in the rolling window ending at `now`. */
export const inWindow = (times: readonly number[], now: number, windowMs = DAY_MS) => times.filter((t) => t > now - windowMs && t <= now).length;

/**
 * When a campaign held back by the budget may send again. A full month waits
 * for the first of next month; a full day waits until the oldest of the last
 * 24 h of newsletter sends has aged out. Null when there is room now.
 */
export function nextWindowAt(b: Budget, newsTimes: readonly number[], now: number): number | null {
  if (b.waiting === null) return null;
  if (b.waiting === "month") return nextMonthStart(now);
  const live = newsTimes.filter((t) => t > now - DAY_MS && t <= now);
  return (live.length ? Math.min(...live) : now) + DAY_MS;
}

/* --- how long a campaign takes -------------------------------------------- */

export type Finish = { days: number; finishAt: string };

/**
 * "Needs N days, finishing about <date>" for `remaining` recipients. The first
 * day sends what there is room for now; every later day sends a full day's
 * share (usable day less the reserve, within the hourly pace and the daily
 * cap), and a month that runs out waits for the first of the next. Null when
 * the settings leave no room at all, so there is no date to promise.
 */
export function estimateFinish(remaining: number, now: number, b: Budget, caps: SendCaps): Finish | null {
  if (remaining <= 0) return { days: 0, finishAt: new Date(now).toISOString() };
  const pace = Math.min(whole(caps.dailyCap), whole(caps.throttlePerHour) * 24);
  const perDay = Math.min(b.usableDay - b.reserve, pace);
  const perMonth = b.usableMonth - b.reserve;
  if (perDay <= 0 || perMonth <= 0) return null;
  let left = remaining;
  let cursor = now;
  let days = 0;
  let monthLeft = b.roomMonth;
  let todayCap = Math.min(b.capacity, pace);
  for (let guard = 0; guard < 2000; guard++) {
    if (monthLeft <= 0) {
      cursor = Math.max(cursor, nextMonthStart(cursor));
      monthLeft = perMonth;
      todayCap = perDay;
    } else if (todayCap <= 0) {
      cursor += DAY_MS;
      todayCap = perDay;
    }
    const take = Math.min(left, todayCap, monthLeft);
    days++;
    left -= take;
    monthLeft -= take;
    if (left <= 0) return { days, finishAt: new Date(cursor).toISOString() };
    cursor += DAY_MS;
    todayCap = perDay;
  }
  return null;
}

/* --- transactional mail ---------------------------------------------------- */

/**
 * Whether one more confirmation or contact mail may go. Always inside the
 * reserved share; beyond it only while the provider's own limits (not the
 * safety-reduced ones) still have room.
 */
export function transactionalAllowed(limits: BudgetLimits, usage: Usage): { ok: true } | { ok: false; reason: "day" | "month" } {
  const reserve = reserveOf(usableOf(limits.dailyLimit, limits.safety), limits.reserveShare);
  if (usage.transDay < reserve) return { ok: true };
  if (whole(limits.dailyLimit) - usage.newsDay - usage.transDay <= 0) return { ok: false, reason: "day" };
  if (whole(limits.monthlyLimit) - usage.newsMonth - usage.transMonth <= 0) return { ok: false, reason: "month" };
  return { ok: true };
}

/* --- alerts ----------------------------------------------------------------- */

export const BUDGET_THRESHOLDS = [70, 90] as const;
export type BudgetThreshold = (typeof BUDGET_THRESHOLDS)[number];

/** The thresholds of the monthly budget that `used` has reached, lowest first. */
export function thresholdsReached(used: number, usableMonth: number): BudgetThreshold[] {
  if (usableMonth <= 0) return [];
  const pct = (used / usableMonth) * 100;
  return BUDGET_THRESHOLDS.filter((t) => pct >= t);
}
