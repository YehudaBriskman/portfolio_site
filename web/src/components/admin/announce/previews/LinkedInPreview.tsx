import { useState } from "react";
import { previewLinkedIn, type LinkMeta } from "@/lib/share/preview";
import { Approx, CardBox, Lines, Meter, Surface } from "./parts";
import { usePreviewWords } from "./words";

/* The fold is approximate (see lib/share/preview/constants.ts); the text is shown as text. */
export default function LinkedInPreview({ text, name, ...meta }: { text: string; name?: string } & LinkMeta) {
  const w = usePreviewWords();
  const [open, setOpen] = useState(false);
  const p = previewLinkedIn(text, meta);
  return (
    <div className="pv">
      <Approx />
      <Surface label={w.postOf(w.linkedin)}>
        <div className="pv-head">
          <span className="pv-avatar" aria-hidden="true" />
          <span>
            <span className="pv-name" dir="auto">{name || w.you}</span>
            <span className="pv-sub">{w.now}</span>
          </span>
        </div>
        {text.trim() === "" ? (
          <p className="pv-hint">{w.empty}</p>
        ) : (
          <div className="pv-body">
            <Lines text={open || !p.folded ? text : p.visible} />
            {p.folded && !open && (
              <button type="button" className="pv-link-btn" aria-expanded={false} onClick={() => setOpen(true)}>
                {w.seeMore}
              </button>
            )}
            {p.folded && open && (
              <button type="button" className="pv-link-btn" aria-expanded onClick={() => setOpen(false)}>
                {w.seeLess}
              </button>
            )}
          </div>
        )}
        {p.card && (
          <div style={{ marginBlockStart: ".5rem" }}>
            <CardBox card={p.card} label={w.linkedin} lang={meta.locale} />
          </div>
        )}
      </Surface>
      <Meter count={p.count} limit={p.limit} over={p.over} />
      <p className="pv-hint">{p.folded ? w.foldedAt(p.foldAt) : w.noFold}</p>
    </div>
  );
}
