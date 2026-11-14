import type { Point } from "./strokes";

/*
 * The drawing pad's state without the canvas: strokes with undo, redo and
 * clear. Every change is a snapshot, so Clear can be undone too. Pure, so it
 * is tested without a DOM.
 */

export type Pad = { past: Point[][][]; present: Point[][]; future: Point[][][] };
const HISTORY = 100;

export const emptyPad = (strokes: Point[][] = []): Pad => ({ past: [], present: strokes, future: [] });

const push = (p: Pad, next: Point[][]): Pad => ({ past: [...p.past, p.present].slice(-HISTORY), present: next, future: [] });

export const addStroke = (p: Pad, stroke: Point[]): Pad => (stroke.length === 0 ? p : push(p, [...p.present, stroke]));
export const clearPad = (p: Pad): Pad => (p.present.length === 0 ? p : push(p, []));
export const canUndo = (p: Pad) => p.past.length > 0;
export const canRedo = (p: Pad) => p.future.length > 0;

export function undo(p: Pad): Pad {
  if (!canUndo(p)) return p;
  return { past: p.past.slice(0, -1), present: p.past[p.past.length - 1], future: [p.present, ...p.future] };
}
export function redo(p: Pad): Pad {
  if (!canRedo(p)) return p;
  return { past: [...p.past, p.present], present: p.future[0], future: p.future.slice(1) };
}

/** Points closer than this many pad units to the last one are noise from a finger or a coalesced event. */
const MIN_STEP = 1.2;

/** Adds a sampled point unless it is too close to the previous one. Pressure is kept when the device reports it. */
export function appendPoint(stroke: Point[], x: number, y: number, pressure: number | null): Point[] {
  const last = stroke[stroke.length - 1];
  if (last && Math.hypot(last[0] - x, last[1] - y) < MIN_STEP) return stroke;
  const r = (n: number) => Math.round(n * 10) / 10;
  return [...stroke, pressure === null ? [r(x), r(y)] : [r(x), r(y), Math.round(pressure * 100) / 100]];
}

/** A mouse reports 0.5 while pressed (and some pens 0 or 1 flat): treat that as "no pressure data". */
export const usablePressure = (e: { pointerType: string; pressure: number }) => (e.pointerType === "pen" || e.pointerType === "touch") && e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : null;
