import { useState } from "react";
import { featured, rest, type Project } from "@/data/projects";

function Shot({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative aspect-[16/10] overflow-hidden border border-edge bg-surface">
      {!loaded && <div className="absolute inset-0 animate-pulse-soft bg-surface" />}
      <img
        src={`/projects/${src}`}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover object-top transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.02] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bitumen/60 to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-25" />
    </div>
  );
}

/* Not every project is a screenshot. A console tool is better shown as what it
   claims — so its panel carries the claims themselves. */
function Plate({ p }: { p: Project }) {
  return (
    <div className="relative flex aspect-[16/10] flex-col justify-between overflow-hidden border border-edge bg-surface p-7">
      <div className="mono text-[0.6875rem] uppercase tracking-[0.2em] text-clay/60">
        {p.status}
      </div>
      <p className="display-tight max-w-sm text-2xl leading-tight text-bone">{p.tagline}</p>
      <ul className="space-y-2">
        {p.highlights.slice(0, 3).map((h) => (
          <li key={h} className="flex gap-3 text-[0.8125rem] leading-snug text-clay">
            <span className="mt-[0.45rem] h-px w-4 shrink-0 bg-sodium" aria-hidden="true" />
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Featured({ p, flip }: { p: Project; flip: boolean }) {
  return (
    <article className={`group grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${flip ? "lg:[&>figure]:order-2" : ""}`}>
      <figure className="m-0">
        {p.link ? (
          <a href={p.link} target="_blank" rel="noreferrer noopener" aria-label={`Open ${p.title}`} className="block">
            {p.image ? <Shot src={p.image} alt={`${p.title} — screenshot`} /> : <Plate p={p} />}
          </a>
        ) : p.image ? (
          <Shot src={p.image} alt={`${p.title} — screenshot`} />
        ) : (
          <Plate p={p} />
        )}
      </figure>

      <div>
        <div className="mono flex items-center gap-3 text-[0.6875rem] uppercase tracking-[0.2em] text-clay/70">
          <span>{p.year}</span>
          <span className="h-px w-6 bg-edge" aria-hidden="true" />
          <span className="text-sodium">{p.status}</span>
        </div>
        <h3 className="display-tight mt-4 text-3xl text-bone sm:text-4xl">{p.title}</h3>
        <p className="mt-3 text-lg text-clay">{p.tagline}</p>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-clay/85">{p.description}</p>

        {p.image && p.highlights.length > 0 && (
          <ul className="mt-6 space-y-2">
            {p.highlights.map((h) => (
              <li key={h} className="flex gap-3 text-[0.8125rem] leading-snug text-clay">
                <span className="mt-[0.45rem] h-px w-4 shrink-0 bg-sodium" aria-hidden="true" />
                {h}
              </li>
            ))}
          </ul>
        )}

        <ul className="mono mt-7 flex flex-wrap gap-x-4 gap-y-2 text-[0.6875rem] uppercase tracking-[0.16em] text-clay/70">
          {p.tech.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-6">
          {p.link && (
            <a
              href={p.link}
              target="_blank"
              rel="noreferrer noopener"
              className="mono inline-flex items-center gap-2 border-b border-sodium/40 pb-1 text-xs uppercase tracking-[0.2em] text-sodium transition-colors hover:border-sodium"
            >
              Visit <span aria-hidden="true">→</span>
            </a>
          )}
          {p.github && p.github !== p.link && (
            <a
              href={p.github}
              target="_blank"
              rel="noreferrer noopener"
              className="mono inline-flex items-center gap-2 border-b border-edge pb-1 text-xs uppercase tracking-[0.2em] text-clay transition-colors hover:border-clay hover:text-bone"
            >
              Source <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Work() {
  return (
    <section id="work" className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <p className="eyebrow">{featured.length} in active development</p>
      <h2 className="display-tight mt-5 text-section">Work</h2>

      <div className="mt-16 space-y-28">
        {featured.map((p, i) => (
          <Featured key={p.title} p={p} flip={i % 2 === 1} />
        ))}
      </div>

      <div className="mt-28">
        <p className="eyebrow">Earlier — {rest.length} shipped</p>
        <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2">
          {rest.map((p) => (
            <a
              key={p.title}
              href={p.link}
              target="_blank"
              rel="noreferrer noopener"
              className="group block"
            >
              {p.image && <Shot src={p.image} alt={`${p.title} — screenshot`} />}
              <div className="mt-4 flex items-baseline justify-between gap-4">
                <h3 className="display-tight text-lg text-bone">{p.title}</h3>
                <span className="mono text-[0.6875rem] text-clay/60">{p.year}</span>
              </div>
              <p className="mt-1 text-sm text-clay">{p.tagline}</p>
              <ul className="mono mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.625rem] uppercase tracking-[0.14em] text-clay/60">
                {p.tech.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
