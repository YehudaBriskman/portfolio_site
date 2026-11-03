import { useId, type CSSProperties, type ReactNode } from "react";
import { strandPaths, type StrandPoint } from "@/components/motion/ribbon";
import { AuroraGradient, Strands } from "@/components/motion/Strands";
import styles from "@/components/motion/AuroraStrand.module.css";

/*
 * The aurora strand, and the one way it appears (#251 follow-up).
 *
 * The owner, on the live site: the aurora on "How I work" should "start
 * from the left side of the page, appearing like in the Projects section",
 * and the notes should have "the aurora like in Projects too, almost the
 * same animation, but from the left". So there is one strand and one
 * appearing, and the three sections differ only in where it comes from and
 * which clock it reads:
 *
 *   the work run       from the reading end (`right`, mirrored in Hebrew),
 *                      on the run's stage timeline (`projects/RunAurora`)
 *   "How I work"       from the `left`, on its own view timeline, across
 *                      the head of the section; the living line leaves it
 *   the notes shelf    from the `left`, on the shelf's stage timeline,
 *                      behind the cards
 *
 * THE APPEARING. Not a fade and not a draw: the ribbon is uncovered in
 * place. A soft-edged window 130% of the box wide slides in from `from`
 * while the drawing inside it is carried back by exactly the same amount,
 * so the light holds still and the window passes over it. The window's soft
 * edge is its leading 30%, which ends off the box, so once in, the whole
 * ribbon shows. Two transforms on a scroll timeline — scroll is the clock,
 * the motion contract's §1 — and scrolling back takes it out the way it
 * came. Nothing is repainted.
 *
 * `from` is physical, because the owner's instruction is. A caller whose
 * side is the reading end (the run) sets `mirrorInRtl`, and under
 * `html[dir=rtl]` the strand then comes from the other side.
 *
 * `timeline` names a view timeline an ANCESTOR owns (`--run`,
 * `--notes-shelf`); without one the strand's own static box owns
 * `--aurora-strand` and the window reads that. `range` is the window's
 * `animation-range` on whichever it is. Both are passed as custom
 * properties, so the stylesheet has one rule for every caller.
 *
 * `children` replaces the default drawing — a gentle wave across the box,
 * haze and strands — with the caller's (the run draws its own curve, and a
 * surge inside the uncovered hold).
 *
 * The three off-switches land on the strand whole and still: no window, no
 * carry. A caller whose layout changes under them (the run, the shelf) may
 * hide it there instead. Everything here is `aria-hidden` decoration.
 */

export type AuroraFrom = "left" | "right";

type Props = {
  from: AuroraFrom;
  /** A view timeline an ancestor declares; default: the strand's own. */
  timeline?: string;
  /** The appearing's `animation-range` on that timeline. */
  range?: string;
  /** Under `html[dir=rtl]`, come from the other side (a reading-end strand). */
  mirrorInRtl?: boolean;
  className?: string;
  /** The gradient's id, when the caller's own drawing refers to it. */
  gradientId?: string;
  /** The drawing; default, the wave. */
  children?: ReactNode;
  /** Any other data-* hook the caller's tests or scripts need. */
  dataAttrs?: Record<`data-${string}`, string>;
};

/* The default drawing: one long wave across a 1000×100 box, stretched. */
const W = 1000;
const H = 100;
const SAMPLES = 200;
const waveY = (u: number) => H / 2 + 16 * Math.sin(2 * Math.PI * (u * 1.15 + 0.1));
const WAVE_POINTS: StrandPoint[] = Array.from({ length: SAMPLES + 1 }, (_, i) => {
  const u = i / SAMPLES;
  return { x: u * W, y: waveY(u), s: u * W, tx: 1, ty: 0 };
});
const WAVE_PATH = WAVE_POINTS.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(2)}`).join("");
/* Seven strands, as the run: one ribbon on the whole site. */
const WAVE_STRANDS = strandPaths(WAVE_POINTS, { count: 7, half: 14, wave: 210, across: [0, 1], phase: 1.3 });

function Wave({ stroke }: { stroke: string }) {
  return (
    <>
      <svg className={`${styles.curve} ${styles.haze}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" focusable="false">
        <path d={WAVE_PATH} stroke={stroke} vectorEffect="non-scaling-stroke" />
      </svg>
      <svg className={`${styles.curve} ${styles.ribbon}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" focusable="false">
        <Strands stroke={stroke} ds={WAVE_STRANDS} />
      </svg>
    </>
  );
}

export default function AuroraStrand({
  from,
  timeline,
  range,
  mirrorInRtl = false,
  className = "",
  gradientId,
  children,
  dataAttrs,
}: Props) {
  const own = `aurora-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const gid = gradientId ?? own;
  const vars = {
    ...(timeline ? { "--strand-timeline": timeline } : {}),
    ...(range ? { "--strand-range": range } : {}),
  } as CSSProperties;
  return (
    <div
      {...dataAttrs}
      className={`${styles.strand} ${className}`.trimEnd()}
      style={vars}
      aria-hidden="true"
      data-aurora-strand=""
      data-from={from}
      data-mirror={mirrorInRtl ? "" : undefined}
    >
      <svg className={styles.defs} focusable="false">
        <defs>
          <AuroraGradient id={gid} />
        </defs>
      </svg>
      <div className={styles.window} data-aurora-window="">
        <div className={styles.hold}>{children ?? <Wave stroke={`url(#${gid})`} />}</div>
      </div>
    </div>
  );
}
