import { useId } from "react";
import type { Block, BlockType } from "@/services/adminCampaigns";
import { blockProblem } from "./mailPreview";
import { useCampaignWords } from "./words";

const TYPES: BlockType[] = ["p", "h2", "ul", "cta", "image"];
const fresh = (t: BlockType): Block =>
  t === "ul" ? { type: "ul", items: [""] } : t === "cta" ? { type: "cta", url: "", label: "" } : t === "image" ? { type: "image", url: "", text: "" } : { type: t, text: "" };

/* The optional structured body. Every field is plain text; the server renders and escapes the markup. */
export default function BlocksEditor({ blocks, onChange }: { blocks: Block[]; onChange: (b: Block[]) => void }) {
  const w = useCampaignWords();
  const uid = useId();
  const set = (i: number, b: Block) => onChange(blocks.map((x, j) => (j === i ? b : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {blocks.length === 0 && <p className="a-hint !mt-0">{w.noBlocks}</p>}
      <ol className="space-y-3">
        {blocks.map((b, i) => {
          const id = `${uid}-${i}`;
          const problem = blockProblem(b);
          return (
            <li key={i} className="a-box space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{w.blockLabelOf(i + 1, w.blockTypes[b.type])}</p>
                <div className="flex gap-1">
                  <button type="button" className="a-btn a-btn-ghost min-h-[44px] min-w-[44px]" disabled={i === 0} aria-label={w.blockUp(i + 1)} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="a-btn a-btn-ghost min-h-[44px] min-w-[44px]" disabled={i === blocks.length - 1} aria-label={w.blockDown(i + 1)} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="a-btn a-btn-ghost min-h-[44px] min-w-[44px]" aria-label={w.blockRemove(i + 1)} onClick={() => onChange(blocks.filter((_, j) => j !== i))}>✕</button>
                </div>
              </div>
              {(b.type === "p" || b.type === "h2") && (
                <div>
                  <label className="a-label" htmlFor={id}>{w.blockText}</label>
                  {b.type === "p" ? (
                    <textarea id={id} className="a-textarea" rows={3} dir="auto" maxLength={5000} value={b.text} onChange={(e) => set(i, { ...b, text: e.target.value })} />
                  ) : (
                    <input id={id} className="a-input min-h-[44px]" dir="auto" maxLength={300} value={b.text} onChange={(e) => set(i, { ...b, text: e.target.value })} />
                  )}
                </div>
              )}
              {b.type === "ul" && (
                <div>
                  <label className="a-label" htmlFor={id}>{w.blockItems}</label>
                  <textarea id={id} className="a-textarea" rows={4} dir="auto" value={b.items.join("\n")} onChange={(e) => set(i, { ...b, items: e.target.value.split("\n") })} />
                </div>
              )}
              {b.type === "cta" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="a-label" htmlFor={id}>{w.blockLabel}</label>
                    <input id={id} className="a-input min-h-[44px]" dir="auto" maxLength={100} value={b.label} onChange={(e) => set(i, { ...b, label: e.target.value })} />
                  </div>
                  <div>
                    <label className="a-label" htmlFor={`${id}-u`}>{w.blockUrl}</label>
                    <input id={`${id}-u`} type="url" inputMode="url" className="a-input min-h-[44px]" dir="ltr" autoComplete="off" value={b.url} onChange={(e) => set(i, { ...b, url: e.target.value })} />
                  </div>
                </div>
              )}
              {b.type === "image" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="a-label" htmlFor={id}>{w.blockImageUrl}</label>
                    <input id={id} type="url" inputMode="url" className="a-input min-h-[44px]" dir="ltr" autoComplete="off" value={b.url} onChange={(e) => set(i, { ...b, url: e.target.value })} />
                  </div>
                  <div>
                    <label className="a-label" htmlFor={`${id}-a`}>{w.blockAlt}</label>
                    <input id={`${id}-a`} className="a-input min-h-[44px]" dir="auto" maxLength={300} value={b.text ?? ""} onChange={(e) => set(i, { ...b, text: e.target.value })} />
                  </div>
                </div>
              )}
              {problem && (
                <p className="a-error !mt-0" role="status">
                  {problem === "empty" ? w.blockEmpty : problem === "link" ? w.blockLinkBad : w.blockImageBad}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{w.addBlock}</span>
        {TYPES.map((t) => (
          <button key={t} type="button" className="a-btn min-h-[44px]" onClick={() => onChange([...blocks, fresh(t)])}>
            + {w.blockTypes[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
