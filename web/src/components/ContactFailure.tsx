import { useSyncExternalStore } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Toaster, toast } from "@/components/ui/sonner";
import styles from "@/components/ContactFailure.module.css";

/*
 * The contact form's "message not sent" notice: a toast (title, one short
 * line, a Details button), loaded with the form's dialog and nowhere else.
 *
 * Its Toaster is mounted INSIDE the <dialog>, not at the page's edge. A modal
 * dialog makes everything outside it inert and the top layer paints above
 * everything outside it, so a toast anywhere else would be unreachable by
 * keyboard and screen reader and drawn under the scrim. Its own `id` keeps it
 * apart from the share menu's toaster: sonner shows a toast only on the
 * toaster that has the same id.
 */
const ID = "contact-failure";
const TOASTER = "contact";
/* Long enough to read the line and decide to open Details; sonner also holds
   a toast while it is hovered or has focus. Once Details is open it stays
   until it is closed. */
const READ_MS = 15000;

const PHONE = "(max-width: 599.98px)";
const subscribePhone = (cb: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const isPhone = () => window.matchMedia(PHONE).matches;

/** Top on a phone, where the keyboard and the thumb are at the bottom; bottom right on a desktop. */
export default function ContactToaster({ dir }: { dir: "rtl" | "ltr" }) {
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  return <Toaster id={TOASTER} dir={dir} position={phone ? "top-center" : "bottom-right"} />;
}

export type FailureText = { title: string; short: string; details: string; detailsLabel: string; closeLabel: string };

/* The address inside a sentence is a link of its own, left-to-right even in a Hebrew line. */
function withEmailLink(text: string, email: string): ReactNode {
  const [before, after = ""] = text.split("{email}");
  return (
    <>
      {before}
      <a href={`mailto:${email}`} dir="ltr">
        {email}
      </a>
      {after}
    </>
  );
}

export function dismissContactFailure(): void {
  toast.dismiss(ID);
}

/** `returnFocus` is where focus goes when the reader closes the toast from inside it. */
export function showContactFailure(text: FailureText, email: string, returnFocus: () => void, open = false): void {
  const close = () => {
    toast.dismiss(ID);
    returnFocus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Escape") return;
    /* Escape closes this notice before it closes the dialog, so the reader keeps their words. */
    e.preventDefault();
    e.stopPropagation();
    close();
  };
  toast.custom(
    () => (
      <div className={styles.failure} onKeyDown={onKeyDown}>
        <p role="alert" className={styles.text}>
          <strong>{text.title}</strong> {text.short}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            aria-expanded={open}
            aria-controls={`${ID}-details`}
            onClick={() => showContactFailure(text, email, returnFocus, !open)}
          >
            {text.detailsLabel}
          </button>
          <button type="button" className={styles.button} onClick={close}>
            {text.closeLabel}
          </button>
        </div>
        {open && (
          <p id={`${ID}-details`} className={styles.details}>
            {withEmailLink(text.details, email)}
          </p>
        )}
      </div>
    ),
    { id: ID, toasterId: TOASTER, duration: open ? Infinity : READ_MS },
  );
}
