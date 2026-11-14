import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import styles from "./BackChip.module.css";

/*
 * The phone's way up from a detail page (#780): an arrow circle and the
 * parent's name, at the inline-start of the row the floating menu circle is on.
 *
 * A real link to the parent's URL, never `history.back()`: it works on a deep
 * link, and the browser's own back gesture is left alone. Baymard's warning is
 * that a bare arrow cannot be told from Back, so the parent is named. The
 * accessible name is the full parent name; the drawn name stops at about 18
 * characters with an ellipsis. The arrow mirrors under RTL (R9).
 *
 * Phones only: callers mount it under `usePublicPhone()`.
 */
export default function BackChip({ to, label, gap }: { to: string; label: string; gap?: string }) {
  return (
    <div className={styles.row} style={gap ? ({ "--back-row-gap": gap } as CSSProperties) : undefined}>
      <Link to={to} className={styles.link} aria-label={label} data-back-chip="">
        <span className={styles.pill} data-back-pill="">
          <span className={styles.arrow} aria-hidden="true">
            <ArrowLeft size={18} className={styles.glyph} />
          </span>
          <bdi className={styles.name}>{label}</bdi>
        </span>
      </Link>
    </div>
  );
}
