import { useRef, type KeyboardEvent } from "react";
import styles from "@/components/ui/SegmentedControl.module.css";
import type { ControlIcon, ControlSize } from "@/components/ui/IconButton";

/*
 * A short either/or: sort order, view mode. A radio group (APG) drawn as one
 * joined track. One tab stop on the checked option; arrows move and choose
 * (mirrored in a right-to-left page). Words are the caller's. An option's
 * `label` is always its accessible name; `iconOnly` draws just the glyph.
 */

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  icon?: ControlIcon;
  iconOnly?: boolean;
}

export interface SegmentedControlProps<V extends string> {
  /** Accessible name of the group. */
  label: string;
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: ControlSize;
  className?: string;
}

export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: SegmentedControlProps<V>) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key) || !ref.current) return;
    const rtl = getComputedStyle(ref.current).direction === "rtl";
    const fwd = e.key === "ArrowDown" || (e.key === "ArrowRight" && !rtl) || (e.key === "ArrowLeft" && rtl);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? options.length - 1
          : (idx + (fwd ? 1 : -1) + options.length) % options.length;
    e.preventDefault();
    onChange(options[next].value);
    ref.current.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      data-size={size}
      className={`${styles.track} ${styles[size]} ${className}`.trim()}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={i === idx}
          aria-label={o.iconOnly ? o.label : undefined}
          tabIndex={i === idx ? 0 : -1}
          className={styles.seg}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <o.icon className={styles.icon} aria-hidden="true" />}
          {!o.iconOnly && <span className={styles.text}>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}
