import { useId } from "react";
import { ANNOUNCE_SNIPPET_KINDS, type AnnounceSnippet, type AnnounceSnippetKind } from "@/services/adminAnnounce";
import { newId } from "./variables";
import { useLibraryWords } from "./words";

export const SNIPPET_MAX = 50;
const TEXT_MAX = 1000;

/* Reusable pieces of text. The templates insert them; nothing here is sent anywhere. */
export default function SnippetsEditor({ snippets, onChange }: { snippets: AnnounceSnippet[]; onChange: (next: AnnounceSnippet[]) => void }) {
  const w = useLibraryWords();
  const uid = useId();
  const patch = (id: string, p: Partial<AnnounceSnippet>) => onChange(snippets.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const full = snippets.length >= SNIPPET_MAX;

  return (
    <section aria-labelledby={`${uid}-h`} className="space-y-3">
      <div>
        <h3 id={`${uid}-h`} className="display-tight text-lg">{w.snippetsHeading}</h3>
        <p className="a-hint !mt-0">{w.snippetsHint}</p>
      </div>
      {snippets.length === 0 && <p className="a-hint">{w.noSnippets}</p>}
      <ul className="space-y-3">
        {snippets.map((s) => (
          <li key={s.id} className="a-box">
            <div className="grid gap-3 p-4 sm:grid-cols-[1fr_12rem]">
              <div>
                <label className="a-label" htmlFor={`${uid}-n-${s.id}`}>{w.snippetName}</label>
                <input id={`${uid}-n-${s.id}`} className="a-input" dir="auto" maxLength={60} value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} autoComplete="off" />
              </div>
              <div>
                <label className="a-label" htmlFor={`${uid}-k-${s.id}`}>{w.snippetKind}</label>
                <select id={`${uid}-k-${s.id}`} className="a-select min-h-[44px] w-full" value={s.kind} onChange={(e) => patch(s.id, { kind: e.target.value as AnnounceSnippetKind })}>
                  {ANNOUNCE_SNIPPET_KINDS.map((k) => <option key={k} value={k}>{w.snippetKinds[k]}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="a-label" htmlFor={`${uid}-t-${s.id}`}>{w.snippetText}</label>
                <textarea id={`${uid}-t-${s.id}`} className="a-textarea" rows={3} maxLength={TEXT_MAX} dir="auto" value={s.text} onChange={(e) => patch(s.id, { text: e.target.value })} />
                <p className="a-hint tabular-nums">{w.textMax(s.text.length, TEXT_MAX)}</p>
              </div>
              <div className="sm:col-span-2">
                <button type="button" className="a-btn a-btn-ghost min-h-[44px]" aria-label={w.remove(s.name || w.untitled)} onClick={() => onChange(snippets.filter((x) => x.id !== s.id))}>
                  {w.remove(s.name || w.untitled)}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="a-btn min-h-[44px]" disabled={full} onClick={() => onChange([...snippets, { id: newId("s"), name: w.newSnippet, kind: "hashtags", text: "" }])}>
          {w.newSnippet}
        </button>
        {full && <span className="a-hint !mt-0">{w.snippetLimit(SNIPPET_MAX)}</span>}
      </div>
    </section>
  );
}
