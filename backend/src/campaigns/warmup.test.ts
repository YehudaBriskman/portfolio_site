import { describe, expect, it } from "vitest";
import { effectiveCaps, warmupDay, warmupLimits, WARMUP_DAYS } from "./warmup.js";
import { complaintPause, pauseReason } from "./pause.js";

const DAY = 86_400_000;
const T0 = Date.parse("2026-12-01T09:00:00Z");

describe("warmupDay", () => {
  it("is day 1 before any send and for the first 24 h", () => {
    expect(warmupDay(undefined, T0)).toBe(1);
    expect(warmupDay(new Date(T0).toISOString(), T0 + DAY - 1)).toBe(1);
    expect(warmupDay(new Date(T0).toISOString(), T0 + DAY)).toBe(2);
  });
  it("never goes below 1 if the clock is behind", () => {
    expect(warmupDay(new Date(T0 + 5 * DAY).toISOString(), T0)).toBe(1);
  });
});

describe("warmupLimits", () => {
  const at = (d: number) => warmupLimits(true, new Date(T0).toISOString(), T0 + (d - 1) * DAY);
  it("ramps 20, 30, 50, 75 then 100 a day, and 10, 10, 15, 20, 30 an hour", () => {
    expect([1, 2, 3, 4, 5, 14].map((d) => at(d)?.daily)).toEqual([20, 30, 50, 75, 100, 100]);
    expect([1, 2, 3, 4, 5, 14].map((d) => at(d)?.hourly)).toEqual([10, 10, 15, 20, 30, 30]);
  });
  it("ends after the warm-up window and when switched off", () => {
    expect(at(WARMUP_DAYS + 1)).toBeNull();
    expect(warmupLimits(false, undefined, T0)).toBeNull();
  });
  it("a first send not yet recorded counts as day 1", () => {
    expect(warmupLimits(true, undefined, T0)).toMatchObject({ day: 1, daily: 20, hourly: 10 });
  });
});

describe("effectiveCaps only ever lowers", () => {
  const first = new Date(T0).toISOString();
  it("keeps a lower configured cap", () => {
    expect(effectiveCaps({ throttlePerHour: 5, dailyCap: 8, warmup: true }, first, T0)).toMatchObject({ throttlePerHour: 5, dailyCap: 8 });
  });
  it("lowers a higher configured cap on day 1", () => {
    expect(effectiveCaps({ throttlePerHour: 60, dailyCap: 200, warmup: true }, first, T0)).toMatchObject({ throttlePerHour: 10, dailyCap: 20, warming: true });
  });
  it("leaves caps alone when off or finished", () => {
    expect(effectiveCaps({ throttlePerHour: 60, dailyCap: 200, warmup: false }, first, T0)).toMatchObject({ throttlePerHour: 60, dailyCap: 200, warming: false });
    expect(effectiveCaps({ throttlePerHour: 60, dailyCap: 200, warmup: true }, first, T0 + 20 * DAY)).toMatchObject({ throttlePerHour: 60, dailyCap: 200, warming: false });
  });
});

describe("pauseReason thresholds", () => {
  const h = (o: Partial<{ sent: number; failed: number; hard: number; streak: number; complaints: number }>) => ({ sent: 0, failed: 0, hard: 0, streak: 0, ...o });
  it("pauses on 3 hard bounces even with fewer than 20 attempts", () => {
    expect(pauseReason(h({ sent: 5, failed: 3, hard: 3 }))).toBe("hard-bounce-rate");
    expect(pauseReason(h({ sent: 5, failed: 2, hard: 2 }))).toBeNull();
  });
  it("pauses at 3 percent hard bounces from 20 attempts", () => {
    expect(pauseReason(h({ sent: 39, failed: 1, hard: 1 }))).toBeNull(); // 2.5 percent
    expect(pauseReason(h({ sent: 32, failed: 1, hard: 1 }))).toBe("hard-bounce-rate"); // 3.03 percent
  });
  it("keeps the streak and failure rate rules", () => {
    expect(pauseReason(h({ streak: 5 }))).toBe("consecutive");
    expect(pauseReason(h({ sent: 18, failed: 2 }))).toBe("failure-rate");
    expect(pauseReason(h({ sent: 10, failed: 1 }))).toBeNull();
  });
});

describe("complaintPause state machine", () => {
  it("pauses on the first complaint while warming up", () => {
    expect(complaintPause({ complaints: 1, sent: 400, warming: true })).toBe(true);
  });
  it("pauses on the first complaint in the first 500 sends of a campaign", () => {
    expect(complaintPause({ complaints: 1, sent: 120, warming: false })).toBe(true);
    expect(complaintPause({ complaints: 1, sent: 499, warming: false })).toBe(true);
  });
  it("later waits for 2 complaints or 0.3 percent", () => {
    expect(complaintPause({ complaints: 1, sent: 1000, warming: false })).toBe(false);
    expect(complaintPause({ complaints: 2, sent: 5000, warming: false })).toBe(true);
    expect(complaintPause({ complaints: 4, sent: 1000, warming: false })).toBe(true); // 0.4 percent
  });
  it("never pauses with no complaint", () => {
    expect(complaintPause({ complaints: 0, sent: 0, warming: true })).toBe(false);
  });
});

import { applyComplaint } from "./pause.js";
describe("applyComplaint", () => {
  const sending = () => ({ status: "sending", counters: { sent: 10 } }) as Parameters<typeof applyComplaint>[0];
  it("pauses a sending campaign on the first complaint while early", () => {
    const c = sending();
    expect(applyComplaint(c, false)).toBe(true);
    expect(c).toMatchObject({ status: "paused", pausedReason: "complaint", health: { complaints: 1 } });
  });
  it("ignores a campaign that is not sending", () => {
    const c = { status: "draft", counters: { sent: 0 } } as Parameters<typeof applyComplaint>[0];
    expect(applyComplaint(c, true)).toBe(false);
    expect(c.status).toBe("draft");
  });
  it("later in life counts without pausing the first one, pauses on the second", () => {
    const c = { status: "sending", counters: { sent: 2000 } } as Parameters<typeof applyComplaint>[0];
    applyComplaint(c, false);
    expect(c.status).toBe("sending");
    applyComplaint(c, false);
    expect(c.status).toBe("paused");
  });
  it("resume resets the window: a fresh health has no complaints", () => {
    const c = sending();
    applyComplaint(c, false);
    c.status = "sending"; // the owner resumed; the route sets health to zero
    c.health = { sent: 0, failed: 0, hard: 0, streak: 0 };
    expect(c.health.complaints).toBeUndefined();
  });
});

import { batchSize, HOLD_MS, isSlowDown, retryDelay } from "./sender.js";
describe("drip, backoff and the slow-down hold", () => {
  it("a batch is a share of the hour, between 1 and 25", () => {
    expect([1, 30, 60, 240, 3000, 3600].map(batchSize)).toEqual([1, 1, 1, 2, 25, 25]);
  });
  it("retries wait 15 min, 1 h, then 4 h", () => {
    expect([1, 2, 3, 4, 9].map(retryDelay)).toEqual([15 * 60_000, 3_600_000, 4 * 3_600_000, 4 * 3_600_000, 4 * 3_600_000]);
  });
  it("recognises a relay asking to slow down, and holds at least 10 minutes", () => {
    expect(isSlowDown("421 4.7.28 Our system has detected an unusual rate", 421)).toBe(true);
    expect(isSlowDown("Too many messages, try later")).toBe(true);
    expect(isSlowDown("connection reset")).toBe(false);
    expect(HOLD_MS).toBeGreaterThanOrEqual(10 * 60_000);
  });
});
