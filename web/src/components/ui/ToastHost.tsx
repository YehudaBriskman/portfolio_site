import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Toaster as Sonner, toast as sonner } from "sonner";
import { toast, useToastVersion, type ToastRecord } from "@/lib/toast";
import { useToastWords } from "@/i18n/toast";
import { usePhone } from "@/hooks/usePhone";
import { useLang } from "@/components/dashboard/i18n";
import styles from "@/components/ui/ToastHost.module.css";

/*
 * The one renderer of `lib/toast`. Mount it once per app (admin shell, public
 * site); a second host only adds a second copy.
 *
 * WHERE IT LIVES. A modal <dialog> makes everything outside it inert, so a
 * toast in <body> cannot be reached while a sheet or dialog is open. The host
 * is therefore a `popover="manual"` element (top layer: above any sheet, and
 * never clipped or offset by a transformed ancestor) mounted INSIDE the open
 * dialog when there is one, and in <body> otherwise. It moves when a dialog
 * opens or closes and re-emits what is live, so none is lost.
 *
 * WHERE ON SCREEN. Top-centre under 600px (clear of the notch), bottom-right
 * on desktop, bottom-left in RTL. `--toast-avoid` lifts the desktop stack
 * clear of a fixed bar (`setToastAvoid`).
 *
 * ANNOUNCING. Sonner's own live section is switched off and two regions that
 * are mounted ahead say each toast once: status for good news, alert for an
 * error. Nothing here waits for an animation event: sonner's timers are
 * setTimeout and the store is plain state.
 */

const hasDom = typeof document !== "undefined";
/* Without the Popover API (old browsers, jsdom) the host is a plain fixed box: no top layer, but never hidden. */
const hasPopover = typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";

/** The innermost open dialog, or null. Observed, not polled. */
function topDialog(): HTMLElement | null {
  if (!hasDom) return null;
  const open = document.querySelectorAll<HTMLElement>("dialog[open]");
  return open.length ? open[open.length - 1] : null;
}

function subscribeDialogs(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
  return () => mo.disconnect();
}

function useTopDialog(): HTMLElement | null {
  return useSyncExternalStore(subscribeDialogs, topDialog, () => null);
}

function Body({ rec }: { rec: ToastRecord }) {
  const w = useToastWords();
  const hint = rec.description;
  if (!rec.details && !hint) return null;
  const id = `toast-details-${rec.id}`;
  return (
    <div className={styles.body}>
      {hint && <p className={styles.line}>{hint}</p>}
      {rec.details && (
        <>
          <button
            type="button"
            className={styles.more}
            aria-expanded={rec.open}
            aria-controls={id}
            onClick={() => toast.toggleDetails(rec.id)}
          >
            {rec.open ? w.hideDetails : w.details}
          </button>
          {rec.open && (
            <p id={id} className={styles.long}>
              {rec.details}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function ToastHost() {
  useToastVersion();
  const w = useToastWords();
  const lang = useLang();
  const phone = usePhone();
  const dialog = useTopDialog();
  const host = useRef<HTMLDivElement>(null);
  const shown = useRef(new Map<string, number>());
  const lastMount = useRef<HTMLElement | null>(null);

  useEffect(() => {
    toast.hostMounted(true);
    return () => toast.hostMounted(false);
  }, []);

  /* A new container is a new Sonner with no toasts: forget what was shown. */
  const mount: HTMLElement | null = hasDom ? (dialog ?? document.body) : null;
  /* Top layer where the browser has one; plain fixed positioning elsewhere (jsdom). */
  useLayoutEffect(() => {
    const el = host.current;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      if (!el.matches(":popover-open")) el.showPopover();
    } catch {
      /* Not connected yet, or already open. */
    }
  });

  /* Sonner's own section must not announce as well as ours. */
  const setSection = (el: HTMLElement | null) => {
    el?.setAttribute("aria-live", "off");
  };

  const records = toast.live();
  useEffect(() => {
    const seen = shown.current;
    if (lastMount.current !== mount) {
      lastMount.current = mount;
      seen.clear();
    }
    const ids = new Set(records.map((r) => r.id));
    for (const [id] of seen) {
      if (!ids.has(id)) {
        seen.delete(id);
        sonner.dismiss(id);
      }
    }
    for (const r of records) {
      if (seen.get(r.id) === r.rev) continue;
      seen.set(r.id, r.rev);
      const body: ReactNode = <Body rec={r} />;
      sonner[r.kind](r.title, {
        id: r.id,
        description: r.description || r.details ? body : undefined,
        duration: r.duration,
        dismissible: r.dismissible,
        closeButton: r.dismissible,
        action: r.action && { label: r.action.label, onClick: r.action.onClick },
        cancel: r.secondary && { label: r.secondary.label, onClick: r.secondary.onClick },
        onDismiss: () => toast.gone(r.id, "dismiss"),
        onAutoClose: () => toast.gone(r.id, "auto"),
      });
    }
  });

  if (!mount) return null;

  const rtl = lang === "he";
  const a = toast.announcement();
  const pad = a.n % 2 ? "​" : "";
  const node = (
    <div ref={host} popover={hasPopover ? "manual" : undefined} className={styles.host} data-toast-host="">
      <div className={styles.live} role="status" aria-live="polite" aria-atomic="true">
        {a.status && a.status + pad}
      </div>
      <div className={styles.live} role="alert" aria-atomic="true">
        {a.alert && a.alert + pad}
      </div>
      <Sonner
        ref={setSection}
        theme="light"
        className={styles.toaster}
        position={phone ? "top-center" : rtl ? "bottom-left" : "bottom-right"}
        dir={rtl ? "rtl" : "ltr"}
        visibleToasts={3}
        closeButton={false}
        offset={{ bottom: "calc(var(--toast-avoid, 0px) + 1rem)", top: "1rem", left: "1rem", right: "1rem" }}
        mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)", left: "0.75rem", right: "0.75rem" }}
        swipeDirections={phone ? ["top", rtl ? "left" : "right"] : [rtl ? "left" : "right"]}
        containerAriaLabel={w.region}
        toastOptions={{
          classNames: { toast: `pop-toast ${styles.toast}`, title: styles.title, description: styles.desc },
          closeButtonAriaLabel: w.dismiss,
        }}
      />
    </div>
  );
  return createPortal(node, mount);
}
