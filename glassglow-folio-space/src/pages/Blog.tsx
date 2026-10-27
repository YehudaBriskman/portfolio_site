import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { NOTES_LAYERS } from "@/components/scene/LayerStack";
import NoteCard from "@/components/notes/NoteCard";
import NoteGlyph from "@/components/notes/NoteGlyph";
import ProjectRail from "@/components/notes/ProjectRail";
import TagPill from "@/components/notes/TagPill";
import { blog, type Collection, type PostSummary } from "@/services/blog";

/* Same shape as a real card, so nothing jumps when the data lands. */
function Skeleton() {
  return (
    <div className="note-card" aria-hidden="true">
      <div className="note-card__media animate-pulse-soft bg-surface" />
      <div className="space-y-3 p-5 sm:p-6">
        <div className="h-3 w-28 animate-pulse-soft rounded-full bg-surface" />
        <div className="h-6 w-4/5 animate-pulse-soft rounded-full bg-surface" />
        <div className="h-4 w-full animate-pulse-soft rounded-full bg-surface" />
        <div className="h-4 w-2/3 animate-pulse-soft rounded-full bg-surface" />
      </div>
    </div>
  );
}

export default function Blog() {
  const [params, setParams] = useSearchParams();
  const tag = params.get("tag");

  const [cols, setCols] = useState<Collection[] | null>(null);
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Collections describe the page itself and never change with the filter, so
  // they are fetched once rather than on every tag change.
  useEffect(() => {
    let alive = true;
    blog
      .collections()
      .then((c) => alive && setCols(c))
      .catch(() => alive && setCols([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setPosts(null);
    setError(null);
    // A tag search deliberately crosses collections: the tag link at the foot of
    // a project note was previously a dead end, pointing at an index that never
    // read the query string at all.
    const request = tag ? blog.posts({ tag }) : blog.posts({ collection: "site" });
    request
      .then((p) => alive && setPosts(p))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, [tag]);

  const site = (cols ?? []).find((c) => c.slug === "site");
  const projects = (cols ?? []).filter((c) => c.kind === "project");
  const titleOf = (slug: string) => (cols ?? []).find((c) => c.slug === slug)?.title;

  return (
    <PageShell layers={NOTES_LAYERS}>
      <div data-crest data-hue="120 92 150" className="mx-auto w-full max-w-5xl px-5 pt-24 sm:px-6 sm:pt-32 lg:pt-40">
        {/*
          The scenery is anchored to this box rather than to the whole page, so
          the ridgeline lands under the title instead of four thousand pixels
          down beneath the last card, where nobody was ever going to see it.
        */}
        <header className="isolate relative pb-14 sm:pb-20">
          <p className="eyebrow">Notes</p>
          <h1 className="display mt-4 text-[clamp(2.75rem,11.5vw,4.75rem)] leading-[0.92]">
            {site?.title ?? "Writing"}
          </h1>
          <p className="mt-6 max-w-[34rem] text-base leading-[1.7] text-bone/85 sm:text-lg">
            {site?.description ??
              "Decisions I made and what they cost. Mostly about making software prove it still works somewhere that isn’t my laptop."}
          </p>
        </header>
      </div>

      <div className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-6 sm:pb-32">
        <ProjectRail projects={projects} />

        {tag && (
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <span className="eyebrow">Filtered by</span>
            <TagPill tag={tag} active />
            <button
              type="button"
              onClick={() => setParams({}, { replace: true })}
              className="tap mono inline-flex min-h-[44px] items-center py-2 text-[0.75rem] tracking-[0.1em] text-clay transition-colors duration-150 hover:text-sodium"
            >
              Show all notes
            </button>
          </div>
        )}

        <div className="mt-8 sm:mt-12" aria-live="polite" aria-busy={posts === null && !error}>
          {error && (
            <p className="text-[0.9375rem] text-bone/85">
              Couldn&rsquo;t load the notes. Try again in a moment.
            </p>
          )}

          {!error && posts === null && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          )}

          {!error && posts !== null && posts.length === 0 && (
            <div className="note-card flex flex-col items-center px-6 py-14 text-center sm:py-20">
              <div className="w-52 overflow-hidden rounded-[var(--r-md)] opacity-40 sm:w-72">
                <div className="aspect-[16/9]">
                  <NoteGlyph seed={tag ?? "empty"} />
                </div>
              </div>
              <h2 className="display-tight mt-8 text-2xl sm:text-3xl">
                {tag ? `Nothing tagged #${tag}.` : "Nothing here yet."}
              </h2>
              <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-bone/70">
                {tag
                  ? "No published notes carry that tag yet."
                  : "The notes go up as the work gets done. The projects are further along."}
              </p>
              <Link to={tag ? "/blog" : "/projects"} className="btn btn-quiet mt-8">
                {tag ? "Show all notes" : "See the projects"} <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          )}

          {!error && posts !== null && posts.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
              {posts.map((p, i) => (
                <NoteCard
                  key={p.slug}
                  post={p}
                  /* The newest note leads the page. Not while filtering: in a
                     tag result no single note outranks the others. */
                  lead={i === 0 && !tag && posts.length > 1}
                  collectionTitle={p.collection === "site" ? undefined : titleOf(p.collection)}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(i * 60, 240)}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
