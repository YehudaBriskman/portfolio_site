import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Scenery from "@/components/scene/Scenery";
import { blog, type Collection } from "@/services/blog";

export default function Projects() {
  const [cols, setCols] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    blog
      .collections()
      .then((c) => setCols(c.filter((x) => x.kind === "project")))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  return (
    <PageShell>
      <section className="isolate relative mx-auto max-w-6xl px-6 pb-28 pt-40 sm:pb-36">
        <Scenery variant="ridge" />
        <p className="eyebrow">Projects</p>
        <h1 className="display-tight mt-5 text-section">What I&rsquo;m building</h1>

        {error && <p className="mt-10 text-sm text-bone/70">{error}</p>}
        {!error && cols === null && <p className="mono mt-10 text-xs text-bone/40">Loading…</p>}
        {cols?.length === 0 && (
          <p className="mt-10 max-w-lg text-sm leading-relaxed text-bone/60">
            No project areas yet. Create one from the admin and it appears here.
          </p>
        )}

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {(cols ?? []).map((c) => (
            <Link
              key={c.slug}
              to={`/projects/${c.slug}`}
              className="group flex flex-col panel p-7 transition-colors hover:border-sodium/50"
            >
              {c.coverImage && (
                <img src={c.coverImage} alt="" loading="lazy" className="mb-5 h-36 w-full rounded-lg border border-edge object-cover" />
              )}
              <h2 className="display-tight text-2xl text-bone transition-colors group-hover:text-sodium">{c.title}</h2>
              {c.tagline && <p className="mt-2 text-base text-bone/70">{c.tagline}</p>}
              {c.description && <p className="mt-3 text-sm leading-relaxed text-bone/55">{c.description}</p>}
              <div className="mono mt-6 flex flex-wrap gap-x-5 gap-y-1 text-[0.625rem] uppercase tracking-[0.18em] text-bone/40">
                {c.stats?.language && <span>{c.stats.language}</span>}
                {c.stats?.license && <span>{c.stats.license}</span>}
                {typeof c.stats?.stars === "number" && <span>{c.stats.stars} stars</span>}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
