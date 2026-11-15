import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ICON } from "@/components/ui/icons";
import { Icon } from "@/components/ui/Icon";
import styles from "@/components/admin/overview/overview.module.css";

/*
 * One figure that is only information: a label, the number, a bar or one short
 * note. Every tile in a row is one size (the slot is reserved), so a tile with no
 * bar is as tall as one with. The whole tile is the link to the list it counts.
 */
export function KpiTile({ to, icon, label, value, children }: { to: string; icon: typeof ICON.note; label: string; value: string; children?: ReactNode }) {
  return (
    <li>
      <Link to={to} className={styles.tile}>
        <span className={styles.tileLabel}>
          <Icon icon={icon} size={16} aria-hidden="true" />
          <span className={styles.ellipsis}>{label}</span>
        </span>
        <span className={styles.figure}>{value}</span>
        <span className={styles.slot}>{children}</span>
      </Link>
    </li>
  );
}
