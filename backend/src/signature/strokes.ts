import { z } from "zod";

/*
 * A drawn signature is stored as its strokes and turned into SVG here, so the
 * only markup that ever exists for it is <path> elements this file writes: no
 * attribute, element or string from the client reaches a document. The same
 * file lives in web/src/lib/signature/strokes.ts (a test keeps them identical)
 * so the admin's live preview is the saved result.
 *
 * A point is [x, y] or [x, y, pressure 0..1] in pad units.
 */

export const MAX_STROKES = 300;
export const MAX_POINTS = 20_000;
export const PAD_MAX = 2000;

const Coord = z.number().finite().min(-PAD_MAX).max(PAD_MAX);
const Point = z.union([z.tuple([Coord, Coord]), z.tuple([Coord, Coord, z.number().finite().min(0).max(1)])]);

export const StrokesSchema = z
  .object({
    w: z.number().finite().min(50).max(PAD_MAX),
    h: z.number().finite().min(50).max(PAD_MAX),
    /* The pen's base width in pad units. */
    pen: z.number().finite().min(1).max(24),
    strokes: z.array(z.array(Point).min(1).max(MAX_POINTS)).min(1).max(MAX_STROKES),
  })
  .strict()
  .refine((s) => s.strokes.reduce((n, st) => n + st.length, 0) <= MAX_POINTS, "Too many points");
export type Strokes = z.infer<typeof StrokesSchema>;
export type Point = z.infer<typeof Point>;

const r1 = (n: number) => String(Math.round(n * 10) / 10);
/* Pressure 0.5 is "no information" (a mouse), so it draws the pen's own width. */
const widthAt = (pen: number, p: Point) => Math.round(pen * (0.4 + 1.2 * (p[2] ?? 0.5)) * 2) / 2;

function d(pts: Point[]): string {
  const [a] = pts;
  if (pts.length === 1) return `M${r1(a[0])} ${r1(a[1])}h0`;
  if (pts.length === 2) return `M${r1(a[0])} ${r1(a[1])}L${r1(pts[1][0])} ${r1(pts[1][1])}`;
  let out = `M${r1(a[0])} ${r1(a[1])}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const c = pts[i];
    const n = pts[i + 1];
    out += `Q${r1(c[0])} ${r1(c[1])} ${r1((c[0] + n[0]) / 2)} ${r1((c[1] + n[1]) / 2)}`;
  }
  const z = pts[pts.length - 1];
  return `${out}L${r1(z[0])} ${r1(z[1])}`;
}

export type RenderedStrokes = { svg: string; width: number; height: number };

/** The signature as SVG, trimmed to its ink. Throws when there is nothing to draw. */
export function strokesToSvg(s: Strokes): RenderedStrokes {
  const paths: string[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let widest = s.pen;
  for (const st of s.strokes) {
    if (st.length === 0) continue;
    for (const p of st) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    /* A run keeps one width; the next run starts on the last point so the line stays joined. */
    let run: Point[] = [st[0]];
    let w = widthAt(s.pen, st[0]);
    const flush = () => {
      paths.push(`<path d="${d(run)}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`);
      widest = Math.max(widest, w);
    };
    for (let i = 1; i < st.length; i += 1) {
      const wi = widthAt(s.pen, st[i]);
      if (wi !== w && run.length > 1) {
        flush();
        run = [st[i - 1]];
      }
      w = wi;
      run.push(st[i]);
    }
    flush();
  }
  if (paths.length === 0) throw new Error("nothing to draw");
  const pad = Math.ceil(widest / 2) + 2;
  const x = Math.floor(minX - pad);
  const y = Math.floor(minY - pad);
  const width = Math.ceil(maxX + pad) - x;
  const height = Math.ceil(maxY + pad) - y;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}">${paths.join("")}</svg>`, width, height };
}
