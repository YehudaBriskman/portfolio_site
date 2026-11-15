import type { CSSProperties } from "react";
import styles from "@/components/ui/Skeleton.module.css";

/*
 * A placeholder that has the shape of the data (A18): the same column template
 * and row height as the table that replaces it, so nothing shifts when the rows
 * land. `variant="cards"` is the phone list. The bars are hidden from assistive
 * tech; one polite status says the one word. Static: no shimmer. A caller
 * draws it only after about a second (SkeletonSwap, or its own delay): a
 * placeholder for a fast load is a flicker.
 */

export interface SkeletonColumn {
  id: string;
  /** A CSS grid track: "2fr", "6rem". Default 1fr. */
  width?: string;
  align?: "start" | "end" | "num";
}

export interface SkeletonProps {
  columns?: SkeletonColumn[];
  rows?: number;
  /** Row height, e.g. "3rem". */
  height?: string;
  variant?: "rows" | "cards";
  /** The spoken word ("Loading"); the caller's. */
  label: string;
  className?: string;
}

/** Bar widths vary a little so a column of them does not read as a barcode. */
const BAR = [78, 62, 90, 54, 70];

export function Skeleton({ columns, rows = 5, height, variant = "rows", label, className }: SkeletonProps) {
  const template = columns?.map((c) => c.width ?? "1fr").join(" ");
  return (
    <div aria-busy="true" data-variant={variant} className={[styles.root, className].filter(Boolean).join(" ")}>
      <p role="status" className={styles.sr}>
        {label}
      </p>
      {Array.from({ length: rows }, (_, i) => {
        const style: CSSProperties = { blockSize: height, gridTemplateColumns: variant === "rows" ? template : undefined };
        return (
          <div key={i} data-skeleton-row="" aria-hidden="true" className={styles.row} style={style}>
            {variant === "cards" ? (
              <>
                <span className={styles.disc} />
                <span className={styles.lines}>
                  <span className={styles.bar} style={{ inlineSize: `${BAR[i % BAR.length]}%` }} />
                  <span className={`${styles.bar} ${styles.faint}`} style={{ inlineSize: `${BAR[(i + 2) % BAR.length] - 20}%` }} />
                </span>
              </>
            ) : (
              (columns ?? [{ id: "x" }]).map((c, j) => (
                <span key={c.id} className={styles.cell} data-align={c.align ?? "start"}>
                  <span className={styles.bar} style={{ inlineSize: `${c.align === "num" ? 55 : BAR[(i + j) % BAR.length]}%` }} />
                </span>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
