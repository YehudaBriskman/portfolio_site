import { useState } from "react";
import { projects } from "@/data/projects";

function Shot({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative aspect-[16/10] overflow-hidden border border-edge bg-surface">
      {!loaded && <div className="absolute inset-0 animate-pulse-soft bg-surface" />}
      <img
        src={`/api/images/${src}`}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover object-top transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.02] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bitumen/70 to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-30" />
    </div>
  );
}

export default function Work() {
  return (
    <section id="work" className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <p className="eyebrow">{projects.length} shipped</p>
      <h2 className="display-tight mt-5 text-section">Work</h2>

      <div className="mt-16 space-y-24">
        {projects.map((p, i) => (
          <article
            key={p.title}
            className={`group grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${
              i % 2 ? "lg:[&>figure]:order-2" : ""
            }`}
          >
            <figure className="m-0">
              <a
                href={p.link}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`Open ${p.title} in a new tab`}
                className="block"
              >
                <Shot src={p.image} alt={`${p.title} — screenshot`} />
              </a>
            </figure>

            <div>
              <h3 className="display-tight text-2xl text-bone sm:text-3xl">{p.title}</h3>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-clay sm:text-base">
                {p.description}
              </p>
              <ul className="mono mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[0.6875rem] uppercase tracking-[0.18em] text-clay/80">
                {p.tech.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <a
                href={p.link}
                target="_blank"
                rel="noreferrer noopener"
                className="mono mt-8 inline-flex items-center gap-2 border-b border-sodium/40 pb-1 text-xs uppercase tracking-[0.22em] text-sodium transition-colors hover:border-sodium"
              >
                Visit site
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
