import styles from "@/components/ui/Sparkline.module.css";

/*
 * A tiny inline line chart: one SVG path, no chart library, no axes. It draws
 * only what it is given: fewer than two real values draw nothing (never a trend
 * from one number). Time runs left to right in both languages, so it is never
 * mirrored. One role="img" with a text name; the caller says what it shows.
 */

/** The path of a series in a w x h box, with `pad` px above and below. Max is on top. */
export function sparkPath(values: number[], w: number, h: number, pad = 2): string {
  const v = values.filter((n) => Number.isFinite(n));
  if (v.length < 2) return "";
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const span = hi - lo;
  const inner = h - pad * 2;
  const round = (n: number) => Math.round(n * 100) / 100;
  return v
    .map((n, i) => {
      const x = round((i / (v.length - 1)) * w);
      const y = span === 0 ? round(h / 2) : round(pad + inner - ((n - lo) / span) * inner);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export interface SparklineProps {
  values: number[];
  /** What it shows, in words ("Posts per week, last 12 weeks: ..."). Required. */
  label: string;
  height?: number;
  className?: string;
}

export function Sparkline({ values, label, height = 28, className }: SparklineProps) {
  const W = 100;
  const d = sparkPath(values, W, height);
  if (!d) return null;
  return (
    <svg
      className={[styles.spark, className].filter(Boolean).join(" ")}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      direction="ltr"
      role="img"
      aria-label={label}
      style={{ blockSize: height }}
    >
      <path d={`${d} L${W},${height} L0,${height} Z`} className={styles.area} />
      <path d={d} className={styles.line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
