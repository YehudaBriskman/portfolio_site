import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { addStroke, appendPoint, canRedo, canUndo, clearPad, emptyPad, redo, undo, usablePressure } from "../signature/padModel";
import { cleanSignature, cropToInk, downscale, hexToRgb, paperLuminance, removeBackground, type Raster } from "../signature/ink";
import { strokesToSvg } from "../signature/strokes";

/* A white sheet with a dark bar and a grey shadow in one corner. */
function sheet(w = 100, h = 60): Raster {
  const data = new Uint8ClampedArray(w * h * 4).fill(250);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const paint = (x: number, y: number, v: number) => {
    const i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v;
  };
  for (let x = 20; x < 80; x += 1) for (let y = 28; y < 33; y += 1) paint(x, y, 20); // the ink
  for (let x = 0; x < 15; x += 1) for (let y = 0; y < 15; y += 1) paint(x, y, 225); // a faint shadow
  return { data, width: w, height: h };
}
const alphaAt = (r: Raster, x: number, y: number) => r.data[(y * r.width + x) * 4 + 3];

describe("the drawing pad model", () => {
  const s = (n: number): [number, number][] => [[n, n], [n + 5, n + 5]];
  it("undoes, redoes and drops redo when something new is drawn", () => {
    let p = addStroke(addStroke(emptyPad(), s(1)), s(2));
    expect(p.present).toHaveLength(2);
    p = undo(p);
    expect(p.present).toHaveLength(1);
    expect(canRedo(p)).toBe(true);
    p = redo(p);
    expect(p.present).toHaveLength(2);
    p = addStroke(undo(p), s(3));
    expect(canRedo(p)).toBe(false);
  });
  it("makes Clear undoable and refuses to record an empty change", () => {
    const p = addStroke(emptyPad(), s(1));
    const cleared = clearPad(p);
    expect(cleared.present).toEqual([]);
    expect(undo(cleared).present).toHaveLength(1);
    expect(clearPad(emptyPad())).toEqual(emptyPad());
    expect(canUndo(addStroke(emptyPad(), []))).toBe(false);
  });
  it("skips points that are too close and keeps pressure only when there is some", () => {
    let st = appendPoint([], 10, 10, null);
    st = appendPoint(st, 10.3, 10.2, null);
    st = appendPoint(st, 20, 20, 0.7);
    expect(st).toEqual([[10, 10], [20, 20, 0.7]]);
    expect(usablePressure({ pointerType: "mouse", pressure: 0.5 })).toBeNull();
    expect(usablePressure({ pointerType: "pen", pressure: 0.3 })).toBe(0.3);
    expect(usablePressure({ pointerType: "touch", pressure: 0 })).toBeNull();
  });
});

describe("cleaning a photo of a signature", () => {
  it("finds the paper's brightness, not the ink's", () => {
    expect(paperLuminance(sheet())).toBeGreaterThan(240);
  });
  it("makes paper transparent and ink opaque, in the ink colour", () => {
    const out = removeBackground(sheet(), { threshold: 30, soften: 20, ink: [10, 20, 30] });
    expect(alphaAt(out, 50, 30)).toBe(255);
    expect(alphaAt(out, 50, 5)).toBe(0);
    expect(Array.from(out.data.slice((30 * 100 + 50) * 4, (30 * 100 + 50) * 4 + 3))).toEqual([10, 20, 30]);
  });
  it("lets the slider drop a faint shadow but not the ink", () => {
    const low = removeBackground(sheet(), { threshold: 0, soften: 5, ink: null });
    const high = removeBackground(sheet(), { threshold: 40, soften: 5, ink: null });
    expect(alphaAt(low, 5, 5)).toBeGreaterThan(0);
    expect(alphaAt(high, 5, 5)).toBe(0);
    expect(alphaAt(high, 50, 30)).toBe(255);
  });
  it("crops to the ink and returns null for a blank page", () => {
    const out = removeBackground(sheet(), { threshold: 40, soften: 5, ink: null });
    const c = cropToInk(out, 2)!;
    expect(c.width).toBe(64);
    expect(c.height).toBe(9);
    expect(cropToInk({ data: new Uint8ClampedArray(16), width: 2, height: 2 })).toBeNull();
    expect(cleanSignature({ data: new Uint8ClampedArray(400).fill(255), width: 10, height: 10 }, { threshold: 50, soften: 10, ink: null })).toBeNull();
  });
  it("shrinks to at most 960 wide, keeps the aspect, and never enlarges", () => {
    const wide: Raster = { data: new Uint8ClampedArray(2000 * 100 * 4).fill(255), width: 2000, height: 100 };
    const d = downscale(wide);
    expect(d.width).toBe(960);
    expect(d.height).toBe(48);
    expect(downscale(sheet()).width).toBe(100);
  });
  it("reads an ink colour", () => {
    expect(hexToRgb("#14130F")).toEqual([20, 19, 15]);
  });
});

describe("the web copy of the stroke renderer", () => {
  it("is byte for byte the server's, so the preview is the saved result", () => {
    const here = readFileSync(resolve(__dirname, "../signature/strokes.ts"), "utf8");
    const there = readFileSync(resolve(__dirname, "../../../../backend/src/signature/strokes.ts"), "utf8");
    expect(here).toBe(there);
  });
  it("draws", () => {
    expect(strokesToSvg({ w: 100, h: 100, pen: 3, strokes: [[[1, 1], [20, 20], [40, 5]]] }).svg).toMatch(/^<svg /);
  });
});
