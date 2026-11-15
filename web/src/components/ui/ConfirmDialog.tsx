import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "@/components/ui/ConfirmDialog.module.css";

/*
 * A confirm for what Undo cannot reverse (A26): send, publish, a permanent
 * delete, revoke access. Everything reversible runs at once with an Undo toast
 * instead and never reaches this.
 *
 * The buttons are the outcome ("Delete 3 posts" / "Keep"), the text names the
 * object and the count, and the default focus is the SAFE button (cancel), so an
 * Enter pressed by reflex keeps the thing. The title is not a question ("Are you
 * sure?" tells nobody anything): it says what will happen. A native modal
 * <dialog>: the browser gives the top layer, the inert page, Escape and a focus
 * trap; this adds the safe focus and puts focus back on whatever opened it.
 * Escape, the backdrop and Cancel all mean "keep". While `busy` nothing closes.
 *
 * The kit owns no words: `title`, `confirm` and `cancel` are the caller's. In
 * development a generic confirm label (OK, Yes, Confirm) or an "Are you sure"
 * title is reported, so the wording cannot drift back (`isOutcomeWording`).
 */

export type ConfirmTone = "danger" | "neutral";

export interface ConfirmDialogProps {
  open: boolean;
  /** What will happen, as a statement: "Delete 3 posts?" is fine, "Are you sure?" is not. */
  title: string;
  /** The object and the count, and what else changes. */
  children?: ReactNode;
  /** The outcome as a verb phrase: "Delete 3 posts". Never OK, Yes or Confirm. */
  confirm: string;
  /** The safe button: "Keep", "Not yet". Never "No". */
  cancel: string;
  /** `danger` fills the confirm button red: it is the confirm step (A1). */
  tone?: ConfirmTone;
  onConfirm: () => void;
  /** Cancel, Escape and the backdrop. The caller closes the dialog. */
  onCancel: () => void;
  /** The confirmed work is running: both buttons are off and nothing closes. */
  busy?: boolean;
}

const GENERIC = /^\s*(ok|okay|yes|no|confirm|sure|continue|proceed|אישור|כן|לא|אשר|בסדר)\s*[.!]?\s*$/i;
const QUESTION = /are you sure|בטוח/i;

/** True when the labels name an outcome rather than a generic answer (the A26 check). */
export function isOutcomeWording(confirm: string, title = ""): boolean {
  return !GENERIC.test(confirm) && !QUESTION.test(title) && !QUESTION.test(confirm);
}

export function ConfirmDialog({ open, title, children, confirm, cancel, tone = "danger", onConfirm, onCancel, busy = false }: ConfirmDialogProps) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const latest = useRef({ onCancel, busy });
  useEffect(() => {
    latest.current = { onCancel, busy };
  });

  if (import.meta.env.DEV && open && !isOutcomeWording(confirm, title)) {
    console.error(`ConfirmDialog: "${confirm}" / "${title}" is not outcome wording (A26). Name what happens: "Delete 3 posts".`);
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      /* The safe default: the browser would focus the first control it finds. */
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      const back = opener.current;
      opener.current = null;
      if (back?.isConnected) back.focus();
    }
  }, [open]);

  /* Unmounted while open: the native dialog is gone, so only focus needs putting back. */
  useEffect(
    () => () => {
      const back = opener.current;
      if (back?.isConnected) back.focus();
    },
    [],
  );

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={children ? `${id}-text` : undefined}
      className={styles.dialog}
      data-tone={tone}
      onCancel={(e) => {
        /* Escape: the caller closes it, so the state stays the truth. */
        e.preventDefault();
        if (!latest.current.busy) latest.current.onCancel();
      }}
      onClick={(e) => {
        /* A press on the backdrop lands on the dialog element itself. */
        if (e.target === e.currentTarget && !latest.current.busy) latest.current.onCancel();
      }}
    >
      <div className={styles.panel}>
        <h2 id={`${id}-title`} className={styles.title}>
          {title}
        </h2>
        {children && (
          <div id={`${id}-text`} className={styles.text}>
            {children}
          </div>
        )}
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className={`a-btn ${styles.button}`} disabled={busy} onClick={onCancel}>
            {cancel}
          </button>
          <button
            type="button"
            className={`a-btn ${styles.button} ${tone === "danger" ? styles.danger : "a-btn-primary"}`}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={onConfirm}
          >
            {confirm}
          </button>
        </div>
      </div>
    </dialog>
  );
}
