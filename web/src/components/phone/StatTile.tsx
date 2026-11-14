import type { ReactNode } from "react";
import "@/components/phone/tokens.css";
import styles from "@/components/phone/phone.module.css";
import { StatChip } from "@/components/ui/StatChip";
import type { ControlIcon } from "@/components/ui/IconButton";

/**
 * One counted fact as a glyph and a number (`ui/StatChip`), on a small
 * recessed pill. The word that names it (`label`) stays in the DOM for a
 * screen reader and is drawn nowhere. Phone only: it is not rendered above
 * 640px, where the page's own facts panel says the same thing. The value is a
 * bidi isolate (`v1.9.0`, `TypeScript`, `1,204`) in either reading direction.
 *
 * A tile for a datum the source does not have must not be rendered at all:
 * callers pass only what exists, never a dash.
 */
export function StatTile({ icon, value, label }: { icon: ControlIcon; value: string | number; label: string }) {
  return (
    <div className={styles.tile} data-phone="stat-tile">
      <StatChip icon={icon} value={value} label={label} />
    </div>
  );
}

/** A wrapping row of tiles; renders nothing at all when there is no tile (no empty box, no shift). */
export function StatGrid({ children, label }: { children: ReactNode[]; label: string }) {
  const tiles = children.filter(Boolean);
  if (tiles.length === 0) return null;
  return (
    <div className={styles.tiles} role="group" aria-label={label} data-phone="stat-grid">
      {tiles}
    </div>
  );
}
