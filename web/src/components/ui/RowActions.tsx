import { ControlBar, type ControlItem } from "@/components/ui/ControlBar";
import type { ControlIcon, ShowLabel } from "@/components/ui/IconButton";
import styles from "@/components/ui/RowActions.module.css";

/*
 * What a row can do, said once (A1, A12): at most ONE primary action drawn
 * (with its word from 768px up; an icon with a tooltip below) and one "More"
 * menu with the rest. The row itself opens the record, so the primary is the
 * thing people do next to the row, not "Open".
 *
 * More is always there on touch (no hover to find it by); on a fine pointer it
 * appears with the row's hover or focus and while its menu is open, so a table
 * is not a column of dots. The primary never hides. A destructive action sorts
 * last in the menu and is never the primary; the caller confirms or offers Undo.
 * `disabled` (select mode) makes the whole group inert: no tab stop, no tap.
 *
 * Built on ControlBar (priority + the shared menu), not beside it. Words are
 * the caller's.
 */

export interface RowAction {
  id: string;
  icon: ControlIcon;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** "danger" sorts it last in the menu; it is never drawn as the primary. */
  tone?: "neutral" | "danger";
}

export interface RowActionsProps {
  /** Names the group: "Actions for Launch notes". */
  label: string;
  /** Names the overflow button: "More". */
  moreLabel: string;
  primary?: Omit<RowAction, "tone"> & { showLabel?: ShowLabel };
  /** The rest, in the order to show them; destructive ones are moved last. */
  actions: RowAction[];
  /** Select mode: nothing here can be reached or pressed. */
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function RowActions({ label, moreLabel, primary, actions, disabled = false, size = "md", className }: RowActionsProps) {
  const rest = [...actions.filter((a) => a.tone !== "danger"), ...actions.filter((a) => a.tone === "danger")];
  if (!primary && rest.length === 0) return null;

  /* Primary gets the top priority; ControlBar keeps one drawn (max 1) and moves the rest into More.
     With no primary every action goes to More (max 0). */
  const items: ControlItem[] = [
    ...(primary
      ? [{ id: primary.id, icon: primary.icon, label: primary.label, showLabel: primary.showLabel ?? ("from-md" as const), disabled: primary.disabled, onSelect: primary.onSelect, priority: 1 }]
      : []),
    ...rest.map((a) => ({ id: a.id, icon: a.icon, label: a.label, disabled: a.disabled, onSelect: a.onSelect, tone: a.tone === "danger" ? ("danger" as const) : undefined, priority: 0 })),
  ];
  /* A lone primary with no menu needs no More. */
  const max = primary ? 1 : 0;

  return (
    <span data-row-actions="" className={[styles.root, className].filter(Boolean).join(" ")} inert={disabled || undefined}>
      <ControlBar label={label} moreLabel={moreLabel} items={items} max={max} size={size} density="compact" />
    </span>
  );
}
