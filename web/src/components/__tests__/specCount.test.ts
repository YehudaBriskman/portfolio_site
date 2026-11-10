import { describe, expect, it } from "vitest";
import { countProgress, follow, printed, scriptCounts } from "@/components/specCount";

describe("countProgress", () => {
  it("is 0 below the window, 1 once the plate is high up, and clamped between", () => {
    expect(countProgress(900, 800)).toBe(0);
    expect(countProgress(10_000, 800)).toBe(0);
    expect(countProgress(0, 800)).toBe(1);
    expect(countProgress(-500, 800)).toBe(1);
  });
  it("rises monotonically as the plate comes up", () => {
    let prev = -1;
    for (let top = 800; top >= 0; top -= 20) {
      const p = countProgress(top, 800);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
  it("never produces NaN, whatever it is given", () => {
    for (const [t, v] of [[NaN, 800], [100, 0], [100, -5], [Infinity, 800], [100, NaN]] as const) {
      const p = countProgress(t, v);
      expect(Number.isNaN(p)).toBe(false);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe("follow", () => {
  it("walks toward the target without overshooting, and lands exactly", () => {
    let s = 0;
    for (let i = 0; i < 400; i += 1) {
      s = follow(s, 1, 1 / 60);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(s).toBe(1);
  });
  it("walks back down too", () => {
    let s = 1;
    for (let i = 0; i < 400; i += 1) s = follow(s, 0, 1 / 60);
    expect(s).toBe(0);
  });
  it("caps a long frame so a stalled tab does not jump the count", () => {
    expect(follow(0, 1, 5)).toBeCloseTo(1 - Math.exp(-0.8), 5);
    expect(follow(0, 1, -1)).toBe(0);
  });
});

describe("printed", () => {
  it("counts 0..value in whole numbers and rests on the true figure", () => {
    expect(printed(34, 0)).toBe(0);
    expect(printed(34, 1)).toBe(34);
    expect(printed(34, 0.5)).toBe(17);
  });
  it("is safe for odd figures", () => {
    expect(printed(0, 0.7)).toBe(0);
    expect(printed(-3, 1)).toBe(0);
    expect(printed(6.4, 1)).toBe(6);
    expect(printed(10, 3)).toBe(10);
    expect(printed(10, -1)).toBe(0);
  });
});

describe("scriptCounts", () => {
  const base = { coarse: false, viewTimelines: true, reducedMotion: false, paused: false };
  it("is for phones and for engines with no view timelines", () => {
    expect(scriptCounts({ ...base, coarse: true })).toBe(true);
    expect(scriptCounts({ ...base, viewTimelines: false })).toBe(true);
    expect(scriptCounts(base)).toBe(false);
  });
  it("is off under reduced motion and Pause, which rest on the true figure", () => {
    expect(scriptCounts({ ...base, coarse: true, reducedMotion: true })).toBe(false);
    expect(scriptCounts({ ...base, coarse: true, paused: true })).toBe(false);
  });
});
