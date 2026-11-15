import { ANNOUNCE_SNIPPET_KINDS, type AnnounceSnippet, type AnnounceSnippetKind } from "@/services/adminAnnounce";
import { useLibraryWords } from "./words";

export const SNIPPET_MAX = 50;
const TEXT_MAX = 1000;

/*
 * One snippet's fields. The desktop side panel and the phone sheet both draw these,
 * so the two layouts edit the same thing and send the same payload.
 */
export function SnippetFields({ snippet: s, onPatch, uid }: { snippet: AnnounceSnippet; onPatch: (p: Partial<AnnounceSnippet>) => void; uid: string }) {
  const w = useLibraryWords();
  return (
    <>
      <div className="min-w-0">
        <label className="a-label" htmlFor={`${uid}-n-${s.id}`}>{w.snippetName}</label>
        <input id={`${uid}-n-${s.id}`} className="a-input" dir="auto" maxLength={60} value={s.name} onChange={(e) => onPatch({ name: e.target.value })} autoComplete="off" />
      </div>
      <div className="min-w-0">
        <label className="a-label" htmlFor={`${uid}-k-${s.id}`}>{w.snippetKind}</label>
        <select id={`${uid}-k-${s.id}`} className="a-select min-h-[44px] w-full" value={s.kind} onChange={(e) => onPatch({ kind: e.target.value as AnnounceSnippetKind })}>
          {ANNOUNCE_SNIPPET_KINDS.map((k) => <option key={k} value={k}>{w.snippetKinds[k]}</option>)}
        </select>
      </div>
      <div className="min-w-0 sm:col-span-2">
        <label className="a-label" htmlFor={`${uid}-t-${s.id}`}>{w.snippetText}</label>
        <textarea id={`${uid}-t-${s.id}`} className="a-textarea" rows={3} maxLength={TEXT_MAX} dir="auto" value={s.text} onChange={(e) => onPatch({ text: e.target.value })} />
        <p className="a-hint tabular-nums">{w.textMax(s.text.length, TEXT_MAX)}</p>
      </div>
    </>
  );
}
