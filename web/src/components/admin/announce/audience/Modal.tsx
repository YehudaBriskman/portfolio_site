import { useEffect, useRef, type ReactNode } from "react";
import { useAudienceWords } from "./words";

/*
 * A native modal <dialog>: the browser traps focus, Escape closes it and
 * focus returns to the button that opened it. Where showModal is missing
 * (jsdom) it opens as a plain dialog so tests can still reach the content.
 */
export default function Modal({ title, titleId, onClose, children }: { title: string; titleId: string; onClose: () => void; children: ReactNode }) {
  const w = useAudienceWords();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    const opener = document.activeElement as HTMLElement | null;
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
    return () => opener?.isConnected && opener.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="a-box m-auto bg-[rgb(var(--paper))] w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 text-[rgb(var(--ink))] backdrop:bg-black/50 sm:p-6"
      onCancel={(e) => (e.preventDefault(), onClose())}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 id={titleId} className="display-tight text-lg">{title}</h3>
        <button type="button" className="a-btn a-btn-ghost min-h-[44px] min-w-[44px]" onClick={onClose}>{w.close}</button>
      </div>
      {children}
    </dialog>
  );
}
