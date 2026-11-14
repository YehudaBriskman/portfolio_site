import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "@/components/ui/Chip.module.css";

/*
 * A chip: a short pill. With `onClick` it is a toggle button (aria-pressed,
 * and a drawn mark when selected so colour is never the only cue); without
 * one it is a static fact. The word is the caller's, so is the optional
 * `count`, which is drawn in tabular figures.
 */

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> {
  children: ReactNode;
  selected?: boolean;
  count?: number | string;
  leading?: ReactNode;
}

export function Chip({ children, selected = false, count, leading, className = "", onClick, ...rest }: ChipProps) {
  const body = (
    <>
      {leading && (
        <span className={styles.lead} aria-hidden="true">
          {leading}
        </span>
      )}
      <span className={styles.text}>{children}</span>
      {count != null && <span className={styles.count}>{count}</span>}
    </>
  );
  if (!onClick) {
    return (
      <span className={`${styles.chip} ${className}`.trim()} data-selected={selected || undefined}>
        {body}
      </span>
    );
  }
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`${styles.chip} ${styles.button} ${className}`.trim()}
    >
      {body}
    </button>
  );
}

export interface ChipRowProps {
  /** Accessible name of the row. */
  label: string;
  children: ReactNode;
  /** Scroll sideways on one line instead of wrapping. */
  scroll?: boolean;
  className?: string;
}

export function ChipRow({ label, children, scroll = false, className = "" }: ChipRowProps) {
  return (
    <div role="group" aria-label={label} data-scroll={scroll || undefined} className={`${styles.row} ${className}`.trim()}>
      {children}
    </div>
  );
}
