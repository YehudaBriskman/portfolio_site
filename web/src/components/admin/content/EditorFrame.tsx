import type { ReactNode } from "react";
import AdminShell, { type AdminSection } from "@/components/admin/AdminShell";
import StatusPill from "@/components/admin/StatusPill";
import { ErrorState, LoadingRows, PageHeader } from "@/components/admin/ui";
import { ExternalLink } from "lucide-react";
import { IssuesContext, type ContentEditor } from "./editor";
import { useFocusField } from "./focusField";

/*
 * The frame every content editor shares (#163): the title, where the
 * document stands (built in, published, a draft waiting), the actions, and
 * the issues that belong to no one field.
 *
 * Save draft keeps the change off the site; Publish puts it there; Preview
 * opens the site reading the drafts (`?preview=1`, which only the gated
 * admin host can answer). The site caches content for a minute, so a publish
 * reaches every reader within one.
 */

type Props<T> = {
  title: string;
  section: AdminSection;
  intro: string;
  preview: string;
  editor: ContentEditor<T>;
  children: (value: T) => ReactNode;
  /** A `#field=` link's path, made absolute for this document (#302). */
  focus?: (value: T, field: string, query: URLSearchParams) => string;
};

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function EditorFrame<T>({ title, section, intro, preview, editor, children, focus }: Props<T>) {
  const { view, value, state, issues, issueMap, loadError } = editor;
  useFocusField(value, focus);
  const busy = state.kind === "saving";
  const general = issues.filter((i) => i.path === "");

  const actions = (
    <>
      <button type="button" className="a-btn a-btn-ghost" disabled={busy || value === null} onClick={() => void editor.saveDraft()}>
        Save draft
      </button>
      <button type="button" className="a-btn a-btn-primary" disabled={busy || value === null} onClick={() => void editor.publish()}>
        Publish
      </button>
    </>
  );

  return (
    <AdminShell
      title={title}
      section={section}
      barEverywhere
      bottomBar={
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <StatusPill state={state} />
          <span className="flex gap-2">{actions}</span>
        </div>
      }
    >
      <div className="a-wrap-narrow">
      <PageHeader title={title} description={intro} />

      {loadError && <ErrorState message={loadError} />}
      {!loadError && view === null && <LoadingRows rows={3} />}

      {view && (
        <div className="a-box flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[var(--a-r-box)] px-4 py-3 text-sm">
          <p className="min-w-0 basis-full sm:flex-1 sm:basis-0">
            {!view.exists
              ? "The site is showing the built-in content. Publish, or seed the store, to start editing it here."
              : view.draft
                ? `A draft is waiting, saved ${when(view.updatedAt)}. The site still shows what was published ${when(view.publishedAt)}.`
                : `Live as published ${when(view.publishedAt)}.`}
          </p>
          <span className="flex w-full flex-wrap gap-2 sm:w-auto">
            <a href={preview} target="_blank" rel="noreferrer" className="a-btn a-btn-ghost min-h-11 rounded-[var(--a-r-ctl)] max-sm:flex-1 md:min-h-8">
              Preview
              <ExternalLink aria-hidden="true" />
            </a>
            {view.draft && (
              <button type="button" className="a-btn a-btn-ghost min-h-11 rounded-[var(--a-r-ctl)] max-sm:flex-1 md:min-h-8" disabled={busy} onClick={() => void editor.discard()}>
                Discard draft
              </button>
            )}
            {!view.exists && (
              <button type="button" className="a-btn a-btn-ghost min-h-11 rounded-[var(--a-r-ctl)] max-sm:flex-1 md:min-h-8" disabled={busy} onClick={() => void editor.seed()}>
                Seed the store
              </button>
            )}
            {state.kind === "conflict" && (
              <button type="button" className="a-btn a-btn-ghost min-h-11 rounded-[var(--a-r-ctl)] max-sm:flex-1 md:min-h-8" onClick={editor.reload}>
                Reload
              </button>
            )}
          </span>
        </div>
      )}

      {general.length > 0 && (
        <ul className="a-box mt-4 space-y-1 p-4" aria-label="Problems">
          {general.map((i) => (
            <li key={i.message} className="a-error mt-0">
              {i.message}
            </li>
          ))}
        </ul>
      )}

      {value !== null && (
        <IssuesContext.Provider value={issueMap}>
          <form noValidate onSubmit={(e) => e.preventDefault()}>
            {children(value)}
          </form>
        </IssuesContext.Provider>
      )}
      </div>
    </AdminShell>
  );
}
