import { describe, expect, it } from "vitest";
import {
  STOPS,
  compose,
  defineMove,
  parseMoves,
  sample,
  scrollStops,
  segPoint,
  segTangent,
  type Box,
  type Composition,
  type Station,
} from "@/components/motion/lineMoves";
import { strandOffset, strandPaths } from "@/components/motion/ribbon";

/*
 * The living line's composer without a browser (#191). The three rules the
 * owner's brief comes down to, held for any boxes and any moves:
 *
 *   - the path is continuous: every piece starts where the last one ended;
 *   - its tangent is continuous: no corner anywhere, every turn an arc;
 *   - it never crosses a text box, with the ribbon's own width counted.
 *
 * And the scroll map: monotone, undrawn at the top, drawn at the foot, a
 * loop spent across its own height. The look is in `docs/line/`.
 */

const box = (top: number, bottom: number, left = 40, right = 960): Box => ({ top, bottom, left, right });
const lanes = { left: 20, right: 980 };
const HALF = 8;

const lane = (side: "start" | "end") => [{ move: "line-to", lane: side }];
const loop = (pad = 10) => [{ move: "circle-around", pad }];

/** A story's worth: a seed, beats alternating sides, interludes circled. */
const STORY: Station[] = [
  { box: box(0, 160), moves: [{ move: "origin", dot: true }] },
  { box: box(220, 620), moves: lane("start") },
  { box: box(780, 1180), moves: lane("end") },
  { box: box(1320, 1520, 400, 600), moves: loop() },
  { box: box(1660, 2060), moves: lane("start") },
  { box: box(2200, 2400, 410, 590), moves: loop() },
  { box: box(2540, 2940), moves: lane("end") },
];

function assertContinuous(c: Composition) {
  for (let i = 1; i < c.segs.length; i += 1) {
    const [x0, y0] = segPoint(c.segs[i - 1], 1);
    const [x1, y1] = segPoint(c.segs[i], 0);
    expect(Math.hypot(x1 - x0, y1 - y0), `gap before segment ${i}`).toBeLessThan(0.01);
  }
}

function assertSmooth(c: Composition) {
  for (let i = 1; i < c.segs.length; i += 1) {
    const [ax, ay] = segTangent(c.segs[i - 1], 1);
    const [bx, by] = segTangent(c.segs[i], 0);
    /* The angle between the two directions, from their cross and dot. */
    const angle = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    expect(angle, `corner before segment ${i} (${c.segs[i].kind})`).toBeLessThan(1e-6);
  }
}

/*
 * Where a station's text is. A lane station's box is its text. A loop's
 * words are held to the middle 70% of its box (`.loop > *` in
 * Story.module.css), inside the circle's inscribed square, so that is the
 * text the circle must miss.
 */
function words(s: Station): Box {
  if (!s.moves.some((m) => m.move === "circle-around")) return s.box;
  const cx = (s.box.left + s.box.right) / 2;
  const cy = (s.box.top + s.box.bottom) / 2;
  const w = ((s.box.right - s.box.left) * 0.7) / 2;
  const h = ((s.box.bottom - s.box.top) * 0.7) / 2;
  return { left: cx - w, right: cx + w, top: cy - h, bottom: cy + h };
}

/** Every point within `clear` of a box's inside is a crossing. */
function crossings(c: Composition, texts: Box[], clear: number) {
  const hits: string[] = [];
  for (const p of sample(c.segs, 2)) {
    for (const t of texts) {
      if (p.x > t.left - clear && p.x < t.right + clear && p.y > t.top - clear && p.y < t.bottom + clear) {
        hits.push(`${Math.round(p.x)},${Math.round(p.y)}`);
      }
    }
  }
  return hits;
}

describe("compose", () => {
  it("is one path that starts on the seed's dot and ends on the last station", () => {
    const c = compose(STORY, { lanes, half: HALF });
    expect(c.d.match(/M/g)).toHaveLength(1);
    expect(c.d.startsWith("M500 80")).toBe(true);
    expect(c.dots).toEqual([{ x: 500, y: 80 }]);
    const [x, y] = segPoint(c.segs.at(-1)!, 1);
    expect([x, y]).toEqual([980, 2940]);
  });

  it("is continuous and has no corner anywhere", () => {
    const c = compose(STORY, { lanes, half: HALF });
    assertContinuous(c);
    assertSmooth(c);
  });

  it("turns between sections in arcs only, never a straight line meeting a straight line", () => {
    const c = compose(STORY, { lanes, half: HALF });
    for (let i = 1; i < c.segs.length; i += 1) {
      expect(c.segs[i - 1].kind === "L" && c.segs[i].kind === "L").toBe(false);
    }
  });

  it("never crosses a text box, with the ribbon's width counted", () => {
    const c = compose(STORY, { lanes, half: HALF });
    /* The seed holds no text; every other box does. */
    const texts = STORY.slice(1).map(words);
    expect(crossings(c, texts, HALF)).toEqual([]);
  });

  it("goes round each loop once, outside its box by the clearance and the ribbon", () => {
    const c = compose(STORY, { lanes, half: HALF });
    expect(c.loops).toHaveLength(2);
    expect(c.loops[0]).toMatchObject({ cx: 500, cy: 1420, r: 100 + 10 + HALF });
  });

  it("holds a loop beside text to the hold's height, straight down its tangent", () => {
    const hold = box(1000, 1400, 40, 960);
    const claim = box(1000, 1400, 220, 960);
    const stations: Station[] = [
      { box: box(0, 800), moves: lane("start") },
      { box: box(1000, 1120, 40, 160), moves: loop(12), hold },
    ];
    const c = compose(stations, { lanes, half: HALF });
    assertContinuous(c);
    assertSmooth(c);
    expect(crossings(c, [box(0, 800), claim], HALF)).toEqual([]);
    const [, y] = segPoint(c.segs.at(-1)!, 1);
    expect(y).toBe(1400);
  });

  it("works for any amount of content: 1, 2, 12 and 40 stations", () => {
    for (const n of [1, 2, 12, 40]) {
      const stations: Station[] = Array.from({ length: n }, (_, i) => {
        const top = i * 500;
        return i % 4 === 3
          ? { box: box(top, top + 220, 390, 610), moves: loop() }
          : { box: box(top, top + 360), moves: lane(i % 2 ? "end" : "start") };
      });
      const c = compose(stations, { lanes, half: HALF });
      assertContinuous(c);
      assertSmooth(c);
      expect(crossings(c, stations.map(words), HALF), `${n} stations`).toEqual([]);
    }
  });

  it("starts outside the container and runs down before it turns (the home page's start)", () => {
    const stations: Station[] = [
      { box: box(-900, -900, 500, 500), moves: [{ move: "origin" }, { move: "line-to", lane: "here", y: -300 }] },
      { box: box(40, 300), moves: lane("start") },
    ];
    const c = compose(stations, { lanes, half: HALF });
    assertContinuous(c);
    assertSmooth(c);
    expect(c.top).toBe(-900);
    /* Straight down the middle to -300, then the turn below it. */
    expect(c.segs[0]).toMatchObject({ kind: "L", x0: 500, y0: -900, x1: 500, y1: -300 });
    for (const p of sample(c.segs, 2)) if (p.y < -300) expect(p.x).toBeCloseTo(500, 6);
  });

  it("comes in from the page's start edge, runs in above the head and turns down into its lane ('How I work')", () => {
    /* A full-bleed marker: its sides are the page's edges, wider than the container. */
    const stations: Station[] = [
      { box: box(-60, -60, -240, 1240), moves: [{ move: "enter", side: "start", lane: "end", overhang: 96, r: 28 }] },
      { box: box(0, 120, 300, 700), moves: lane("end") },
      { box: box(200, 400), moves: lane("start") },
    ];
    for (const rtl of [false, true]) {
      const c = compose(stations, { lanes, half: HALF, rtl });
      assertContinuous(c);
      assertSmooth(c);
      expect(c.enter).toBe(rtl ? "right" : "left");
      /* Off the edge, on the marker's line, heading across the page. */
      const first = c.segs[0];
      expect(first).toMatchObject({ kind: "L", y0: -60, y1: -60, x0: rtl ? 1240 + 96 : -240 - 96 });
      /* The extent reaches off the edge it comes from. */
      expect(rtl ? c.right : -c.left).toBeGreaterThan(rtl ? 1300 : 300);
      /* Down into the head's lane (the end lane, mirrored), beside the head, then back under it. */
      const endX = rtl ? lanes.left : lanes.right;
      expect(sample(c.segs, 2).some((p) => Math.abs(p.x - endX) < 1e-6 && p.y > 0 && p.y < 120)).toBe(true);
      expect(crossings(c, [stations[1].box, stations[2].box], HALF)).toEqual([]);
      /* The run in is the lead: drawn before the clock starts, so stop 0 is not "undrawn". */
      const stops = scrollStops(c, c.top - 20, 400);
      const lead = Math.abs(first.kind === "L" ? first.x1 - first.x0 : 0);
      expect(stops[0]).toBeLessThan(1);
      expect((1 - stops[0]) * c.length).toBeGreaterThan(lead);
      expect(stops.at(-1)).toBe(0);
    }
  });

  it("mirrors in a right-to-left page", () => {
    const ltr = compose(STORY, { lanes, half: HALF });
    const rtl = compose(STORY, { lanes, half: HALF, rtl: true });
    const a = sample(ltr.segs, 10);
    const b = sample(rtl.segs, 10);
    expect(b.length).toBe(a.length);
    a.forEach((p, i) => {
      expect(b[i].x).toBeCloseTo(1000 - p.x, 6);
      expect(b[i].y).toBeCloseTo(p.y, 6);
    });
  });

  it("takes moves added to the vocabulary, and draws something for a name it does not know", () => {
    defineMove("test-wiggle", (ctx) => {
      ctx.turn(ctx.laneX("end"), ctx.box.top);
      ctx.down((ctx.box.top + ctx.box.bottom) / 2);
      ctx.turn(ctx.laneX("start"), ctx.box.bottom);
    });
    const stations: Station[] = [
      { box: box(0, 200), moves: lane("start") },
      { box: box(400, 900, 200, 800), moves: [{ move: "test-wiggle" }] },
      { box: box(1000, 1200), moves: [{ move: "not-a-move" }] },
    ];
    const c = compose(stations, { lanes, half: HALF });
    assertContinuous(c);
    assertSmooth(c);
    const [x, y] = segPoint(c.segs.at(-1)!, 1);
    expect([x, y]).toEqual([20, 1200]);
  });

  it("reads the old keywords and JSON off `data-line`, and survives bad data", () => {
    expect(parseMoves("start")).toEqual([{ move: "line-to", lane: "start" }]);
    expect(parseMoves("loop", 12)).toEqual([{ move: "circle-around", pad: 12 }]);
    expect(parseMoves('[{"move":"origin","dot":true}]')).toEqual([{ move: "origin", dot: true }]);
    expect(parseMoves("[{broken")).toEqual([]);
  });
});

describe("scrollStops", () => {
  it("maps scroll to length monotonically, undrawn at the top and drawn at the foot", () => {
    const c = compose(STORY, { lanes, half: HALF });
    const stops = scrollStops(c, 0, 3000);
    expect(stops).toHaveLength(STOPS + 1);
    expect(stops[0]).toBe(1);
    expect(stops.at(-1)).toBe(0);
    for (let i = 1; i < stops.length; i += 1) expect(stops[i]).toBeLessThanOrEqual(stops[i - 1]);
  });

  it("spends a loop's circle across the circle's own height, so the tip stays on the middle", () => {
    const c = compose(STORY, { lanes, half: HALF });
    const H = 3000;
    const stops = scrollStops(c, 0, H);
    const drawnAt = (y: number) => (1 - stops[Math.round((y / H) * STOPS)]) * c.length;
    const { cy, r } = c.loops[0];
    const across = drawnAt(cy + r + 30) - drawnAt(cy - r - 30);
    expect(across).toBeGreaterThan(2 * Math.PI * r * 0.85);
  });

  it("draws the whole line when nothing has been measured", () => {
    const c = compose([], { lanes });
    expect(c.d).toBe("");
    expect(scrollStops(c, 0, 0).every((s) => s === 0)).toBe(true);
  });
});

describe("strands", () => {
  it("keeps every strand inside the ribbon's half-width, and gathers them at a tapered end", () => {
    const o = { count: 6, half: 9, wave: 280, taper: 160 };
    for (let i = 0; i < 6; i += 1) {
      for (let s = 0; s <= 2000; s += 7) expect(Math.abs(strandOffset(i, 6, s, 2000, o))).toBeLessThanOrEqual(9 + 1e-9);
      expect(strandOffset(i, 6, 0, 2000, o)).toBeCloseTo(0, 9);
      expect(strandOffset(i, 6, 2000, 2000, o)).toBeCloseTo(0, 9);
    }
  });

  it("gives one path per strand, every one the same number of points", () => {
    const c = compose(STORY, { lanes, half: HALF });
    const ds = strandPaths(sample(c.segs, 5), { count: 6, half: HALF, wave: 280, taper: 160 });
    expect(ds).toHaveLength(6);
    const counts = ds.map((d) => d.split(/[ML]/).length);
    expect(new Set(counts).size).toBe(1);
  });
});
