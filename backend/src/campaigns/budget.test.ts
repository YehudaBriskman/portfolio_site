import { describe, expect, it } from "vitest";
import {
  DAY_MS, computeBudget, estimateFinish, inWindow, monthStart, nextMonthStart, nextWindowAt, reserveOf, sendable, thresholdsReached, transactionalAllowed, usableOf,
  type BudgetLimits, type Usage,
} from "./budget.js";

const L: BudgetLimits = { dailyLimit: 100, monthlyLimit: 3000, safety: 0.9, reserveShare: 0.2 };
const U: Usage = { newsDay: 0, newsMonth: 0, transDay: 0, transMonth: 0 };
const caps = { throttlePerHour: 60, dailyCap: 200 };
const H = 3_600_000;

describe("usable and reserve", () => {
  it("usable is the limit times the safety factor, rounded down", () => {
    expect(usableOf(100, 0.9)).toBe(90);
    expect(usableOf(3000, 0.9)).toBe(2700);
    expect(usableOf(33, 0.9)).toBe(29);
    expect(usableOf(Number.NaN, 0.9)).toBe(0);
  });
  it("the reserve is the larger of 10 and the share of the day, never more than the day", () => {
    expect(reserveOf(90, 0.2)).toBe(18);
    expect(reserveOf(30, 0.2)).toBe(10);
    expect(reserveOf(5, 0.2)).toBe(5);
    expect(reserveOf(90, 0)).toBe(10);
  });
});

describe("capacity", () => {
  it("is the usable day less the reserve when nothing was sent", () => {
    const b = computeBudget(L, U);
    expect(b).toMatchObject({ usableDay: 90, usableMonth: 2700, reserve: 18, capacity: 72, waiting: null });
  });

  it("the reserve is honoured: newsletters can never take the last share of the day", () => {
    const b = computeBudget(L, { ...U, newsDay: 72 });
    expect(b.capacity).toBe(0);
    expect(b.waiting).toBe("day");
    /* 72 + 18 = 90: the 18 left are the transactional share, untouched. */
    expect(b.usableDay - b.usedDay).toBe(18);
  });

  it("transactional mail inside the share does not shrink the newsletter's room; above it, it does", () => {
    expect(computeBudget(L, { ...U, transDay: 10, transMonth: 10 }).capacity).toBe(72);
    expect(computeBudget(L, { ...U, transDay: 18, transMonth: 18 }).capacity).toBe(72);
    expect(computeBudget(L, { ...U, transDay: 30, transMonth: 30 }).capacity).toBe(60);
  });

  it("the month limits too, and says so", () => {
    const b = computeBudget(L, { ...U, newsDay: 5, newsMonth: 2700 - 18 });
    expect(b.roomDay).toBeGreaterThan(0);
    expect(b.capacity).toBe(0);
    expect(b.waiting).toBe("month");
  });

  it("never goes below zero, whatever was counted", () => {
    expect(computeBudget(L, { ...U, newsDay: 5000, newsMonth: 90000 }).capacity).toBe(0);
  });

  it("a tick sends the least of the room, the hourly pace and the daily cap", () => {
    expect(sendable(72, 60, 200)).toBe(60);
    expect(sendable(72, 100, 30)).toBe(30);
    expect(sendable(10, 100, 100)).toBe(10);
    expect(sendable(0, 100, 100)).toBe(0);
    expect(sendable(-3, 100, 100)).toBe(0);
  });
});

describe("windows", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  it("rolling 24 h counts only what is inside the window, not the calendar day", () => {
    const times = [now - 25 * H, now - 23 * H, now - H, now];
    expect(inWindow(times, now)).toBe(3);
    /* 25 hours ago is in yesterday's calendar day AND outside the window; 23 hours ago is yesterday's calendar day but inside. */
    expect(inWindow([Date.parse("2026-11-12T13:00:00Z")], now)).toBe(1);
  });

  it("month rollover: the calendar month starts at UTC midnight on the 1st", () => {
    expect(new Date(monthStart(Date.parse("2026-11-30T23:59:59Z"))).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(new Date(nextMonthStart(Date.parse("2026-12-31T23:59:59Z"))).toISOString()).toBe("2027-01-01T00:00:00.000Z");
    const full = computeBudget(L, { ...U, newsMonth: 2700 });
    expect(full.waiting).toBe("month");
    /* The next month's count starts at zero. */
    expect(computeBudget(L, U).capacity).toBe(72);
    expect(new Date(nextWindowAt(full, [], now)!).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("an exhausted day waits until the oldest send of the window ages out, then resumes", () => {
    const times = [now - 20 * H, now - 10 * H];
    const b = computeBudget(L, { ...U, newsDay: 72 });
    const at = nextWindowAt(b, times, now)!;
    expect(at).toBe(now - 20 * H + DAY_MS);
    /* After that moment the oldest send has left the window and there is room again. */
    const later = at + 1;
    expect(computeBudget(L, { ...U, newsDay: inWindow(times, later) }).capacity).toBeGreaterThan(0);
    expect(nextWindowAt(computeBudget(L, U), times, now)).toBeNull();
  });
});

describe("how long a campaign takes", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  it("fits today when there is room", () => {
    const f = estimateFinish(50, now, computeBudget(L, U), caps)!;
    expect(f.days).toBe(1);
    expect(f.finishAt).toBe(new Date(now).toISOString());
  });
  it("spreads a big list over days at the daily share", () => {
    const f = estimateFinish(300, now, computeBudget(L, U), caps)!;
    /* 72 per day: 300 / 72 = 4.17 -> 5 days. */
    expect(f.days).toBe(5);
    expect(f.finishAt).toBe(new Date(now + 4 * DAY_MS).toISOString());
  });
  it("starts tomorrow when today is spent", () => {
    const f = estimateFinish(10, now, computeBudget(L, { ...U, newsDay: 72 }), caps)!;
    expect(f.days).toBe(1);
    expect(f.finishAt).toBe(new Date(now + DAY_MS).toISOString());
  });
  it("waits for the next month when this one runs out", () => {
    const b = computeBudget({ ...L, monthlyLimit: 200 }, { ...U, newsMonth: 100 });
    const f = estimateFinish(500, Date.parse("2026-11-28T12:00:00Z"), b, caps)!;
    expect(new Date(f.finishAt).getTime()).toBeGreaterThanOrEqual(Date.parse("2026-12-01T00:00:00Z"));
  });
  it("the hourly pace and the daily cap slow it down", () => {
    expect(estimateFinish(100, now, computeBudget(L, U), { throttlePerHour: 60, dailyCap: 20 })!.days).toBe(5);
  });
  it("promises no date when the settings leave no room", () => {
    expect(estimateFinish(10, now, computeBudget({ ...L, dailyLimit: 10 }, U), caps)).toBeNull();
  });
  it("nothing to send is zero days", () => {
    expect(estimateFinish(0, now, computeBudget(L, U), caps)!.days).toBe(0);
  });
});

describe("transactional", () => {
  it("is always allowed inside the reserved share, even when newsletters are exhausted", () => {
    expect(transactionalAllowed(L, { newsDay: 72, newsMonth: 2700, transDay: 5, transMonth: 5 })).toEqual({ ok: true });
  });
  it("past the share it follows the provider's own limit, not the safety-reduced one", () => {
    expect(transactionalAllowed(L, { ...U, newsDay: 72, transDay: 20 })).toEqual({ ok: true });
    expect(transactionalAllowed(L, { ...U, newsDay: 72, transDay: 28 })).toEqual({ ok: false, reason: "day" });
    expect(transactionalAllowed(L, { newsDay: 0, newsMonth: 2990, transDay: 18, transMonth: 20 })).toEqual({ ok: false, reason: "month" });
  });
});

describe("thresholds", () => {
  it("70 and 90 percent of the usable month", () => {
    expect(thresholdsReached(1889, 2700)).toEqual([]);
    expect(thresholdsReached(1890, 2700)).toEqual([70]);
    expect(thresholdsReached(2430, 2700)).toEqual([70, 90]);
    expect(thresholdsReached(5, 0)).toEqual([]);
  });
});
