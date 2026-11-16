import { useEffect } from "react";
import { ControlBar, type ControlItem } from "@/components/ui/ControlBar";
import type { ControlIcon, ShowLabel } from "@/components/ui/IconButton";
import { DEFAULT_PINNED, MAX_PINNED, useTableActions } from "@/components/ui/useTablePrefs";
import styles from "@/components/ui/RowActions.module.css";

/*
 * What a row can do, drawn as icons (principles 13 and 14, A12 as amended).
 *
 *  - Icons only: the word is the tooltip and the accessible name.
 *  - A few are pulled out, the rest live in one 3-dots "More" menu. Inside a
 *    DataTable the first two non-destructive actions are drawn until the person
 *    chooses, and "Customise actions" lets them pin up to four, saved per
 *    table. On its own (a list row, a card) only the primary is drawn.
 *  - Fewer than three actions, none destructive: all stay inline, no menu.
 *  - A destructive action is never drawn as an icon by default and never
 *    offered for pinning: it sorts last in the menu and the caller confirms.
 *  - More is always drawn (touch has no hover). On a fine pointer the drawn
 *    icons dim, never vanish, while the row is idle.
 *  - `disabled` (select mode) makes the whole group inert.
 *
 * The row itself opens the record, so `primary` is just the first action. Built
 * on ControlBar (priority + the shared menu). Words are the caller's.
 */

export interface RowAction {
  id: string;
  icon: ControlIcon;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** "danger" sorts it last in the menu; it is never drawn as an icon. */
  tone?: "neutral" | "danger";
}

export interface RowActionsProps {
  /** Names the group: "Actions for Launch notes". */
  label: string;
  /** Names the overflow button: "More". */
  moreLabel: string;
  /** The first action. `showLabel` is kept for old callers and ignored: row actions are icons. */
  primary?: Omit<RowAction, "tone"> & { showLabel?: ShowLabel };
  /** The rest, in the order to show them; destructive ones are moved last. */
  actions: RowAction[];
  /** Select mode: nothing here can be reached or pressed. */
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function RowActions({ label, moreLabel, primary, actions, disabled = false, size = "sm", className }: RowActionsProps) {
  const table = useTableActions();
  const all: RowAction[] = [...(primary ? [{ ...primary, tone: "neutral" as const }] : []), ...actions];
  const safe = all.filter((a) => a.tone !== "danger");
  const danger = all.filter((a) => a.tone === "danger");
  const ordered = [...safe, ...danger];

  /* Tell the table what exists so "Customise actions" can list it. */
  const signature = ordered.map((a) => `${a.id}:${a.tone === "danger" ? 1 : 0}`).join("|");
  const register = table?.register;
  useEffect(() => {
    register?.(ordered.map((a) => ({ id: a.id, label: a.label, icon: a.icon, danger: a.tone === "danger" })));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature stands for the list
  }, [register, signature]);

  if (ordered.length === 0) return null;

  /* In a table: the person's pins, else the first two. On its own (a list row, a card): the primary only, as before. */
  const choice = table?.pinned ?? null;
  const drawn = !table ? safe.filter((a) => a.id === primary?.id) : choice ? safe.filter((a) => choice.includes(a.id)).slice(0, MAX_PINNED) : safe.slice(0, DEFAULT_PINNED);
  const allInline = table !== null && danger.length === 0 && safe.length < 3;
  const pinned = new Set((allInline ? safe : drawn).map((a) => a.id));

  const items: ControlItem[] = ordered.map((a) => ({
    id: a.id,
    icon: a.icon,
    label: a.label,
    disabled: a.disabled,
    onSelect: a.onSelect,
    tone: a.tone === "danger" ? ("danger" as const) : undefined,
    priority: pinned.has(a.id) ? 1 : 0,
  }));

  return (
    <span data-row-actions="" className={[styles.root, className].filter(Boolean).join(" ")} inert={disabled || table?.disabled || undefined}>
      <ControlBar label={label} moreLabel={moreLabel} items={items} max={pinned.size} size={size} density="compact" />
      {/* In a table the More slot is kept when no menu is drawn, so the icons end at the same place in every row. */}
      {table && items.length <= pinned.size && <span aria-hidden="true" data-row-actions-spacer="" className={`${styles.spacer} ${styles[size]}`} />}
    </span>
  );
}
