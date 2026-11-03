import type { CSSProperties, ReactNode } from "react";
import styles from "@/components/motion/Ring.module.css";

/*
 * The circle, as a system (#251).
 *
 * The site's motif is the living line's circle-around: one stroke that goes
 * round a word or a figure and runs a little past where it started, the way
 * a pen circles something on paper. This is that stroke at the size of a
 * bullet, a timeline node or a section mark, so the dashboards carry the
 * same gesture as the home page and /story without a second drawing of it.
 *
 *   - With no children it is a bullet: the loop round a small dot.
 *   - With children (an icon, a count) it is a node: the loop round them.
 *
 * When `draw` is on (the default) the loop is drawn by the reader's scroll as
 * it comes up into the window, and undrawn on the way back — the brand half
 * of an arrival; `Arrive` is the other half. It is one stroke drawn
 * *around* its content, so it never crosses or covers anything, and the dot
 * and the children are there from the first frame.
 *
 * Decorative throughout: `aria-hidden`, because what it marks is always said
 * by the text beside it.
 */

export type RingTone = "signal" | "ink" | "soft" | "blue" | "green" | "yellow" | "purple" | "red";

export type RingProps = {
  /** The outer size in px. */
  size?: number;
  tone?: RingTone;
  /** Draw the loop by scroll. Off for a ring that is chrome (the rail's current item). */
  draw?: boolean;
  /** A dot in the middle when there are no children. */
  dot?: boolean;
  className?: string;
  children?: ReactNode;
};

/*
 * The loop: a little more than one turn, slightly elliptical and leaning, so
 * it reads as drawn rather than as `border-radius: 50%`. In a 24-unit box,
 * centred on 0, starting above-left and finishing just past the start.
 */
function loop(): string {
  const pts: string[] = [];
  const turns = 1.08;
  const steps = 56;
  const lean = (-14 * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = (-110 * Math.PI) / 180 + t * turns * 2 * Math.PI;
    /* The pen comes in a touch wide and finishes a touch outside its start. */
    const grow = 1 + 0.06 * t;
    const x0 = 9.4 * grow * Math.cos(a);
    const y0 = 8.6 * grow * Math.sin(a);
    const x = x0 * Math.cos(lean) - y0 * Math.sin(lean);
    const y = x0 * Math.sin(lean) + y0 * Math.cos(lean);
    pts.push(`${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join("");
}

const RING_PATH = loop();

export default function Ring({ size = 14, tone = "signal", draw = true, dot = true, className = "", children }: RingProps) {
  /* A bare number, so the stylesheet can size the stroke in the SVG's units. */
  const style = { "--ring-n": size } as CSSProperties;
  return (
    <span
      className={`${styles.ring} ${className}`.trimEnd()}
      style={style}
      data-tone={tone}
      data-draw={draw ? "" : undefined}
      aria-hidden="true"
    >
      <svg className={styles.loop} viewBox="-12 -12 24 24" focusable="false">
        <path className={styles.stroke} d={RING_PATH} pathLength={1} />
      </svg>
      {children ?? (dot ? <span className={styles.dot} /> : null)}
    </span>
  );
}
