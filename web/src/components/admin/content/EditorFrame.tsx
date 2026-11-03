import type { ReactNode } from "react";
import AdminShell, { type AdminSection } from "@/components/admin/AdminShell";
import StatusPill from "@/components/admin/StatusPill";
import { IssuesContext, type ContentEditor } from "./editor";

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
};

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function EditorFrame<T>({ title, section, intro, preview, editor, children }: Props<T>) {
  const { view, value, state, issues, issueMap, loadError } = editor;
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
      bottomBar={
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <StatusPill state={state} />
          <span className="flex gap-2">{actions}</span>
        </div>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-tight text-[1.75rem] lg:text-[2.25rem]">{title}</h1>
        <div className="hidden items-center gap-3 lg:flex">
          <StatusPill state={state} />
          {actions}
        </div>
      </div>
      <p className="a-hint mt-3 max-w-prose">{intro}</p>

      {loadError && <p className="a-card mt-8 p-4 text-sm text-bone/70">{loadError}</p>}
      {!loadError && view === null && <p className="mono mt-8 text-xs text-clay">Loading…</p>}

      {view && (
        <div className="a-card mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 p-4 text-sm">
          <p className="min-w-0 flex-1">
            {!view.exists
              ? "The site is showing the built-in content. Publish, or seed the store, to start editing it here."
              : view.draft
                ? `A draft is waiting, saved ${when(view.updatedAt)}. The site still shows what was published ${when(view.publishedAt)}.`
                : `Live as published ${when(view.publishedAt)}.`}
          </p>
          <span className="flex flex-wrap gap-2">
            <a href={preview} target="_blank" rel="noreferrer" className="a-btn a-btn-ghost">
              Preview ↗
            </a>
            {view.draft && (
              <button type="button" className="a-btn a-btn-ghost" disabled={busy} onClick={() => void editor.discard()}>
                Discard draft
              </button>
            )}
            {!view.exists && (
              <button type="button" className="a-btn a-btn-ghost" disabled={busy} onClick={() => void editor.seed()}>
                Seed the store
              </button>
            )}
            {state.kind === "conflict" && (
              <button type="button" className="a-btn a-btn-ghost" onClick={editor.reload}>
                Reload
              </button>
            )}
          </span>
        </div>
      )}

      {general.length > 0 && (
        <ul className="a-card mt-4 space-y-1 p-4" aria-label="Problems">
          {general.map((i) => (
            <li key={i.message} className="a-error mt-0">
              {i.message}
            </li>
          ))}
        </ul>
      )}

      {value !== null && (
        <IssuesContext.Provider value={issueMap}>
          <form noValidate onSubmit={(e) => e.preventDefault()} className="max-w-4xl">
            {children(value)}
          </form>
        </IssuesContext.Provider>
      )}
    </AdminShell>
  );
}
