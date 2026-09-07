import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Scenery from "@/components/scene/Scenery";
import { fetchPosts, formatDate, type PostSummary } from "@/services/blog";

export default function Blog() {
  const [params, setParams] = useSearchParams();
  const tag = params.get("tag") ?? undefined;
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPosts(null);
    setError(null);
    fetchPosts(tag)
      .then((p) => alive && setPosts(p))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Something went wrong"));
    return () => {
      alive = false;
    };
  }, [tag]);

  const allTags = [...new Set((posts ?? []).flatMap((p) => p.tags))];

  return (
    <PageShell>
      <section className="isolate relative mx-auto max-w-6xl px-6 pb-28 pt-40 sm:pb-36">
        <Scenery variant="shore" />
        <p className="eyebrow">Notes</p>
        <h1 className="display-tight mt-5 text-section">Writing</h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-bone/70 sm:text-base">
          Decisions I made and what they cost — mostly about making software prove
          it still works somewhere that isn&rsquo;t my laptop.
        </p>

        {tag && (
          <button
            onClick={() => setParams({})}
            className="mono mt-8 inline-flex items-center gap-2 border-b border-sodium/40 pb-1 text-xs uppercase tracking-[0.2em] text-sodium transition-colors hover:border-sodium"
          >
            <span aria-hidden="true">←</span> All posts — showing “{tag}”
          </button>
        )}

        <div className="mt-14">
          {error && (
            <p className="text-sm text-bone/70">
              {error}. The writing lives in a service that may be restarting — try again shortly.
            </p>
          )}
          {!error && posts === null && <p className="mono text-xs text-bone/40">Loading…</p>}
          {posts?.length === 0 && <p className="text-sm text-bone/70">Nothing published here yet.</p>}

          <ul className="divide-y divide-edge border-y border-edge">
            {(posts ?? []).map((p) => (
              <li key={p.slug}>
                <Link to={`/notes/${p.slug}`} className="group block py-8">
                  <div className="mono flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] uppercase tracking-[0.2em] text-bone/40">
                    <time dateTime={p.publishedAt ?? undefined}>{formatDate(p.publishedAt)}</time>
                    <span aria-hidden="true">·</span>
                    <span>{p.readingMinutes} min</span>
                    {p.tags.map((t) => (
                      <span key={t} className="text-bone/30">#{t}</span>
                    ))}
                  </div>
                  <h2 className="display-tight mt-3 text-2xl text-bone transition-colors group-hover:text-sodium sm:text-3xl">
                    {p.title}
                  </h2>
                  {p.subtitle && <p className="mt-2 text-base text-bone/60">{p.subtitle}</p>}
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone/55">{p.excerpt}</p>
                </Link>
              </li>
            ))}
          </ul>

          {allTags.length > 0 && !tag && (
            <div className="mono mt-10 flex flex-wrap gap-x-5 gap-y-2 text-[0.6875rem] uppercase tracking-[0.18em] text-bone/40">
              {allTags.map((t) => (
                <button key={t} onClick={() => setParams({ tag: t })} className="transition-colors hover:text-sodium">
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
