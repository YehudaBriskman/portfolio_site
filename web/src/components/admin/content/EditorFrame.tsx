import type { ReactNode } from "react";
import AdminShell, { type AdminSection } from "@/components/admin/AdminShell";
import EditorBar from "@/components/admin/EditorBar";
import { barStatus } from "@/components/admin/saveReadout";
import { ErrorState, LoadingRows, PageHeader } from "@/components/admin/ui";
import { ExternalLink } from "lucide-react";
import { IssuesContext, type ContentEditor } from "./editor";
import { useFocusField } from "./focusField";
import { EditLangProvider } from "./editLang";
import { useContentWords } from "./words";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { usePhone } from "@/hooks/usePhone";
import { INTL, useLang, type Lang } from "@/components/dashboard/i18n";
import { useAdminWords } from "@/i18n/admin";
import { isolate } from "@/i18n/words";
import { useFormText } from "./formWords";

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

function when(lang: Lang, iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : isolate(lang, d.toLocaleString(INTL[lang], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
}

export default function EditorFrame<T>({ title: rawTitle, section, intro: rawIntro, preview, editor, children, focus }: Props<T>) {
  const lang = useLang();
  const tr = useFormText();
  const nav = useAdminWords().nav as Record<string, string>;
  const title = nav[section] ?? rawTitle;
  const intro = tr(rawIntro);
  const { view, value, state, issues, issueMap, loadError } = editor;
  useFocusField(value, focus);
  const busy = state.kind === "saving";
  const general = issues.filter((i) => i.path === "");
  const words = useContentWords();
  const fw = words.frame;
  const phone = usePhone();
  /* An edit that has not reached the server: dirty, refused, or still going. */
  useLeaveGuard(
    state.kind === "dirty" || state.kind === "saving" || state.kind === "invalid" || state.kind === "failed" || state.kind === "conflict",
    words.leaveConfirm,
  );

  const { tone, text } = barStatus(state);
  const bar = (
    <EditorBar
      tone={tone}
      status={text}
      more={[{ key: "draft", label: fw.saveDraft, disabled: busy || value === null, onSelect: () => void editor.saveDraft() }]}
      primary={
        <button type="button" className="a-btn a-btn-primary" disabled={busy || value === null} onClick={() => void editor.publish()}>
          {fw.publish}
        </button>
      }
    />
  );

  return (
    <AdminShell
      title={title}
      section={section}
      barEverywhere
      bottomBar={bar}
    >
      <div className="a-wrap-narrow">
      {/* A phone's first screen is for the work: the top bar already says where you are, so the
          title stays for assistive tech and the intro sentence is for the desktop. */}
      {phone ? <h1 className="sr-only">{title}</h1> : <PageHeader title={title} description={intro} />}

      {loadError && <ErrorState message={loadError} />}
      {!loadError && view === null && <LoadingRows rows={3} />}

      {view && (
        <div className="a-box flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[var(--a-r-box)] px-4 py-3 text-sm">
          <p className="min-w-0 basis-full sm:flex-1 sm:basis-0">
            {!view.exists
              ? fw.builtIn
              : view.draft
                ? fw.draft(when(lang, view.updatedAt), when(lang, view.publishedAt))
                : fw.live(when(lang, view.publishedAt))}
          </p>
          <span className="flex w-full flex-wrap gap-2 sm:w-auto">
            <a href={preview} target="_blank" rel="noreferrer" className="a-btn a-btn-ghost min-h-11 rounded-[var(--a-r-ctl)] max-sm:flex-1 md:min-h-8">
              {fw.preview}
              <ExternalLink aria-hidden="true" />
            </a>
            {view.draft && (
              <button type="button" className="a-btn a-btn-ghost min-h-11 rounded-[var(--a-r-ctl)] max-sm:flex-1 md:min-h-8" disabled={busy} onClick={() => void editor.discard()}>
                {fw.discard}
              </button>
            )}
            {!view.exists && (
              <button type="button" className="a-btn a-btn-ghost min-h-11 rounded-[var(--a-r-ctl)] max-sm:flex-1 md:min-h-8" disabled={busy} onClick={() => void editor.seed()}>
                {fw.seed}
              </button>
            )}
            {state.kind === "conflict" && (
              <button type="button" className="a-btn a-btn-ghost min-h-11 rounded-[var(--a-r-ctl)] max-sm:flex-1 md:min-h-8" onClick={editor.reload}>
                {fw.reload}
              </button>
            )}
          </span>
        </div>
      )}

      {general.length > 0 && (
        <ul className="a-box mt-4 space-y-1 p-4" aria-label={fw.problems}>
          {general.map((i) => (
            <li key={i.message} className="a-error mt-0">
              {i.message}
            </li>
          ))}
        </ul>
      )}

      {value !== null && (
        <IssuesContext.Provider value={issueMap}>
          <EditLangProvider>
            <form noValidate onSubmit={(e) => e.preventDefault()}>
              {children(value)}
            </form>
          </EditLangProvider>
        </IssuesContext.Provider>
      )}
      </div>
    </AdminShell>
  );
}
