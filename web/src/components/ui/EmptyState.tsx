import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ICON } from "@/components/ui/icons";
import styles from "@/components/ui/EmptyState.module.css";

/*
 * The three ways a list has nothing to show, and they differ (A18):
 *
 *  - first-use   : the list has never had a row. One sentence that teaches and
 *                  ONE action that makes the first one.
 *  - no-results  : rows exist, the filters hide them. Neutral; names the filters
 *                  that are on and offers one Clear. Never "nothing here".
 *  - error       : it did not load. Says what failed and offers Retry.
 *
 * At most one button is ever drawn (A1): `clear` wins in no-results, `action`
 * elsewhere. All words are the caller's.
 */

export interface EmptyAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  variant: "first-use" | "no-results" | "error";
  title: string;
  /** One sentence. */
  description?: string;
  /** first-use: make the first one. error: Retry. */
  action?: EmptyAction;
  /** no-results: drop the filters. */
  clear?: EmptyAction;
  /** no-results: the filters that are on, as the words people see ("Status: Draft"). */
  filters?: string[];
  className?: string;
  children?: ReactNode;
}

export function EmptyState({ variant, title, description, action, clear, filters, className, children }: EmptyStateProps) {
  const chosen = variant === "no-results" ? (clear ?? action) : action;
  const glyph = variant === "error" ? ICON.attention : variant === "no-results" ? ICON.clearFilters : null;
  const role = variant === "error" ? "alert" : variant === "no-results" ? "status" : undefined;
  return (
    <div role={role} data-variant={variant} className={[styles.root, className].filter(Boolean).join(" ")}>
      {glyph && (
        <span className={styles.glyph}>
          <Icon icon={glyph} size={24} />
        </span>
      )}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.text}>{description}</p>}
      {variant === "no-results" && filters && filters.length > 0 && (
        <ul className={styles.filters}>
          {filters.map((f) => (
            <li key={f} className={styles.filter}>
              {f}
            </li>
          ))}
        </ul>
      )}
      {children}
      {chosen && (
        <button type="button" className={styles.button} onClick={chosen.onClick}>
          {chosen.label}
        </button>
      )}
    </div>
  );
}
