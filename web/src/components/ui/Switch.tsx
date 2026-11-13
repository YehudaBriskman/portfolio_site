import { useId } from "react";
import styles from "@/components/ui/Switch.module.css";

/*
 * An on/off setting that applies at once. A native checkbox with
 * role="switch" keeps form semantics, Space and the label's own hit area; the
 * track and thumb are drawn beside it. The whole row (label and track) is the
 * target, 44px tall. The hint is ONE line and is the switch's description;
 * anything longer belongs behind an InfoPopover.
 */

export interface SwitchProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  /** Extra description ids (SettingsRow passes the first sentence of the help). */
  describedBy?: string;
  className?: string;
}

export function Switch({ label, hint, checked, onChange, disabled, id, describedBy, className }: SwitchProps) {
  const auto = useId();
  const hintId = `${auto}-hint`;
  const desc = [hint ? hintId : "", describedBy ?? ""].filter(Boolean).join(" ") || undefined;
  return (
    <label className={[styles.switch, className].filter(Boolean).join(" ")} data-disabled={disabled ? "true" : undefined}>
      <span className={styles.text}>
        <span className={styles.label} data-sw-label="" title={label}>
          {label}
        </span>
        {hint && (
          <span id={hintId} className={styles.hint} data-sw-hint="">
            {hint}
          </span>
        )}
      </span>
      <input
        id={id}
        className={styles.input}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        aria-describedby={desc}
        onChange={(e) => {
          if (!disabled) onChange(e.currentTarget.checked);
        }}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </label>
  );
}
