import { ErrorState } from "@/components/admin/ui";
import { Disclosure } from "@/components/ui/Disclosure";
import { same, useSettingsDoc } from "../useSettingsDoc";
import { useAnnounceWords } from "../words";
import LibraryPhone from "./LibraryPhone";
import { usePhone } from "./usePhone";
import { useRecentEvents } from "./useSample";
import VisitorTemplates from "./VisitorTemplates";
import { useLibraryWords } from "./words";

export { LIBRARY_MAX } from "./variables";

/*
 * The Library tab: the owner's named templates, the built-in ones (editable,
 * each with Reset to default), snippets, and the visitor share templates.
 * Everything except the visitor templates is one document, saved together
 * with the revision that was read; the visitor templates are public settings
 * and save on their own.
 *
 * The lists and the one editor are LibraryPhone: rows and a sheet on a phone,
 * tables and a side panel on a desktop. This shell owns the document's Save bar
 * (it appears with the first edit, and not while the panel is open, which has
 * its own Save) and the visitor templates.
 *
 * Version history is not here: the backend keeps one revision of the
 * document, not a list, so there is nothing honest to show yet.
 */
export default function LibraryPanel() {
  const w = useLibraryWords();
  const a = useAnnounceWords();
  const doc = useSettingsDoc();
  const events = useRecentEvents();
  const phone = usePhone();

  const { view, draft, status, issues } = doc;
  if (doc.loadError) return <ErrorState message={w.loadFailed} onRetry={doc.reload} />;
  if (!draft || !view) return <p className="a-box a-box-row text-clay" role="status">{w.loading}</p>;

  const dirty = !same(draft, view.settings);
  const bad = status === "conflict" || status === "failed";
  const statusText = status === "saving" ? a.saving : status === "saved" ? a.saved : status === "conflict" ? a.conflict : status === "failed" ? a.saveFailed : dirty ? w.unsaved : "";

  const issuesBlock =
    issues.length > 0 ? (
      <div role="alert">
        <p className="a-error">{a.invalid}</p>
        <ul className="list-disc ps-5">
          {issues.map((i) => <li key={i.path + i.message} className="a-error mt-0">{i.path ? `${i.path}: ` : ""}{i.message}</li>)}
        </ul>
      </div>
    ) : null;
  /* A bar of two dead buttons would sit on the fold for nothing: it appears with the first edit. */
  const saveBar =
    dirty || status !== "idle" ? (
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-[rgb(var(--rule-firm)/.4)] bg-[rgb(var(--paper))] py-3" role="group" aria-label={w.saveBar}>
        <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={!dirty || status === "saving"} onClick={() => void doc.save(draft)}>{w.save}</button>
        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" disabled={!dirty || status === "saving"} onClick={doc.discard}>{a.reset}</button>
        {status === "conflict" && <button type="button" className="a-btn min-h-[44px]" onClick={doc.reload}>{a.reload}</button>}
        <span role="status" className={`text-sm ${bad ? "font-bold text-[rgb(var(--destructive-ink))]" : "text-clay"}`}>{statusText}</span>
      </div>
    ) : null;

  if (phone) {
    return (
      <div className="min-w-0 space-y-6" data-testid="library">
        <LibraryPhone doc={doc} events={events} />
        {issuesBlock}
        {saveBar}
        <Disclosure summary={w.visitorHeading} meta={w.visitorMeta}>
          <VisitorTemplates bare />
        </Disclosure>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8" data-testid="library">
      {/* The hub names the page; this is the part's name for a screen reader (Campaigns does the same). */}
      <h2 className="sr-only">{w.heading}</h2>
      <LibraryPhone wide doc={doc} events={events} footerBar={<>{issuesBlock}{saveBar}</>} />
      <VisitorTemplates />
    </div>
  );
}
