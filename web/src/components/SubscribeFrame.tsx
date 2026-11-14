import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSubscribeWords } from "@/i18n/subscribe";
import "@/components/phone/tokens.css";
import "@/components/phone/pages-forms.css";

/*
 * The shell the three pages an email links to share. The status area is a
 * live region that is always in the document, with reserved height, so a
 * result arriving neither shifts the page nor goes unannounced.
 */
export default function SubscribeFrame({ title, children }: { title: string; children: ReactNode }) {
  const w = useSubscribeWords();
  useDocumentTitle(title);
  return (
    <PageShell>
      <section className="wrap section-y">
        <h1 className="display mt-3 text-section">{title}</h1>
        <div className="mt-8 max-w-[36em] space-y-5 text-[1.0625rem] leading-relaxed text-ink" data-ph-frame="">{children}</div>
        <div className="mt-12">
          <Link to="/" className="btn btn-quiet" data-ph-back="">
            {w.home}
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

/**
 * Reserves two lines so the result does not push the button below it.
 *
 * `focus` moves focus onto the message when it turns true (never on first
 * render): the button that was pressed is gone or has done its job, and a
 * keyboard or screen-reader reader would otherwise fall back to the top of the page.
 */
export function Result({ kind, focus = false, children }: { kind: "idle" | "ok" | "error"; focus?: boolean; children?: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <p ref={ref} tabIndex={-1} role={kind === "error" ? "alert" : "status"} aria-live={kind === "error" ? "assertive" : "polite"} aria-atomic="true" className="min-h-[3.5rem] outline-none" data-kind={kind} data-ph-result="">
      {children}
    </p>
  );
}
