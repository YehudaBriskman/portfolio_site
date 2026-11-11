import { useId, useState } from "react";
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
}: {
  value: EditorValue;
  onChange: (v: EditorValue) => void;
  onClose: () => void;
  snippets: AnnounceSnippet[];
  events: AnnounceSummary[];
  hashtags: string[];
  /** For a built-in: its default text and whether the text now differs from it. */
  builtin?: { defaultText: string; onReset: () => void };
}) {
  const w = useLibraryWords();
  const a = useAnnounceWords();
  const id = useId();
  const [choice, setChoice] = useState(BUILTIN);
  const { sample, state } = useSample(choice, events, value.lang, hashtags);
  const isDefault = builtin ? value.text === builtin.defaultText : false;
  const title = value.name ?? `${a.channels[value.channel]}, ${a.langs[value.lang]}`;

  return (
    <section className="a-box" aria-labelledby={`${id}-h`}>
      <div className="a-box-head flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-h`} className="a-box-title">{w.editorHeading(title)}</h3>
        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={onClose}>{w.close}</button>
      </div>
      <div className="grid gap-6 p-4 lg:grid-cols-2">
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
