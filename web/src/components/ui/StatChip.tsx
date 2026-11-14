import type { ControlIcon } from "@/components/ui/IconButton";
import styles from "@/components/ui/StatChip.module.css";

/*
 * A fact as glyph + number: a star and 1,204, a branch and 3. The word that
 * names the number is `label`, kept in the DOM for screen readers and drawn
 * nowhere, so the glyph is a hint and never the only source. Numbers are
 * tabular; the caller formats them (Intl) and passes the string or number.
 */

export interface StatChipProps {
  icon: ControlIcon;
  value: number | string;
  /** What the number counts. Spoken, not drawn. */
  label: string;
  className?: string;
}

export function StatChip({ icon: Icon, value, label, className = "" }: StatChipProps) {
  return (
    <span className={`${styles.stat} ${className}`.trim()}>
      <Icon className={styles.icon} aria-hidden="true" />
      <span className={styles.value}>{value}</span>
      <span className={styles.sr}>{label}</span>
    </span>
  );
}
