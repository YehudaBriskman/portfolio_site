import { useId, useState } from "react";
import { ErrorState } from "@/components/admin/ui";
import { ANNOUNCE_CHANNELS, type AnnounceChannel, type AnnounceLang, type AnnounceLibraryItem } from "@/services/adminAnnounce";
import { same, useSettingsDoc } from "../useSettingsDoc";
import { useAnnounceWords } from "../words";
import { builtinTemplate } from "./defaults";
import SnippetsEditor from "./SnippetsEditor";
import TemplateEditor, { type EditorValue } from "./TemplateEditor";
import { useRecentEvents } from "./useSample";
import { newId, settleDefault, withDefault } from "./variables";
import VisitorTemplates from "./VisitorTemplates";
import { useLibraryWords } from "./words";

export const LIBRARY_MAX = 100;

type Target = { kind: "item"; id: string } | { kind: "builtin"; lang: AnnounceLang; channel: AnnounceChannel };

/*
 * The Library tab: the owner's named templates, the built-in ones (editable,
 * each with Reset to default), snippets, and the visitor share templates.
 * Everything except the visitor templates is one document, saved together
 * with the revision that was read; the visitor templates are public settings
 * and save on their own.
 *
 * Version history is not here: the backend keeps one revision of the
 * document, not a list, so there is nothing honest to show yet.
 */
export default function LibraryPanel() {
  const w = useLibraryWords();
  const a = useAnnounceWords();
  const uid = useId();
  const doc = useSettingsDoc();
  const events = useRecentEvents();
  const [target, setTarget] = useState<Target | null>(null);
  const [lang, setLang] = useState<AnnounceLang | "all">("all");
  const [channel, setChannel] = useState<AnnounceChannel | "all">("all");
  const [confirm, setConfirm] = useState<string | null>(null);

  const { view, draft, status, issues, edit } = doc;
  if (doc.loadError) return <ErrorState message={w.loadFailed} onRetry={doc.reload} />;
  if (!draft || !view) return <p className="a-box a-box-row text-clay" role="status">{w.loading}</p>;

  const dirty = !same(draft, view.settings);
  const items = draft.library.filter((i) => (lang === "all" || i.lang === lang) && (channel === "all" || i.channel === channel));
  const bad = status === "conflict" || status === "failed";
  const statusText = status === "saving" ? a.saving : status === "saved" ? a.saved : status === "conflict" ? a.conflict : status === "failed" ? a.saveFailed : dirty ? w.unsaved : "";

  const add = (base: Partial<AnnounceLibraryItem> = {}) => {
    const item: AnnounceLibraryItem = {
      id: newId("t"),
      name: w.newTemplate,
      channel: channel === "all" ? "linkedin" : channel,
      lang: lang === "all" ? "en" : lang,
      text: "",
      ...base,
      default: undefined,
    };
    edit((d) => void d.library.push(item));
    setTarget({ kind: "item", id: item.id });
  };

  const patchItem = (id: string, p: Partial<AnnounceLibraryItem>) =>
    edit((d) => void (d.library = settleDefault(d.library.map((i) => (i.id === id ? { ...i, ...p } : i)), id)));
  const setDefault = (id: string, on: boolean) => edit((d) => void (d.library = withDefault(d.library, id, on)));
  const defaultOf = (channel: AnnounceChannel, lang: AnnounceLang) => draft.library.find((i) => i.default && i.channel === channel && i.lang === lang);

  const current = target?.kind === "item" ? draft.library.find((i) => i.id === target.id) : undefined;
  const editorValue: EditorValue | null =
    target?.kind === "item" && current
      ? { name: current.name, channel: current.channel, lang: current.lang, text: current.text }
      : target?.kind === "builtin"
        ? { channel: target.channel, lang: target.lang, text: draft.templates[target.lang][target.channel] ?? builtinTemplate(target.lang, target.channel) }
        : null;

  const hashtags = draft.hashtags;
  const editor = editorValue && target && (
    <TemplateEditor
      key={target.kind === "item" ? target.id : `${target.lang}-${target.channel}`}
      value={editorValue}
      defaults={target.kind === "item" && current ? { on: Boolean(current.default), current: defaultOf(current.channel, current.lang)?.name, onChange: (on) => setDefault(current.id, on) } : undefined}
      snippets={draft.snippets}
      events={events}
      hashtags={hashtags}
      onClose={() => setTarget(null)}
      onChange={(v) => {
        if (target.kind === "item") patchItem(target.id, { name: v.name ?? "", channel: v.channel, lang: v.lang, text: v.text });
        else {
          const def = builtinTemplate(target.lang, target.channel);
          edit((d) => void (v.text === def || v.text === "" ? delete d.templates[target.lang][target.channel] : (d.templates[target.lang][target.channel] = v.text)));
        }
      }}
      builtin={target.kind === "builtin" ? { defaultText: builtinTemplate(target.lang, target.channel), onReset: () => edit((d) => void delete d.templates[target.lang][target.channel]) } : undefined}
    />
  );

  return (
    <div className="max-w-5xl space-y-10" data-testid="library">
      <div>
        <h2 className="display-tight text-xl">{w.heading}</h2>
        <p className="a-hint">{w.intro}</p>
      </div>

      <section aria-labelledby={`${uid}-t`} className="space-y-3">
        <div>
          <h3 id={`${uid}-t`} className="display-tight text-lg">{w.templatesHeading}</h3>
          <p className="a-hint !mt-0">{w.templatesHint}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="a-label" htmlFor={`${uid}-fl`}>{w.filterLang}</label>
            <select id={`${uid}-fl`} className="a-select min-h-[44px]" value={lang} onChange={(e) => setLang(e.target.value as AnnounceLang | "all")}>
              <option value="all">{w.all}</option>
              {(["en", "he"] as const).map((l) => <option key={l} value={l}>{a.langs[l]}</option>)}
            </select>
          </div>
          <div>
            <label className="a-label" htmlFor={`${uid}-fc`}>{w.filterChannel}</label>
            <select id={`${uid}-fc`} className="a-select min-h-[44px]" value={channel} onChange={(e) => setChannel(e.target.value as AnnounceChannel | "all")}>
              <option value="all">{w.all}</option>
              {ANNOUNCE_CHANNELS.map((c) => <option key={c} value={c}>{a.channels[c]}</option>)}
            </select>
          </div>
          <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={draft.library.length >= LIBRARY_MAX} onClick={() => add()}>{w.newTemplate}</button>
        </div>
        {draft.library.length >= LIBRARY_MAX && <p className="a-hint">{w.limitReached(LIBRARY_MAX)}</p>}
        {items.length === 0 ? (
          <p className="a-hint">{w.noTemplates}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => {
              const name = i.name || w.untitled;
              return (
                <li key={i.id} className="a-box flex flex-wrap items-center gap-2 p-2 ps-4" data-active={target?.kind === "item" && target.id === i.id}>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-bold" dir="auto">{name}</p>
                    <p className="text-xs text-clay">{a.channels[i.channel]} · {a.langs[i.lang]}{i.default && <> · <strong>{w.defaultBadge}</strong></>}</p>
                  </div>
                  <label className="flex min-h-[44px] items-center gap-2 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={Boolean(i.default)} onChange={(e) => setDefault(i.id, e.target.checked)} />
                    <span>{w.useDefault(a.channels[i.channel], a.langs[i.lang])}</span>
                  </label>
                  <button type="button" className="a-btn min-h-[44px]" aria-label={w.open(name)} aria-expanded={target?.kind === "item" && target.id === i.id} onClick={() => setTarget({ kind: "item", id: i.id })}>{a.openShort}</button>
                  <button type="button" className="a-btn min-h-[44px]" aria-label={w.duplicate(name)} disabled={draft.library.length >= LIBRARY_MAX} onClick={() => add({ ...i, id: newId("t"), name: `${i.name} (${w.copySuffix})`.slice(0, 60) })}>
                    {w.duplicateShort}
                  </button>
                  {confirm === i.id ? (
                    <>
                      <button type="button" className="a-btn min-h-[44px] !border-[rgb(var(--destructive-ink))] text-[rgb(var(--destructive-ink))]" onClick={() => (edit((d) => void (d.library = d.library.filter((x) => x.id !== i.id))), setConfirm(null), target?.kind === "item" && target.id === i.id && setTarget(null))}>
                        {w.confirmRemove(name)}
                      </button>
                      <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => setConfirm(null)}>{w.cancel}</button>
                    </>
                  ) : (
                    <button type="button" className="a-btn a-btn-ghost min-h-[44px]" aria-label={w.remove(name)} onClick={() => setConfirm(i.id)}>{w.removeShort}</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {target?.kind === "item" && editor}
      </section>

      <section aria-labelledby={`${uid}-b`} className="space-y-3">
        <div>
          <h3 id={`${uid}-b`} className="display-tight text-lg">{w.builtinHeading}</h3>
          <p className="a-hint !mt-0">{w.builtinHint}</p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(["en", "he"] as const).flatMap((l) =>
            ANNOUNCE_CHANNELS.map((c) => {
              const own = draft.templates[l][c] !== undefined;
              const open = target?.kind === "builtin" && target.lang === l && target.channel === c;
              return (
                <li key={`${l}-${c}`} className="a-box flex items-center gap-2 p-2 ps-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{a.channels[c]} · {a.langs[l]}</p>
                    <p className="text-xs text-clay">{own ? w.customised : w.builtinBadge}</p>
                  </div>
                  <button type="button" className="a-btn min-h-[44px]" aria-expanded={open} aria-label={w.open(`${a.channels[c]}, ${a.langs[l]}`)} onClick={() => setTarget({ kind: "builtin", lang: l, channel: c })}>{a.openShort}</button>
                </li>
              );
            }),
          )}
        </ul>
        {target?.kind === "builtin" && editor}
      </section>

      <SnippetsEditor snippets={draft.snippets} onChange={(next) => edit((d) => void (d.snippets = next))} />

      {issues.length > 0 && (
        <div role="alert">
          <p className="a-error">{a.invalid}</p>
          <ul className="list-disc ps-5">
            {issues.map((i) => <li key={i.path + i.message} className="a-error mt-0">{i.path ? `${i.path}: ` : ""}{i.message}</li>)}
          </ul>
        </div>
      )}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-[rgb(var(--rule-firm)/.4)] bg-[rgb(var(--paper))] py-3" role="group" aria-label={w.saveBar}>
        <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={!dirty || status === "saving"} onClick={() => void doc.save(draft)}>{w.save}</button>
        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" disabled={!dirty || status === "saving"} onClick={doc.discard}>{a.reset}</button>
        {status === "conflict" && <button type="button" className="a-btn min-h-[44px]" onClick={doc.reload}>{a.reload}</button>}
        <span role="status" className={`text-sm ${bad ? "font-bold text-[rgb(var(--destructive-ink))]" : "text-clay"}`}>{statusText}</span>
      </div>

      <VisitorTemplates />
    </div>
  );
}
