import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { appendPoint, usablePressure } from "@/lib/signature/padModel";
import type { Point } from "@/lib/signature/strokes";
import { useSignatureWords } from "./words";

/*
 * The drawing pad: a canvas that takes pointer events, so a finger, a pen and
 * a mouse all work (`touch-action: none` stops a finger from scrolling the
 * page instead of drawing). It only collects points; the stroke list, undo
 * and the SVG are elsewhere. The surface is always light paper whatever the
 * theme, like a signing pad, so dark ink is never drawn on a dark ground.
 *
 * A canvas has no keyboard way to draw, so it is not a tab stop and says so;
 * the upload path is the keyboard route.
 */

export const PAD_W = 600;
export const PAD_H = 240;
export const PAD_PAPER = "#fbfaf6";

type Props = {
  strokes: Point[][];
  onStroke: (stroke: Point[]) => void;
  pen: number;
  ink: string;
  guide: boolean;
};

/* The same width rule as the server's (strokes.ts): pressure 0.5 draws the pen's own width. */
const widthAt = (pen: number, p: Point) => pen * (0.4 + 1.2 * (((p as readonly number[])[2]) ?? 0.5));

function paint(ctx: CanvasRenderingContext2D, scale: number, strokes: Point[][], ink: string, pen: number, guide: boolean) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAD_PAPER;
  ctx.fillRect(0, 0, PAD_W * scale, PAD_H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (guide) {
    ctx.strokeStyle = "rgba(124,120,109,0.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(24, PAD_H * 0.68);
    ctx.lineTo(PAD_W - 24, PAD_H * 0.68);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const st of strokes) {
    if (st.length === 1) {
      ctx.beginPath();
      ctx.arc(st[0][0], st[0][1], widthAt(pen, st[0]) / 2, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
      continue;
    }
    for (let i = 1; i < st.length; i += 1) {
      const a = st[i - 1];
      const b = st[i];
      const prevMid = i > 1 ? [(st[i - 2][0] + a[0]) / 2, (st[i - 2][1] + a[1]) / 2] : [a[0], a[1]];
      const mid = i < st.length - 1 ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : [b[0], b[1]];
      ctx.lineWidth = widthAt(pen, b);
      ctx.beginPath();
      ctx.moveTo(prevMid[0], prevMid[1]);
      ctx.quadraticCurveTo(a[0], a[1], mid[0], mid[1]);
      ctx.stroke();
    }
  }
}

export default function SignaturePad({ strokes, onStroke, pen, ink, guide }: Props) {
  const w = useSignatureWords();
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef<Point[] | null>(null);
  const [size, setSize] = useState(0);

  const draw = useCallback(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || size === 0) return;
    paint(ctx, size / PAD_W, live.current ? [...strokes, live.current] : strokes, ink, pen, guide);
  }, [strokes, ink, pen, guide, size]);

  /* Backing store follows the CSS size and the device pixel ratio, so lines stay sharp on a phone. */
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const fit = () => {
      const px = Math.round(c.getBoundingClientRect().width * (window.devicePixelRatio || 1));
      if (px > 0) {
        c.width = px;
        c.height = Math.round((px * PAD_H) / PAD_W);
        setSize(px);
      }
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);
  useEffect(draw, [draw]);

  const at = (e: ReactPointerEvent<HTMLCanvasElement>, ev: { clientX: number; clientY: number; pressure: number; pointerType: string }, into: Point[]) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = PAD_W / (r.width || PAD_W);
    return appendPoint(into, (ev.clientX - r.left) * k, (ev.clientY - r.top) * k, usablePressure(ev));
  };

  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    live.current = at(e, e.nativeEvent, []);
    draw();
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!live.current) return;
    /* A fast pen reports several samples per frame; keep them all for a smoother line. */
    const batch = e.nativeEvent.getCoalescedEvents?.() ?? [];
    let next = live.current;
    for (const ev of batch.length ? batch : [e.nativeEvent]) next = at(e, ev, next);
    live.current = next;
    draw();
  };
  const up = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const done = live.current;
    live.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (done && done.length > 0) onStroke(done);
    else draw();
  };

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={w.padLabel}
      aria-describedby="sig-pad-note"
      data-testid="signature-pad"
      className="block w-full rounded-[var(--a-r-ctl,12px)] border border-[rgb(var(--rule-firm)/0.6)]"
      style={{ touchAction: "none", aspectRatio: `${PAD_W} / ${PAD_H}`, cursor: "crosshair", background: PAD_PAPER }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    />
  );
}
