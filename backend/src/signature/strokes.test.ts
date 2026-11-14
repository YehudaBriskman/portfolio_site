import { DOMParser } from "@xmldom/xmldom";
import { MAX_POINTS, StrokesSchema, strokesToSvg, type Strokes } from "./strokes.js";

const base = (over: Partial<Strokes> = {}): Strokes => ({
  w: 600,
  h: 240,
  pen: 4,
  strokes: [
    [[10, 100], [40, 60], [90, 120], [140, 80]],
    [[20, 150], [200, 150]],
  ],
  ...over,
});

describe("strokesToSvg", () => {
  it("makes path elements only, with the ink as currentColor", () => {
    const { svg } = strokesToSvg(base());
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const names = new Set<string>();
    const all = doc.getElementsByTagName("*");
    for (let i = 0; i < all.length; i += 1) names.add(all.item(i)!.nodeName);
    expect([...names].sort()).toEqual(["path", "svg"]);
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).not.toMatch(/script|style|href|on\w+=/i);
  });

  it("trims whitespace: the viewBox hugs the ink, not the pad", () => {
    const { width, height, svg } = strokesToSvg(base());
    expect(width).toBeLessThan(260);
    expect(height).toBeLessThan(120);
    expect(svg).toMatch(/viewBox="[\d.\- ]+"/);
  });

  it("draws a lone tap as a dot, not nothing", () => {
    const { svg } = strokesToSvg(base({ strokes: [[[50, 50]]] }));
    expect(svg).toMatch(/d="M[\d. -]+h0"/);
  });

  it("is deterministic and splits a stroke where the pressure changes", () => {
    const s = (): Strokes => base({ strokes: [[[10, 10, 0.2], [30, 10, 0.2], [50, 10, 1], [70, 10, 1]]] });
    const a = strokesToSvg(s());
    expect(a.svg).toBe(strokesToSvg(s()).svg);
    expect((a.svg.match(/<path/g) ?? []).length).toBeGreaterThan(1);
  });

  it("refuses nothing to draw", () => {
    expect(() => strokesToSvg(base({ strokes: [] }))).toThrow();
  });
});

describe("StrokesSchema", () => {
  it("accepts a normal signature", () => {
    expect(StrokesSchema.safeParse(base()).success).toBe(true);
  });
  it.each([
    ["an unknown key", { ...base(), extra: 1 }],
    ["NaN", base({ strokes: [[[Number.NaN, 1]]] })],
    ["a coordinate off the pad", base({ strokes: [[[99999, 1]]] })],
    ["a pen width of 0", base({ pen: 0 })],
    ["a pressure above 1", base({ strokes: [[[1, 1, 2]]] })],
    ["no strokes", base({ strokes: [] })],
    ["an empty stroke", base({ strokes: [[]] })],
    ["too many strokes", base({ strokes: Array.from({ length: 301 }, () => [[1, 1]] as Strokes["strokes"][number]) })],
    ["too many points", base({ strokes: [Array.from({ length: MAX_POINTS + 1 }, (_, i) => [i % 500, 1] as [number, number])] })],
  ])("refuses %s", (_what, input) => {
    expect(StrokesSchema.safeParse(input).success).toBe(false);
  });
});
