import { useState } from "react";
import type { CardFormat } from "@/lib/share/types";
import { cardSrc } from "@/lib/share/preview";
import { Approx, Segmented } from "./parts";
import { usePreviewWords } from "./words";

const FORMATS: CardFormat[] = ["og", "square", "story"];

export default function CardPreview({
  kind,
  file,
  lang,
  origin = "",
  formats = FORMATS,
  initial = "og",
}: {
  kind: string;
  file: string;
  lang: "en" | "he";
  origin?: string;
  formats?: CardFormat[];
  initial?: CardFormat;
}) {
  const w = usePreviewWords();
  const [format, setFormat] = useState<CardFormat>(formats.includes(initial) ? initial : formats[0]);
  const [attempt, setAttempt] = useState(0);
  const src = cardSrc(origin, kind, file, format, lang);
  const key = `${src}#${attempt}`;
  const [state, setState] = useState<{ key: string; s: "ok" | "error" } | null>(null);
  const s = state?.key === key ? state.s : "loading";
  return (
    <div className="pv" aria-busy={s === "loading"}>
      <Approx />
      <Segmented
        label={w.cardFormat}
        value={format}
        onChange={setFormat}
        options={formats.map((f) => ({ value: f, label: w.formats[f] }))}
      />
      <div className="pv-cardimg" data-format={format}>
        {s === "error" ? (
          <span role="alert">{w.cardFailed}</span>
        ) : (
          <img
            key={key}
            src={src}
            alt={w.cardAlt(w.formats[format])}
            onLoad={() => setState({ key, s: "ok" })}
            onError={() => setState({ key, s: "error" })}
          />
        )}
      </div>
      {s === "loading" && <p role="status" className="pv-hint">{w.cardLoading}</p>}
      {s === "error" && (
        <button type="button" className="pv-btn" onClick={() => setAttempt((n) => n + 1)}>
          {w.cardRetry}
        </button>
      )}
      <p className="pv-hint">{w.cardSize[format]}</p>
    </div>
  );
}
