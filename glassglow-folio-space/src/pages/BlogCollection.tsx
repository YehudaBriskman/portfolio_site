import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Scenery from "@/components/scene/Scenery";
import PostList from "@/components/PostList";
import { blog, type Collection, type PostSummary } from "@/services/blog";

export default function BlogCollection() {
  const { collection = "" } = useParams();
  const [col, setCol] = useState<Collection | null>(null);
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([blog.collections(), blog.posts({ collection })])
      .then(([cs, p]) => {
        if (!alive) return;
        setCol(cs.find((c) => c.slug === collection) ?? null);
        setPosts(p);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, [collection]);

  return (
    <PageShell>
      <section className="isolate relative mx-auto max-w-6xl px-6 pb-28 pt-40 sm:pb-36">
        <Scenery variant="shore" />
        <Link to="/blog" className="mono text-[0.6875rem] uppercase tracking-[0.22em] text-bone/45 transition-colors hover:text-sodium">
          ← Blog
        </Link>
        <p className="eyebrow mt-8">Project notes</p>
        <h1 className="display-tight mt-4 text-section">{col?.title ?? collection}</h1>
        {col?.description && (
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-bone/70 sm:text-base">{col.description}</p>
        )}
        {col?.coverImage && (
          <img src={col.coverImage} alt="" loading="lazy" className="mt-8 max-h-72 w-full border border-edge object-cover" />
        )}
        {col && col.links.length > 0 && (
          <ul className="mono mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[0.6875rem] uppercase tracking-[0.2em]">
            {col.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer noopener" className="text-sodium transition-opacity hover:opacity-70">
                  {l.label} ↗
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-14">
          {error && <p className="text-sm text-bone/70">{error}</p>}
          {!error && posts === null && <p className="mono text-xs text-bone/40">Loading…</p>}
          {posts && <PostList posts={posts} />}
        </div>
      </section>
    </PageShell>
  );
}
