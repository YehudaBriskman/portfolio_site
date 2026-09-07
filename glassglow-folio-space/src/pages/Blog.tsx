import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Scenery from "@/components/scene/Scenery";
import PostList from "@/components/PostList";
import { blog, type Collection, type PostSummary } from "@/services/blog";

export default function Blog() {
  const [cols, setCols] = useState<Collection[] | null>(null);
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([blog.collections(), blog.posts()])
      .then(([c, p]) => {
        if (!alive) return;
        setCols(c);
        setPosts(p);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, []);

  // The site's own writing leads; project shelves follow.
  const site = (cols ?? []).find((c) => c.slug === "site");
  const projects = (cols ?? []).filter((c) => c.slug !== "site");

  return (
    <PageShell>
      <section className="isolate relative mx-auto max-w-6xl px-6 pb-28 pt-40 sm:pb-36">
        <Scenery variant="shore" />
        <p className="eyebrow">Blog</p>
        <h1 className="display-tight mt-5 text-section">{site?.title ?? "Writing"}</h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-bone/70 sm:text-base">
          {site?.description ??
            "Decisions I made and what they cost — mostly about making software prove it still works somewhere that isn’t my laptop."}
        </p>

        {projects.length > 0 && (
          <div className="mt-14">
            <p className="eyebrow">Project notes</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((c) => (
                <Link
                  key={c.slug}
                  to={`/blog/c/${c.slug}`}
                  className="group block border border-edge bg-surface/40 p-6 transition-colors hover:border-sodium/50"
                >
                  {c.coverImage && (
                    <img src={c.coverImage} alt="" loading="lazy" className="mb-4 h-28 w-full border border-edge object-cover" />
                  )}
                  <h2 className="display-tight text-xl text-bone transition-colors group-hover:text-sodium">{c.title}</h2>
                  {c.description && <p className="mt-2 text-sm leading-relaxed text-bone/60">{c.description}</p>}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-16">
          <p className="eyebrow">Latest</p>
          <div className="mt-6">
            {error && <p className="text-sm text-bone/70">{error}</p>}
            {!error && posts === null && <p className="mono text-xs text-bone/40">Loading…</p>}
            {posts && <PostList posts={posts} />}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
