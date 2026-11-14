import { useState } from "react";
import { Ellipsis } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Presence } from "@/components/ui/Presence";
import { ICON } from "@/components/ui/icons";
import type { Selection, SelectionId } from "@/components/ui/useSelection";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/SelectionBar.module.css";

/*
 * The two visible parts of select mode.
 *
 *  - SelectionHeader: the button that enters it (always visible: long-press is
 *    a bonus, never the only way), which becomes Done in the mode, and a
 *    select-all / select-none toggle.
 *  - SelectionBar: sticky at the bottom while the mode is on. The count in a
 *    polite live region, the first action as the primary button, and More,
 *    which opens a BottomSheet listing every action with its item count.
 *
 * An action marked `destructive` never runs on one tap: it opens a confirm
 * sheet whose title and button name the object and the count ("Delete 3
 * posts"), with Keep beside it. Destructive rows sort last in the list.
 * After an action runs the mode is left. A reversible or deferred action
 * pairs with `useUndoable` (an Undo toast) in the caller's `run`.
 */
export interface SelectionAction<T extends SelectionId = string> {
  id: string;
  icon: LucideIcon;
  /** The verb: "Archive". */
  label: string;
  run: (ids: T[]) => void | Promise<void>;
  destructive?: boolean;
  /** Required in practice for a destructive action: "Delete 3 posts". Falls back to "label (n)". */
  confirm?: (count: number) => string;
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

export function SelectionHeader<T extends SelectionId>({ selection, total }: { selection: Selection<T>; total: number }) {
  const w = useMobileWords().selection;
  const Select = ICON.select;
  return (
    <div className={styles.head}>
      {selection.on && (
        <button
          type="button"
          className={styles.btn}
          disabled={total === 0}
          onClick={() => (selection.allSelected ? selection.none() : selection.all())}
        >
          {selection.allSelected ? w.none : w.all}
        </button>
      )}
      <button
        type="button"
        className={cx(styles.btn, selection.on && styles.primary)}
        onClick={() => (selection.on ? selection.exit() : selection.enter())}
      >
        {!selection.on && <Select size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />}
        {selection.on ? w.done : w.select}
      </button>
    </div>
  );
}

export function SelectionBar<T extends SelectionId>({
  selection,
  actions,
}: {
  selection: Selection<T>;
  actions: SelectionAction<T>[];
}) {
  const w = useMobileWords().selection;
  const [more, setMore] = useState(false);
  const [confirming, setConfirming] = useState<SelectionAction<T> | null>(null);

  if (actions.length === 0) return null;

  const { count } = selection;
  const [primary, ...rest] = actions;
  const sorted = [...actions].sort((a, b) => Number(Boolean(a.destructive)) - Number(Boolean(b.destructive)));
  const confirmLabel = (a: SelectionAction<T>) => a.confirm?.(count) ?? `${a.label} (${count})`;

  const execute = async (a: SelectionAction<T>) => {
    const ids = selection.ids;
    await a.run(ids);
    selection.exit();
  };
  const choose = (a: SelectionAction<T>) => {
    if (a.destructive) setConfirming(a);
    else {
      setMore(false);
      void execute(a);
    }
  };

  const Icon = primary.icon;
  return (
    <>
      <Presence show={selection.on} className={styles.bar} role="toolbar" aria-label={w.barLabel}>
        <span className={styles.count} role="status" aria-live="polite">
          {w.count(count)}
        </span>
        <button
          type="button"
          className={cx(styles.btn, styles.primary, primary.destructive && styles.danger)}
          disabled={count === 0}
          onClick={() => choose(primary)}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />
          {primary.label}
        </button>
        {rest.length > 0 && (
          <button type="button" className={styles.btn} disabled={count === 0} onClick={() => setMore(true)}>
            <Ellipsis size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />
            {w.more}
          </button>
        )}
      </Presence>

      {selection.on && (
        <>
        <BottomSheet open={more} onClose={() => setMore(false)} title={w.moreTitle} snap="half" snaps={["half"]}>
          <div className={styles.list}>
            {sorted.map((a) => (
              <button key={a.id} type="button" className={cx(styles.item, a.destructive && styles.danger)} onClick={() => choose(a)}>
                <a.icon size={20} strokeWidth={1.75} aria-hidden="true" focusable="false" />
                <span className={styles.verb}>{a.label}</span>
                <span className={styles.sub}>{w.items(count)}</span>
              </button>
            ))}
          </div>
        </BottomSheet>

        <BottomSheet
          open={confirming !== null}
          onClose={() => setConfirming(null)}
          title={confirming ? confirmLabel(confirming) : ""}
          snap="peek"
          snaps={["peek"]}
          footer={
            confirming && (
              <>
                <button type="button" className={styles.btn} onClick={() => setConfirming(null)}>
                  {w.keep}
                </button>
                <button
                  type="button"
                  className={cx(styles.btn, styles.primary, styles.danger)}
                  onClick={() => {
                    const a = confirming;
                    setConfirming(null);
                    void execute(a);
                  }}
                >
                  {confirmLabel(confirming)}
                </button>
              </>
            )
          }
        >
          <p className={styles.confirmBody}>{w.items(count)}</p>
        </BottomSheet>
        </>
      )}
    </>
  );
}
