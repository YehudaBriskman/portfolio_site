import { previewX, type LinkMeta } from "@/lib/share/preview";
import { Approx, CardBox, Lines, Meter, Surface } from "./parts";
import { usePreviewWords } from "./words";

export default function XPreview({ text, name, ...meta }: { text: string; name?: string } & LinkMeta) {
  const w = usePreviewWords();
  const p = previewX(text, meta);
  return (
    <div className="pv">
      <Approx />
      <Surface label={w.postOf(w.x)}>
        <div className="pv-head">
          <span className="pv-avatar" aria-hidden="true" />
          <span>
            <span className="pv-name" dir="auto">{name || w.you}</span>
            <span className="pv-sub">{w.handle}</span>
          </span>
        </div>
        {text.trim() === "" ? (
          <p className="pv-hint">{w.empty}</p>
        ) : (
          <div className="pv-body">
            <Lines text={text} />
          </div>
        )}
        {p.card && (
          <div style={{ marginBlockStart: ".5rem" }}>
            <CardBox card={p.card} label={w.x} lang={meta.locale} />
          </div>
        )}
      </Surface>
      <Meter count={p.count} limit={p.limit} over={p.over} />
      <p className="pv-hint">{w.linkCounted}</p>
      {p.over && p.thread.length > 1 && (
        <section aria-label={w.threadHeading}>
          <p className="pv-meter">
            <strong>{w.threadHeading}</strong> · {w.threadCount(p.thread.length)}
          </p>
          <p className="pv-hint">{w.threadHint}</p>
          <ol className="pv-thread">
            {p.thread.map((t, i) => (
              <li key={i}>
                <span className="pv-thread-n">{w.threadPost(i + 1, p.thread.length)}</span>
                <div className="pv-body">
                  <Lines text={t} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
