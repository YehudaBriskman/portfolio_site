import { useState, type ReactNode } from "react";
import type { LinkCard } from "@/lib/share/preview";
import { safeSrc } from "@/lib/share/preview";
import { usePreviewWords } from "./words";
import "./previews.css";

export function Approx() {
  const w = usePreviewWords();
  return (
    <p className="pv-approx">
      <span className="pv-badge">{w.approxBadge}</span>
      {w.approximate}
    </p>
  );
}

/** Text as one paragraph per line, each with its own direction. Never HTML. */
export function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className="pv-line" dir="auto">
          {line}
        </p>
      ))}
    </>
  );
}

export function Meter({ count, limit, over }: { count: number; limit: number; over: boolean }) {
  const w = usePreviewWords();
  return (
    <p className="pv-meter" data-over={over}>
      {w.count(count, limit)}
      {over && <> · {w.over(count - limit)}</>}
    </p>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: NoInfer<T>) => void;
}) {
  return (
    <div className="pv-seg" role="group" aria-label={label}>
      <span className="pv-seg-label" aria-hidden="true">
        {label}
      </span>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className="pv-btn" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CardBox({ card, label, lang }: { card: LinkCard; label: string; lang?: "en" | "he" }) {
  const w = usePreviewWords();
  const [broken, setBroken] = useState(false);
  const src = safeSrc(card.image);
  return (
    <figure className="pv-card" aria-label={w.linkCard(label)} dir={lang === "he" ? "rtl" : lang === "en" ? "ltr" : undefined}>
      <div className="pv-card-img">
        {src && !broken ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} /> : <span>{w.noImage}</span>}
      </div>
      <figcaption className="pv-card-text">
        {card.title ? (
          <span className="pv-card-title" dir="auto">
            {card.title}
          </span>
        ) : (
          <span className="pv-card-title">{w.noTitle}</span>
        )}
        {card.domain && <span className="pv-card-domain">{card.domain}</span>}
      </figcaption>
    </figure>
  );
}

export function Surface({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="pv-surface" aria-label={label}>
      {children}
    </section>
  );
}
