import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import styles from "@/components/ui/Disclosure.module.css";

/*
 * One expander for the whole app. Native <details> keeps keyboard, find-in-page
 * and no-JS behaviour for free; the glyph is a real SVG (not a CSS pseudo
 * element) so it can be asserted, sized and mirrored in one place.
 */

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

export interface DisclosureProps {
  summary: ReactNode;
  /** One-line state shown beside the summary (e.g. "unsaved"). Wraps, never truncates. */
  meta?: ReactNode;
  /** Controlled open state. Omit for an uncontrolled, default-closed disclosure. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  testid?: string;
  className?: string;
  children?: ReactNode;
}

export function Disclosure({ summary, meta, open, onOpenChange, testid, className, children }: DisclosureProps) {
  return (
    <details
      className={cx(styles.disclosure, className)}
      open={open}
      data-testid={testid}
      onToggle={(e) => onOpenChange?.(e.currentTarget.open)}
    >
      <summary className={styles.summary}>
        <ChevronRight className={styles.chevron} size={20} strokeWidth={2.25} aria-hidden="true" focusable="false" />
        <span className={styles.label}>{summary}</span>
        {meta != null && <span className={styles.meta}>{meta}</span>}
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}

export interface DisclosureButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "aria-expanded" | "aria-controls" | "type"> {
  expanded: boolean;
  /** id of the region this button shows and hides; required so it is never forgotten. */
  controls: string;
  onToggle: () => void;
}

export function DisclosureButton({ expanded, controls, onToggle, className, children, ...rest }: DisclosureButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      className={cx(styles.button, className)}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
    >
      <ChevronRight className={styles.chevron} size={20} strokeWidth={2.25} aria-hidden="true" focusable="false" />
      <span className={styles.label}>{children}</span>
    </button>
  );
}
