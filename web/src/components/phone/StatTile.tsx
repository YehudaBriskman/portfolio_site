import type { ReactNode } from "react";
import "@/components/phone/tokens.css";
import styles from "@/components/phone/phone.module.css";
import AvatarCircle, { type Tone } from "@/components/phone/AvatarCircle";

/**
 * One counted fact: a 32px circle, a figure at 20/700 and a 12.5px label.
 * Phone only: it is not rendered visually above 640px, where the page's own
 * facts panel says the same thing. The value is an LTR isolate (`v1.9.0`,
 * `TypeScript`, `1,204`) in either reading direction.
 *
 * A tile for a datum the source does not have must not be rendered at all:
 * callers pass only what exists, never a dash.
 */
export function StatTile({
  icon,
  value,
  label,
  tone = "neutral",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  tone?: Tone;
}) {
  return (
    <div className={styles.tile} data-phone="stat-tile">
      <AvatarCircle size={32} tone={tone}>
        {icon}
      </AvatarCircle>
      <span className={styles.tileText}>
        <span className={styles.tileValue} dir="ltr" translate="no">
          {value}
        </span>
        <span className={styles.tileLabel}>{label}</span>
      </span>
    </div>
  );
}

/** Two tiles to a row; renders nothing at all when there is no tile (no empty box, no shift). */
export function StatGrid({ children, label }: { children: ReactNode[]; label: string }) {
  const tiles = children.filter(Boolean);
  if (tiles.length === 0) return null;
  return (
    <div className={styles.tiles} role="group" aria-label={label} data-phone="stat-grid">
      {tiles}
    </div>
  );
}
