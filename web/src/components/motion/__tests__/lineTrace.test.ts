import { describe, expect, it } from "vitest";
import { STOPS, swingAt, trace, type Box, type Station } from "@/components/motion/lineTrace";

/*
 * The living line's geometry without a browser (#176, #178). What a reader
 * would notice going wrong: the line through a word, a loop that does not
 * close, the tip running away from the middle of the window, a scroll map
 * that goes backwards. Each is held here. The look is in `docs/line/`.
 */

const box = (top: number, bottom: number, left = 40, right = 960): Box => ({ top, bottom, left, right });
const lanes = { left: 20, right: 980 };

const STORY: Station[] = [
  { kind: "left", box: box(0, 400) },
  { kind: "right", box: box(560, 960) },
  { kind: "loop", box: box(1100, 1300, 400, 600), pad: 10 },
  { kind: "left", box: box(1440, 1840) },
];
const H = 1900;

describe("trace", () => {
  it("is one path that starts on the first station and ends on the last", () => {
    const t = trace(STORY, lanes, H);
    expect(t.d.match(/M/g)).toHaveLength(1);
    expect(t.d.startsWith("M20 0")).toBe(true);
    expect(t.d.endsWith("20 1840")).toBe(true);
  });

  it("runs a lane station down its own lane, the lane on its side", () => {
    const t = trace(STORY, lanes, H);
    expect(t.d).toContain("L20 400");
    expect(t.d).toMatch(/980 560 L980 960/);
  });

  it("closes each loop round its box, with its clearance, and leaves from its foot", () => {
    const t = trace(STORY, lanes, H);
    expect(t.loops).toEqual([{ cx: 500, cy: 1200, r: 110 }]);
    /* Arrived from the right lane, so it meets the circle on its right. */
    expect(t.d).toContain("L610 1200 A110 110 0 0 1 390 1200 A110 110 0 0 1 610 1200 L610 1310");
  });

  it("does every swing inside the gap between two stations", () => {
    /* The swing's height is monotone and between its ends, so it can only be
       in the margin between the boxes it joins. */
    for (let i = 0; i <= 20; i += 1) {
      const [, y] = swingAt(20, 400, 980, 560, i / 20);
      expect(y).toBeGreaterThanOrEqual(400);
      expect(y).toBeLessThanOrEqual(560);
      if (i) expect(y).toBeGreaterThanOrEqual(swingAt(20, 400, 980, 560, (i - 1) / 20)[1]);
    }
  });

  it("holds a loop beside text to the hold's height, straight down its side", () => {
    const hold = box(1000, 1400, 40, 960);
    const t = trace(
      [{ kind: "left", box: box(0, 800) }, { kind: "loop", box: box(1000, 1120, 40, 160), pad: 12, hold }],
      lanes,
      1500,
    );
    const r = 72;
    const jx = 100 - r;
    /* In from above the hold's top, out at its foot, on the circle's tangent. */
    expect(t.d).toContain(`${jx} ${1060 - r} L${jx} 1060`);
    expect(t.d.endsWith(`L${jx} 1400`)).toBe(true);
  });

  it("maps scroll to length monotonically, undrawn at the top and drawn at the foot", () => {
    const { stops } = trace(STORY, lanes, H);
    expect(stops).toHaveLength(STOPS + 1);
    expect(stops[0]).toBe(1);
    expect(stops.at(-1)).toBe(0);
    for (let i = 1; i < stops.length; i += 1) expect(stops[i]).toBeLessThanOrEqual(stops[i - 1]);
  });

  it("spends a loop's circle across the circle's own height, so the tip stays on the middle", () => {
    const t = trace(STORY, lanes, H);
    const drawnAt = (y: number) => (1 - t.stops[Math.round((y / H) * STOPS)]) * t.length;
    const circle = 2 * Math.PI * 110;
    /* Across the loop's height nearly all of the circle is drawn; outside
       it, almost none of it — within one stop's interpolation either side. */
    const across = drawnAt(1310) - drawnAt(1090);
    expect(across).toBeGreaterThan(circle * 0.85);
    expect(across).toBeLessThan(circle + 2 * 220 + 40);
  });

  it("draws the whole line when nothing has been measured", () => {
    const t = trace([], lanes, 0);
    expect(t.d).toBe("");
    expect(t.stops.every((s) => s === 0)).toBe(true);
  });
});
