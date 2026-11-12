import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSubscribeWords } from "@/i18n/subscribe";

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
        <div className="mt-8 max-w-[36em] space-y-5 text-[1.0625rem] leading-relaxed text-ink">{children}</div>
        <div className="mt-12">
          <Link to="/" className="btn btn-quiet">
            {w.home}
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

/** Reserves two lines so the result does not push the button below it. */
export function Result({ kind, children }: { kind: "idle" | "ok" | "error"; children?: ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} aria-live={kind === "error" ? "assertive" : "polite"} aria-atomic="true" className="min-h-[3.5rem]" data-kind={kind}>
      {children}
    </p>
  );
}
