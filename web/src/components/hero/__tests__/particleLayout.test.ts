import { describe, expect, it } from "vitest";
import {
  fitWords,
  groupLines,
  inkArea,
  mulberry32,
  particleBudget,
  particlesAllowed,
  sampleInk,
  textDirection,
  type Environment,
  type Mask,
} from "@/components/hero/particleLayout";

/* A word's worth of ink without a canvas: filled rectangles (the "letters")
   with gaps between them, so a sampler that cannot cross a gap is caught. */
function letters(w: number, h: number, boxes: [number, number, number, number][]): Mask {
  const data = new Uint8Array(w * h);
  for (const [x0, y0, x1, y1] of boxes) for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) data[y * w + x] = 255;
  return { data, width: w, height: h };
}
const WORD = letters(600, 140, [
  [10, 10, 90, 130], [110, 10, 190, 130], [210, 10, 290, 130], [310, 10, 390, 130], [410, 10, 490, 130], [510, 10, 590, 130],
]);
/* Hebrew-like: ink biased to the right, a descender hanging below the rest. */
const HEBREW = letters(500, 200, [[300, 20, 480, 80], [220, 20, 280, 140], [100, 20, 200, 80], [110, 80, 150, 190]]);

const inside = (m: Mask, x: number, y: number) => m.data[Math.floor(y) * m.width + Math.floor(x)] >= 128;

describe("mulberry32", () => {
  it("is deterministic and uniform in [0,1)", () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(mulberry32(6)()).not.toBe(mulberry32(5)());
  });
});

describe("sampleInk", () => {
  it("lands within 5% of the target at several targets", () => {
    for (const target of [600, 1000, 1400, 1800]) {
      const s = sampleInk(WORD, target, 7);
      expect(Math.abs(s.count - target) / target).toBeLessThanOrEqual(0.05);
    }
  });

  it("puts every particle on the ink, in every letter", () => {
    const s = sampleInk(WORD, 1000, 3);
    const hit = new Set<number>();
    for (let i = 0; i < s.count; i += 1) {
      const x = s.xy[i * 2];
      const y = s.xy[i * 2 + 1];
      expect(inside(WORD, x, y)).toBe(true);
      hit.add(Math.floor((x - 10) / 100));
    }
    expect([...hit].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("keeps the blue-noise spacing: no two dots closer than the radius", () => {
    const s = sampleInk(WORD, 1000, 3);
    let min = Infinity;
    for (let i = 0; i < s.count; i += 1)
      for (let j = i + 1; j < s.count; j += 1)
        min = Math.min(min, Math.hypot(s.xy[i * 2] - s.xy[j * 2], s.xy[i * 2 + 1] - s.xy[j * 2 + 1]));
    expect(min).toBeGreaterThanOrEqual(s.radius * 0.999);
  });

  it("is deterministic for a seed and different for another", () => {
    const a = sampleInk(WORD, 800, 9);
    const b = sampleInk(WORD, 800, 9);
    const c = sampleInk(WORD, 800, 10);
    expect([...a.xy]).toEqual([...b.xy]);
    expect([...a.xy]).not.toEqual([...c.xy]);
  });

  it("samples joined, right-heavy, descending shapes the same way (ink only, no letter coordinates)", () => {
    const s = sampleInk(HEBREW, 500, 2);
    expect(Math.abs(s.count - 500) / 500).toBeLessThanOrEqual(0.06);
    for (let i = 0; i < s.count; i += 1) expect(inside(HEBREW, s.xy[i * 2], s.xy[i * 2 + 1])).toBe(true);
    const descender = Array.from({ length: s.count }, (_, i) => s.xy[i * 2 + 1]).filter((y) => y > 140);
    expect(descender.length).toBeGreaterThan(0);
  });

  it("returns what fits, never forcing dots closer than ~1px, when the ink is small", () => {
    const tiny = letters(40, 20, [[5, 5, 15, 15]]);
    const s = sampleInk(tiny, 5000, 1);
    expect(s.count).toBeLessThan(5000);
    expect(s.count).toBeGreaterThan(10);
  });

  it("returns nothing for an empty mask or a zero target", () => {
    expect(sampleInk(letters(10, 10, []), 100).count).toBe(0);
    expect(sampleInk(WORD, 0).count).toBe(0);
    expect(inkArea(WORD)).toBe(6 * 80 * 120);
  });

  it("resize: a wider raster of the same word gives the same count, spread wider", () => {
    const wide = letters(1200, 280, [
      [20, 20, 180, 260], [220, 20, 380, 260], [420, 20, 580, 260], [620, 20, 780, 260], [820, 20, 980, 260], [1020, 20, 1180, 260],
    ]);
    const a = sampleInk(WORD, 1000, 7);
    const b = sampleInk(wide, 1000, 7);
    expect(Math.abs(a.count - b.count) / 1000).toBeLessThan(0.06);
    expect(b.radius).toBeGreaterThan(a.radius * 1.7);
  });
});

describe("groupLines", () => {
  const r = (left: number, top: number) => ({ left, top, right: left + 100, bottom: top + 100 });
  it("groups boxes into lines by vertical centre, in order", () => {
    expect(groupLines([r(0, 0), r(120, 4), r(0, 100), r(120, 98)])).toEqual([[0, 1], [2, 3]]);
  });
  it("one word is one line; nothing is nothing", () => {
    expect(groupLines([r(0, 0)])).toEqual([[0]]);
    expect(groupLines([])).toEqual([]);
  });
});

describe("fitWords", () => {
  /* 0.6em per character, 0.3em for a space. */
  const width = (s: string) => (s === " " ? 0.3 : s.length * 0.6);
  it("one short word fills the width", () => {
    const f = fitWords(["PORTFOLIO"], width, 1000, 400, 0.95);
    expect(f.lines).toBe(1);
    expect(f.fontSize).toBeCloseTo(1000 / (9 * 0.6), 1);
  });
  it("takes two lines when that is bigger, and keeps one when it is not", () => {
    const two = fitWords(["YEHUDA", "BRISKMAN"], width, 1000, 400, 0.95);
    expect(two.lines).toBe(2);
    expect(two.fontSize).toBeCloseTo(1000 / (8 * 0.6), 1);
    const short = fitWords(["AB", "CD"], width, 1000, 120, 0.95);
    expect(short.lines).toBe(1);
  });
  it("is capped by the height budget and by maxFont", () => {
    expect(fitWords(["PORTFOLIO"], width, 5000, 100, 1).fontSize).toBeCloseTo(100, 5);
    expect(fitWords(["PORTFOLIO"], width, 5000, 5000, 1, 3, 200).fontSize).toBe(200);
  });
  it("never splits a word: one long word is bounded by its own width", () => {
    const f = fitWords(["ABCDEFGHIJKLMNOPQRSTUVWXYZ"], width, 600, 600, 1);
    expect(f.lines).toBe(1);
    expect(f.width).toBeLessThanOrEqual(600.001);
  });
  it("empty input is nothing", () => {
    expect(fitWords([], width, 100, 100, 1).fontSize).toBe(0);
    expect(fitWords(["", ""], width, 100, 100, 1).lines).toBe(0);
  });
  it("a long sentence wraps to the line cap and the size shrinks to fit", () => {
    const f = fitWords("one two three four five six".split(" "), width, 800, 300, 1, 3);
    expect(f.lines).toBeLessThanOrEqual(3);
    expect(f.width).toBeLessThanOrEqual(800.001);
    expect(f.height).toBeLessThanOrEqual(300.001);
  });
});

describe("textDirection", () => {
  it("reads the first strong character", () => {
    expect(textDirection("Portfolio")).toBe("ltr");
    expect(textDirection("תיק עבודות")).toBe("rtl");
    expect(textDirection("123 תיק")).toBe("rtl");
    expect(textDirection("— Portfolio תיק")).toBe("ltr");
    expect(textDirection("")).toBe("ltr");
    expect(textDirection("مرحبا")).toBe("rtl");
  });
});

describe("particleBudget", () => {
  const base = { dpr: 1, cores: 8, memory: 8, area: 600_000 };
  it("scales with the word box and is capped on weak or dense devices", () => {
    expect(particleBudget(base)).toBe(9000);
    expect(particleBudget({ ...base, area: 1_000_000 })).toBe(14000);
    expect(particleBudget({ ...base, area: 300_000 })).toBe(6000);
    expect(particleBudget({ ...base, cores: 4 })).toBe(5000);
    expect(particleBudget({ ...base, memory: 2 })).toBe(4000);
    expect(particleBudget({ ...base, dpr: 3, area: 1_000_000 })).toBe(6500);
    expect(particleBudget({ dpr: 3, cores: 2, memory: 1, area: 1 })).toBeGreaterThanOrEqual(600);
  });
});

describe("particlesAllowed", () => {
  const ok: Environment = { width: 1440, coarsePointer: false, noHover: false, reducedMotion: false, paused: false, forcedColors: false, print: false, canvas: true, hasText: true };
  it("is on for a desktop with nothing asking for less", () => {
    expect(particlesAllowed(ok)).toBe(true);
    expect(particlesAllowed({ ...ok, width: 1100 })).toBe(true);
  });
  it.each([
    ["a narrow window", { width: 1099 }],
    ["a coarse pointer", { coarsePointer: true }],
    ["no hover", { noHover: true }],
    ["reduced motion", { reducedMotion: true }],
    ["Pause", { paused: true }],
    ["forced colours", { forcedColors: true }],
    ["print", { print: true }],
    ["no canvas", { canvas: false }],
    ["no text", { hasText: false }],
  ] as [string, Partial<Environment>][])("is off for %s", (_n, patch) => {
    expect(particlesAllowed({ ...ok, ...patch })).toBe(false);
  });
});
