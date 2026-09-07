import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Scenery from "@/components/scene/Scenery";
import PostList from "@/components/PostList";
import ProjectMeta from "@/components/ProjectMeta";
import { blog, type Collection, type PostSummary } from "@/services/blog";

export default function Project() {
  const { project = "" } = useParams();
  const [c, setC] = useState<Collection | null>(null);
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    let alive = true;
    Promise.all([blog.collection(project), blog.posts({ collection: project })])
      .then(([col, p]) => {
        if (!alive) return;
        setC(col);
        setPosts(p);
        setState("ok");
        document.title = `${col.title} — Yehuda Briskman`;
      })
      .catch(() => alive && setState("missing"));
    return () => {
      alive = false;
      document.title = "Yehuda Briskman — Full-stack engineer & team lead";
    };
  }, [project]);

  return (
    <PageShell>
      <section className="isolate relative mx-auto max-w-6xl px-6 pb-28 pt-40 sm:pb-36">
        <Scenery variant="ridge" />
        <Link to="/projects" className="mono text-[0.6875rem] uppercase tracking-[0.22em] text-bone/45 transition-colors hover:text-sodium">
          ← Projects
        </Link>

        {state === "loading" && <p className="mono mt-12 text-xs text-bone/40">Loading…</p>}
        {state === "missing" && (
          <div className="mt-12">
            <h1 className="display-tight text-section">Not here</h1>
            <p className="mt-4 text-sm text-bone/70">No project at that address.</p>
          </div>
        )}

        {c && state === "ok" && (
          <>
            <h1 className="display-tight mt-8 text-section">{c.title}</h1>
            {c.tagline && <p className="mt-4 max-w-2xl text-lg text-bone/70">{c.tagline}</p>}
            {c.description && (
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-bone/60 sm:text-base">{c.description}</p>
            )}

            {c.coverImage && (
              <img src={c.coverImage} alt="" loading="lazy" className="mt-10 max-h-96 w-full rounded-lg border border-edge object-cover" />
            )}

            <ProjectMeta c={c} />

            {(c.links.length > 0 || c.repoUrl) && (
              <ul className="mono mt-8 flex flex-wrap gap-x-7 gap-y-2 text-[0.6875rem] uppercase tracking-[0.2em]">
                {c.repoUrl && (
                  <li>
                    <a href={c.repoUrl} target="_blank" rel="noreferrer noopener" className="text-sodium transition-opacity hover:opacity-70">
                      Source ↗
                    </a>
                  </li>
                )}
                {c.stats?.latestRelease && (
                  <li>
                    <a href={c.stats.latestRelease.url} target="_blank" rel="noreferrer noopener" className="text-sodium transition-opacity hover:opacity-70">
                      {c.stats.latestRelease.tag} ↗
                    </a>
                  </li>
                )}
                {c.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer noopener" className="text-sodium transition-opacity hover:opacity-70">
                      {l.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-20">
              <p className="eyebrow">Notes on this project</p>
              <div className="mt-6">
                {posts === null ? (
                  <p className="mono text-xs text-bone/40">Loading…</p>
                ) : posts.length === 0 ? (
                  <p className="text-sm text-bone/55">
                    Nothing written here yet. Posts filed under this project appear on this page.
                  </p>
                ) : (
                  <PostList posts={posts} />
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </PageShell>
  );
}
