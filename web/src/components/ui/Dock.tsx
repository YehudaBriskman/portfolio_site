import type { HTMLAttributes, ReactNode } from "react";
import styles from "@/components/ui/Dock.module.css";

/*
 * The floating pill: an opaque raised surface with a hairline and one shadow,
 * fixed at the bottom of the viewport above the safe area. The reading bar and
 * the pinned action are meant to share it so they cannot drift. A page that
 * mounts one gives itself bottom padding of at least the control height plus
 * `--dock-inset` plus the safe-area inset, so the pill never covers the last
 * line.
 */

export interface DockProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "role"> {
  /** Accessible name of the group of controls. */
  label: string;
  children: ReactNode;
  className?: string;
}

export function Dock({ label, children, className = "", ...rest }: DockProps) {
  return (
    <div {...rest} role="group" aria-label={label} className={`${styles.dock} ${className}`.trim()}>
      {children}
    </div>
  );
}
