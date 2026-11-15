import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import type { ICON } from "@/components/ui/icons";
import { Sparkline } from "@/components/ui/Sparkline";
import styles from "@/components/ui/KpiTile.module.css";

/*
 * One figure that is only information: a label, the number, a delta in words
 * and a small drawing (a sparkline from real values, or a MiniBar passed as
 * children). The drawing's slot is always reserved, so every tile in a row is
 * one height. The whole tile is the link to the list it counts. The value is a
 * string so a failed source can show a dash instead of a zero.
 */

export interface KpiDelta {
  /** Short: "+3", "2 failed". */
  text: string;
  tone?: "up" | "down" | "flat";
  /** The delta in a sentence, for the accessible name. */
  label: string;
}

export interface KpiTileProps {
  to: string;
  icon: typeof ICON.note;
  label: string;
  value: string;
  delta?: KpiDelta;
  /** Real values only. Fewer than two draw nothing. */
  series?: { values: number[]; label: string };
  tone?: "neutral" | "danger";
  /** A drawing of your own (a MiniBar) in place of the sparkline. */
  children?: ReactNode;
}

export function KpiTile({ to, icon, label, value, delta, series, tone = "neutral", children }: KpiTileProps) {
  const name = `${label}: ${value}${delta ? `, ${delta.label}` : ""}`;
  return (
    <Link to={to} className={styles.tile} aria-label={name} data-tone={tone}>
      <span className={styles.label}>
        <Icon icon={icon} size={16} aria-hidden="true" />
        <span className={styles.ellipsis}>{label}</span>
      </span>
      <span className={styles.row}>
        <span className={styles.figure} data-kpi-value="" dir="ltr">{value}</span>
        <span className={styles.draw} data-kpi-draw="">
          {children ?? (series ? <Sparkline values={series.values} label={series.label} /> : null)}
        </span>
      </span>
      <span className={styles.delta} data-tone={delta?.tone ?? "flat"}><bdi dir="ltr">{delta?.text ?? ""}</bdi></span>
    </Link>
  );
}
