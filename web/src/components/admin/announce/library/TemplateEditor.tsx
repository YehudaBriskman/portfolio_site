import { useId, useState, type ReactNode } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import { Switch } from "@/components/ui/Switch";
import { ANNOUNCE_CHANNELS, type AnnounceChannel, type AnnounceLang, type AnnounceSnippet, type AnnounceSummary } from "@/services/adminAnnounce";
import { useAnnounceWords } from "../words";
import LivePreview from "./LivePreview";
import TemplateText from "./TemplateText";
import { BUILTIN, useSample } from "./useSample";
import { OWNER_VARS } from "./variables";
import { useLibraryWords } from "./words";

export const TEXT_MAX = 2000;

/*
 * One template being edited, with its live preview beside it. It edits a
 * library item (name, channel, language, text) or a built-in override (text
 * only, with Reset to default). It owns no data: the panel passes the value
 * in and takes every change back.
 */
export type EditorValue = { name?: string; channel: AnnounceChannel; lang: AnnounceLang; text: string };

export default function TemplateEditor({
  value,
  onChange,
  onClose,
  snippets,
  events,
  hashtags,
  builtin,
  defaults,
  phone,
  actions,
}: {
  value: EditorValue;
  onChange: (v: EditorValue) => void;
  onClose: () => void;
  snippets: AnnounceSnippet[];
  events: AnnounceSummary[];
  hashtags: string[];
  /** For a built-in: its default text and whether the text now differs from it. */
  builtin?: { defaultText: string; onReset: () => void };
  /** For a library template: whether it is the default for its channel and language, and who is. */
  defaults?: { on: boolean; current?: string; onChange: (on: boolean) => void };
  /** In a phone sheet: the sheet owns the title and Close, and the order follows importance. */
  phone?: boolean;
  /** Phone only: Duplicate and Delete, kept behind the details disclosure. */
  actions?: ReactNode;
}) {
  const w = useLibraryWords();
  const a = useAnnounceWords();
  const id = useId();
  const [choice, setChoice] = useState(BUILTIN);
  const { sample, state } = useSample(choice, events, value.lang, hashtags);
  const isDefault = builtin ? value.text === builtin.defaultText : false;
  const title = value.name ?? `${a.channels[value.channel]}, ${a.langs[value.lang]}`;

  if (phone) {
    const sampleSelect = (
      <div>
        <label className="a-label" htmlFor={`${id}-s`}>{w.previewWith}</label>
        <select id={`${id}-s`} className="a-select min-h-[44px] w-full" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value={BUILTIN}>{w.sampleEvent}</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <p className="a-hint" role="status">{state === "loading" ? w.sampleLoading : state === "failed" ? w.sampleFailed : w.previewHint}</p>
      </div>
    );
    return (
      <div className="min-w-0 space-y-4" data-testid="template-editor-phone">
        {value.name !== undefined && (
          <div>
            <label className="a-label" htmlFor={`${id}-n`}>{w.name}</label>
            <input id={`${id}-n`} className="a-input" dir="auto" maxLength={60} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} autoComplete="off" />
          </div>
        )}
        <TemplateText label={w.text} value={value.text} onChange={(text) => onChange({ ...value, text })} lang={value.lang} vars={OWNER_VARS} snippets={snippets} max={TEXT_MAX} hideHint />
        {builtin && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="a-btn min-h-[44px]" disabled={isDefault} onClick={builtin.onReset}>{w.resetDefault}</button>
            <span className="text-sm text-clay" role="status">{isDefault ? w.usingDefault : w.customised}</span>
          </div>
        )}
        <div className="min-w-0 space-y-2">
          <h4 className="a-label !mb-0">{w.previewHeading}</h4>
          <LivePreview text={value.text} channel={value.channel} lang={value.lang} sample={sample} />
        </div>
        {defaults && (
          <Switch
            label={w.useDefault(a.channels[value.channel], a.langs[value.lang])}
            hint={defaults.current ? w.currentDefault(defaults.current) : w.noDefault}
            checked={defaults.on}
            onChange={defaults.onChange}
          />
        )}
        <Disclosure summary={w.detailsSummary} meta={`${a.channels[value.channel]}, ${a.langs[value.lang]}`}>
          <div className="min-w-0 space-y-4">
            {value.name !== undefined && (
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="a-label" htmlFor={`${id}-c`}>{w.channel}</label>
                  <select id={`${id}-c`} className="a-select min-h-[44px] w-full" value={value.channel} onChange={(e) => onChange({ ...value, channel: e.target.value as AnnounceChannel })}>
                    {ANNOUNCE_CHANNELS.map((c) => <option key={c} value={c}>{a.channels[c]}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="a-label" htmlFor={`${id}-l`}>{w.language}</label>
                  <select id={`${id}-l`} className="a-select min-h-[44px] w-full" value={value.lang} onChange={(e) => onChange({ ...value, lang: e.target.value as AnnounceLang })}>
                    {(["en", "he"] as const).map((l) => <option key={l} value={l}>{a.langs[l]}</option>)}
                  </select>
                </div>
              </div>
            )}
            {sampleSelect}
            {actions}
          </div>
        </Disclosure>
      </div>
    );
  }

  return (
    <section className="a-box" aria-labelledby={`${id}-h`}>
      <div className="a-box-head flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-h`} className="a-box-title">{w.editorHeading(title)}</h3>
        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={onClose}>{w.close}</button>
      </div>
      <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          {value.name !== undefined && (
            <>
              <div>
                <label className="a-label" htmlFor={`${id}-n`}>{w.name}</label>
                <input id={`${id}-n`} className="a-input" dir="auto" maxLength={60} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} autoComplete="off" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="a-label" htmlFor={`${id}-c`}>{w.channel}</label>
                  <select id={`${id}-c`} className="a-select min-h-[44px] w-full" value={value.channel} onChange={(e) => onChange({ ...value, channel: e.target.value as AnnounceChannel })}>
                    {ANNOUNCE_CHANNELS.map((c) => <option key={c} value={c}>{a.channels[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="a-label" htmlFor={`${id}-l`}>{w.language}</label>
                  <select id={`${id}-l`} className="a-select min-h-[44px] w-full" value={value.lang} onChange={(e) => onChange({ ...value, lang: e.target.value as AnnounceLang })}>
                    {(["en", "he"] as const).map((l) => <option key={l} value={l}>{a.langs[l]}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
          {defaults && (
            <div>
              <label className="flex min-h-[44px] items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={defaults.on} aria-describedby={`${id}-dh`} onChange={(e) => defaults.onChange(e.target.checked)} />
                <span>{w.useDefault(a.channels[value.channel], a.langs[value.lang])}</span>
              </label>
              <p id={`${id}-dh`} className="a-hint !mt-0 ps-8">
                {w.defaultHint} {defaults.current ? w.currentDefault(defaults.current) : w.noDefault}
              </p>
            </div>
          )}
          <TemplateText label={w.text} value={value.text} onChange={(text) => onChange({ ...value, text })} lang={value.lang} vars={OWNER_VARS} snippets={snippets} max={TEXT_MAX} />
          {builtin && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="a-btn min-h-[44px]" disabled={isDefault} onClick={builtin.onReset}>{w.resetDefault}</button>
              <span className="text-sm text-clay" role="status">{isDefault ? w.usingDefault : w.customised}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <h4 className="a-label !mb-0">{w.previewHeading}</h4>
          <div>
            <label className="a-label" htmlFor={`${id}-s`}>{w.previewWith}</label>
            <select id={`${id}-s`} className="a-select min-h-[44px] w-full" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value={BUILTIN}>{w.sampleEvent}</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <p className="a-hint" role="status">{state === "loading" ? w.sampleLoading : state === "failed" ? w.sampleFailed : w.previewHint}</p>
          </div>
          <LivePreview text={value.text} channel={value.channel} lang={value.lang} sample={sample} />
        </div>
      </div>
    </section>
  );
}
