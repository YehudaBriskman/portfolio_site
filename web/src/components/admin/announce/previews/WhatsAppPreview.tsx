import { previewWhatsApp, type LinkMeta } from "@/lib/share/preview";
import { Approx, CardBox, Surface } from "./parts";
import { usePreviewWords } from "./words";

export default function WhatsAppPreview({ text, ...meta }: { text: string } & LinkMeta) {
  const w = usePreviewWords();
  const p = previewWhatsApp(text, meta);
  return (
    <div className="pv">
      <Approx />
      <Surface label={w.postOf(w.whatsapp)}>
        <div className="pv-wa">
          {text.trim() === "" ? (
            <p className="pv-hint">{w.empty}</p>
          ) : (
            <div className="pv-wa-bubble">
              {p.card && <CardBox card={p.card} label={w.whatsapp} lang={meta.locale} />}
              <div className="pv-body">
                {p.lines.map((segs, i) => (
                  <p key={i} className="pv-line" dir="auto">
                    {segs.map((s, j) =>
                      s.type === "link" ? (
                        <span key={j} className="pv-link">{s.text}</span>
                      ) : s.type === "bold" ? (
                        <strong key={j}>{s.text}</strong>
                      ) : s.type === "italic" ? (
                        <em key={j}>{s.text}</em>
                      ) : s.type === "strike" ? (
                        <s key={j}>{s.text}</s>
                      ) : (
                        <span key={j}>{s.text}</span>
                      ),
                    )}
                  </p>
                ))}
              </div>
              <span className="pv-wa-time">{w.now}</span>
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}
