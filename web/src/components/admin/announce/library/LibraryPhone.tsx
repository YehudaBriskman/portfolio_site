import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Hash, Link2, Mail, Megaphone, PenLine, Star, type LucideIcon } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Disclosure } from "@/components/ui/Disclosure";
import { FilterChips } from "@/components/ui/FilterChips";
import { InstagramGlyph, LinkedinGlyph, XGlyph } from "@/components/ui/channelGlyphs";
import { RecordRow, type Fact } from "@/components/ui/RecordRow";
import type { FilterDef, Filters } from "@/components/ui/filters";
import {
  ANNOUNCE_CHANNELS,
  ANNOUNCE_SNIPPET_KINDS,
  type AnnounceChannel,
  type AnnounceLang,
  type AnnounceLibraryItem,
  type AnnounceSettings,
  type AnnounceSnippet,
  type AnnounceSnippetKind,
  type AnnounceSummary,
} from "@/services/adminAnnounce";
import { same, type useSettingsDoc } from "../useSettingsDoc";
import { useAnnounceWords } from "../words";
import { builtinTemplate } from "./defaults";
import styles from "./LibraryPhone.module.css";
import { LIBRARY_MAX } from "./variables";
import { SNIPPET_MAX, SnippetFields } from "./SnippetsEditor";
import { planStarter } from "./starter";
import TemplateEditor, { type EditorValue } from "./TemplateEditor";
import { newId, settleDefault, withDefault } from "./variables";
import { useLibraryWords } from "./words";



type Target = { kind: "item"; id: string } | { kind: "builtin"; lang: AnnounceLang; channel: AnnounceChannel } | { kind: "snippet"; id: string };

/* What one sheet may change. Taken when it opens; closing with a different value asks first. */
type Snap = Pick<AnnounceSettings, "library" | "templates" | "snippets">;
const snapOf = (d: AnnounceSettings): Snap => structuredClone({ library: d.library, templates: d.templates, snippets: d.snippets });

const KIND_ICON: Record<AnnounceSnippetKind, LucideIcon> = { hashtags: Hash, signature: PenLine, cta: Megaphone, links: Link2 };

function ChannelMark({ channel, label }: { channel: AnnounceChannel; label: string }) {
  const common = { size: 20, "aria-hidden": true as const };
  return (
    <span className={styles.mark} role="img" aria-label={label}>
      {channel === "linkedin" && <LinkedinGlyph {...common} />}
      {channel === "x" && <XGlyph {...common} />}
      {channel === "instagram" && <InstagramGlyph {...common} />}
      {(channel === "email" || channel === "gmail") && <Mail size={20} strokeWidth={2} aria-hidden="true" focusable="false" />}
    </span>
  );
}

type Doc = ReturnType<typeof useSettingsDoc>;

/*
 * The phone's Library: filter chips, then templates, built-ins and snippets as
 * one-button rows. A row opens ONE editor in a full sheet; the sheet is a
 * transaction on the document draft, so closing it with edits asks first and
 * Discard puts the draft back as it was when the sheet opened. Nothing is
 * saved until Save, and the payload is the same document the desktop sends.
 */
export default function LibraryPhone({ doc, events }: { doc: Doc; events: AnnounceSummary[] }) {
  const w = useLibraryWords();
  const a = useAnnounceWords();
  const uid = useId();
  const { view, draft, status, issues, edit } = doc;
  const [target, setTarget] = useState<Target | null>(null);
  const [before, setBefore] = useState<string>("");
  const [ask, setAsk] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [lang, setLang] = useState<AnnounceLang | "all">("all");
  const [channel, setChannel] = useState<AnnounceChannel | "all">("all");
  const [kind, setKind] = useState<AnnounceSnippetKind | "all">("all");
  const [starterMsg, setStarterMsg] = useState("");
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (ask) keepRef.current?.focus();
  }, [ask]);

  /* Save, then close once the save is the current state (adjusted during render, not in an effect). */
  if (closing && (status === "saved" || status === "conflict" || status === "failed")) {
    setClosing(false);
    if (status === "saved") setTarget(null);
  }

  if (!draft || !view) return null;

  const open = (t: Target, snap: Snap = snapOf(draft)) => {
    setTarget(t);
    setBefore(JSON.stringify(snap));
    setAsk(false);
    setConfirm(false);
  };
  const dirtyHere = target !== null && JSON.stringify(snapOf(draft)) !== before;

  const defs: FilterDef[] = [
    { id: "channel", kind: "segmented", label: w.filterChannel, options: ANNOUNCE_CHANNELS.map((c) => ({ value: c, label: a.channels[c] })) },
    { id: "lang", kind: "segmented", label: w.filterLang, options: (["en", "he"] as const).map((l) => ({ value: l, label: a.langs[l] })) },
    { id: "kind", kind: "segmented", label: w.filterKind, options: ANNOUNCE_SNIPPET_KINDS.map((k) => ({ value: k, label: w.snippetKinds[k] })) },
  ];
  const filters: Filters = {};
  if (channel !== "all") filters.channel = channel;
  if (lang !== "all") filters.lang = lang;
  if (kind !== "all") filters.kind = kind;
  const onFilters = (next: Filters) => {
    setChannel((next.channel as AnnounceChannel | undefined) ?? "all");
    setLang((next.lang as AnnounceLang | undefined) ?? "all");
    setKind((next.kind as AnnounceSnippetKind | undefined) ?? "all");
  };

  const items = draft.library.filter((i) => (lang === "all" || i.lang === lang) && (channel === "all" || i.channel === channel));
  const snippets = draft.snippets.filter((s) => kind === "all" || s.kind === kind);
  const builtins = (["en", "he"] as const).flatMap((l) => ANNOUNCE_CHANNELS.map((c) => ({ l, c }))).filter(({ l, c }) => (lang === "all" || l === lang) && (channel === "all" || c === channel));

  const patchItem = (id: string, p: Partial<AnnounceLibraryItem>) =>
    edit((d) => void (d.library = settleDefault(d.library.map((i) => (i.id === id ? { ...i, ...p } : i)), id)));
  const setDefault = (id: string, on: boolean) => edit((d) => void (d.library = withDefault(d.library, id, on)));
  const defaultOf = (c: AnnounceChannel, l: AnnounceLang) => draft.library.find((i) => i.default && i.channel === c && i.lang === l);

  const addItem = (base: Partial<AnnounceLibraryItem> = {}) => {
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
    open({ kind: "item", id: item.id }, { ...snapOf(draft), library: structuredClone([...draft.library, item]) });
  };
  const addSnippet = () => {
    const s: AnnounceSnippet = { id: newId("s"), name: w.newSnippet, kind: kind === "all" ? "hashtags" : kind, text: "" };
    edit((d) => void d.snippets.push(s));
    open({ kind: "snippet", id: s.id }, { ...snapOf(draft), snippets: structuredClone([...draft.snippets, s]) });
  };

  const starter = planStarter(draft.library, draft.snippets, LIBRARY_MAX);
  const addStarter = () => {
    const plan = planStarter(draft.library, draft.snippets, LIBRARY_MAX);
    edit((d) => {
      d.library.push(...plan.templates);
      d.snippets.push(...plan.snippets);
    });
    setStarterMsg(w.starterResult(plan.added, plan.skipped));
  };

  const requestClose = () => {
    if (dirtyHere) {
      setAsk(true);
      return false;
    }
    setTarget(null);
    return true;
  };
  const discard = () => {
    const snap = JSON.parse(before) as Snap;
    edit((d) => {
      d.library = snap.library;
      d.templates = snap.templates;
      d.snippets = snap.snippets;
    });
    setAsk(false);
    setTarget(null);
  };

  const current = target?.kind === "item" ? draft.library.find((i) => i.id === target.id) : undefined;
  const currentSnippet = target?.kind === "snippet" ? draft.snippets.find((s) => s.id === target.id) : undefined;

  const removeButtons = (name: string, onRemove: () => void): ReactNode =>
    confirm ? (
      <div className={styles.guardActions}>
        <button type="button" className="a-btn min-h-[44px] !border-[rgb(var(--destructive-ink))] text-[rgb(var(--destructive-ink))]" onClick={() => (onRemove(), setConfirm(false), setTarget(null))}>
          {w.confirmRemove(name)}
        </button>
        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => setConfirm(false)}>{w.cancel}</button>
      </div>
    ) : (
      <button type="button" className="a-btn a-btn-ghost min-h-[44px] text-[rgb(var(--destructive-ink))]" aria-label={w.remove(name)} onClick={() => setConfirm(true)}>{w.removeShort}</button>
    );

  let sheetTitle = "";
  let body: ReactNode = null;
  if (target?.kind === "item" && current) {
    const name = current.name || w.untitled;
    sheetTitle = w.editorHeading(name);
    const value: EditorValue = { name: current.name, channel: current.channel, lang: current.lang, text: current.text };
    body = (
      <TemplateEditor
        key={current.id}
        phone
        value={value}
        snippets={draft.snippets}
        events={events}
        hashtags={draft.hashtags}
        onClose={() => void requestClose()}
        onChange={(v) => patchItem(current.id, { name: v.name ?? "", channel: v.channel, lang: v.lang, text: v.text })}
        defaults={{ on: Boolean(current.default), current: defaultOf(current.channel, current.lang)?.name, onChange: (on) => setDefault(current.id, on) }}
        actions={
          <div className="grid min-w-0 gap-2">
            <button type="button" className="a-btn min-h-[44px]" aria-label={w.duplicate(name)} disabled={draft.library.length >= LIBRARY_MAX} onClick={() => addItem({ ...current, id: newId("t"), name: `${current.name} (${w.copySuffix})`.slice(0, 60) })}>
              {w.duplicateShort}
            </button>
            {removeButtons(name, () => edit((d) => void (d.library = d.library.filter((x) => x.id !== current.id))))}
          </div>
        }
      />
    );
  } else if (target?.kind === "builtin") {
    const { lang: l, channel: c } = target;
    const name = `${a.channels[c]}, ${a.langs[l]}`;
    sheetTitle = w.editorHeading(name);
    const def = builtinTemplate(l, c);
    body = (
      <TemplateEditor
        key={`${l}-${c}`}
        phone
        value={{ channel: c, lang: l, text: draft.templates[l][c] ?? def }}
        snippets={draft.snippets}
        events={events}
        hashtags={draft.hashtags}
        onClose={() => void requestClose()}
        onChange={(v) => edit((d) => void (v.text === def || v.text === "" ? delete d.templates[l][c] : (d.templates[l][c] = v.text)))}
        builtin={{ defaultText: def, onReset: () => edit((d) => void delete d.templates[l][c]) }}
      />
    );
  } else if (target?.kind === "snippet" && currentSnippet) {
    const s = currentSnippet;
    const name = s.name || w.untitled;
    sheetTitle = w.editorHeading(name);
    body = (
      <div className="grid min-w-0 gap-4" key={s.id}>
        <SnippetFields snippet={s} uid={uid} onPatch={(p) => edit((d) => void (d.snippets = d.snippets.map((x) => (x.id === s.id ? { ...x, ...p } : x))))} />
        <Disclosure summary={w.detailsSummary} meta={w.snippetKinds[s.kind]}>
          {removeButtons(name, () => edit((d) => void (d.snippets = d.snippets.filter((x) => x.id !== s.id))))}
        </Disclosure>
      </div>
    );
  }

  const dirtyDoc = !same(draft, view.settings);
  const bad = status === "conflict" || status === "failed";
  const statusText = status === "saving" ? a.saving : status === "conflict" ? a.conflict : status === "failed" ? a.saveFailed : "";

  const itemRow = (i: AnnounceLibraryItem) => {
    const name = i.name || w.untitled;
    const facts: Fact[] = [{ text: w.langShort[i.lang], label: a.langs[i.lang] }];
    if (i.default) facts.push({ icon: Star, text: w.defaultBadge });
    return (
      <RecordRow
        key={i.id}
        as="li"
        icon={<ChannelMark channel={i.channel} label={a.channels[i.channel]} />}
        title={name}
        facts={facts as [Fact?, Fact?]}
        openLabel={w.openRow(name, a.channels[i.channel])}
        onOpen={() => open({ kind: "item", id: i.id })}
      />
    );
  };

  return (
    <div className={styles.root}>
      <FilterChips defs={defs} value={filters} onChange={onFilters} common={["channel", "lang", "kind"]} />

      <section className={styles.group} aria-labelledby={`${uid}-t`}>
        <div className={styles.head}>
          <h2 id={`${uid}-t`} className={styles.title}>{w.templatesHeading}</h2>
          <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={draft.library.length >= LIBRARY_MAX} onClick={() => addItem()}>{w.newTemplate}</button>
        </div>
        {items.length === 0 ? (
          <p className={styles.help}>{draft.library.length === 0 ? w.noTemplates : w.nothingMatches}</p>
        ) : (
          <ul className={styles.list}>{items.map(itemRow)}</ul>
        )}
        {draft.library.length >= LIBRARY_MAX && <p className={styles.help}>{w.limitReached(LIBRARY_MAX)}</p>}
        {draft.library.length === 0 && starter.added > 0 && (
          <button type="button" className="a-btn min-h-[44px]" onClick={addStarter}>{w.starterAdd}</button>
        )}
      </section>

      <section className={styles.group} aria-labelledby={`${uid}-b`}>
        <h2 id={`${uid}-b`} className={styles.title}>{w.builtinHeading}</h2>
        {builtins.length === 0 ? (
          <p className={styles.help}>{w.nothingMatches}</p>
        ) : (
          <ul className={styles.list}>
            {builtins.map(({ l, c }) => {
              const own = draft.templates[l][c] !== undefined;
              return (
                <RecordRow
                  key={`${l}-${c}`}
                  as="li"
                  icon={<ChannelMark channel={c} label={a.channels[c]} />}
                  title={a.channels[c]}
                  facts={[{ text: w.langShort[l], label: a.langs[l] }]}
                  status={own ? <span className={styles.dot} role="img" aria-label={w.customised} /> : undefined}
                  openLabel={w.open(`${a.channels[c]}, ${a.langs[l]}`)}
                  onOpen={() => open({ kind: "builtin", lang: l, channel: c })}
                />
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.group} aria-labelledby={`${uid}-s`}>
        <div className={styles.head}>
          <h2 id={`${uid}-s`} className={styles.title}>{w.snippetsHeading}</h2>
          <button type="button" className="a-btn min-h-[44px]" disabled={draft.snippets.length >= SNIPPET_MAX} onClick={addSnippet}>{w.newSnippet}</button>
        </div>
        {snippets.length === 0 ? (
          <p className={styles.help}>{draft.snippets.length === 0 ? w.noSnippets : w.nothingMatches}</p>
        ) : (
          <ul className={styles.list}>
            {snippets.map((s) => {
              const name = s.name || w.untitled;
              const Icon = KIND_ICON[s.kind];
              return (
                <RecordRow
                  key={s.id}
                  as="li"
                  icon={Icon}
                  title={name}
                  facts={[{ text: w.snippetKinds[s.kind] }]}
                  openLabel={w.openRow(name, w.snippetKinds[s.kind])}
                  onOpen={() => open({ kind: "snippet", id: s.id })}
                />
              );
            })}
          </ul>
        )}
        {draft.snippets.length >= SNIPPET_MAX && <p className={styles.help}>{w.snippetLimit(SNIPPET_MAX)}</p>}
      </section>

      <Disclosure summary={w.moreSummary} meta={w.moreMeta}>
        <div className={styles.more}>
          <p className={styles.help}>{w.intro}</p>
          <p className={styles.help}>{w.templatesHint}</p>
          <p className={styles.help}>{w.builtinHint}</p>
          <p className={styles.help}>{w.snippetsHint}</p>
          <p className={styles.help} id={`${uid}-sh`}>{w.starterHint}</p>
          <div className={styles.foot}>
            <button type="button" className="a-btn min-h-[44px]" aria-describedby={`${uid}-sh`} disabled={starter.added === 0} onClick={addStarter}>{w.starterAdd}</button>
            <span role="status" className="text-sm font-bold">{starterMsg || (starter.added === 0 ? w.starterNone : "")}</span>
          </div>
        </div>
      </Disclosure>

      <BottomSheet
        open={target !== null && body !== null}
        onClose={requestClose}
        title={sheetTitle}
        snap="full"
        footer={
          <div className={styles.foot}>
            <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={!dirtyDoc || status === "saving"} onClick={() => (setClosing(true), void doc.save(draft))}>{w.save}</button>
            <span role="status" className={bad ? styles.bad : "text-sm text-clay"}>{statusText}</span>
          </div>
        }
      >
        <div className={styles.sheetBody}>
          {ask && (
            <div className={styles.guard} role="alertdialog" aria-labelledby={`${uid}-gt`} aria-describedby={`${uid}-gb`}>
              <p id={`${uid}-gt`} className="font-bold">{w.guardTitle}</p>
              <p id={`${uid}-gb`} className={styles.help}>{w.guardBody}</p>
              <div className={styles.guardActions}>
                <button ref={keepRef} type="button" className="a-btn a-btn-primary min-h-[44px]" onClick={() => setAsk(false)}>{w.guardKeep}</button>
                <button type="button" className="a-btn min-h-[44px]" onClick={discard}>{w.guardDiscard}</button>
              </div>
            </div>
          )}
          {body}
          {issues.length > 0 && (
            <div role="alert">
              <p className="a-error">{a.invalid}</p>
              <ul className="list-disc ps-5">
                {issues.map((i) => <li key={i.path + i.message} className="a-error mt-0">{i.path ? `${i.path}: ` : ""}{i.message}</li>)}
              </ul>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
