import { useEffect, useRef, type ReactNode } from "react";
import { useAudienceWords } from "./words";

/*
 * A native modal <dialog>: the browser traps focus, Escape closes it and
 * focus returns to the button that opened it. Where showModal is missing
 * (jsdom) it opens as a plain dialog so tests can still reach the content.
 * A form footer marked FOOTER (modalFooter.ts) sticks to the bottom of the scrolling body.
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
      className="a-box m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden !rounded-[20px] bg-[rgb(var(--paper))] p-0 text-[rgb(var(--ink))] shadow-2xl backdrop:bg-black/50 open:flex"
      onCancel={(e) => (e.preventDefault(), onClose())}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
        <h3 id={titleId} className="display-tight text-lg">{title}</h3>
        <button type="button" className="a-btn a-btn-ghost min-h-[44px] min-w-[44px] !rounded-xl" onClick={onClose}>{w.close}</button>
      </div>
      {/* The body scrolls; a form's `data-modal-footer` row sticks to its bottom edge so Save is never below the fold. */}
      <div data-modal-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 has-[[data-modal-footer]]:pb-0 sm:px-6">
        {children}
      </div>
    </dialog>
  );
}
