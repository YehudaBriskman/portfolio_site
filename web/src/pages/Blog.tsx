import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { NOTES_LAYERS } from "@/components/scene/LayerStack";
import Byline from "@/components/notes/Byline";
import CollectionFilter from "@/components/notes/CollectionFilter";
import NoteCard from "@/components/notes/NoteCard";
import NoteGlyph from "@/components/notes/NoteGlyph";
import TagPill from "@/components/notes/TagPill";
import { blog, type Collection, type PostSummary } from "@/services/blog";

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6";

/*
 * The loading state, shaped like the page it precedes.
 *
 * App.tsx renders this route behind `<Suspense fallback={null}>`, so the first
 * thing a visitor to /blog sees is nothing at all; these are the first pixels
 * on the screen and whatever they claim about the layout is what the reader
 * watches get corrected. Three identical cards claimed something false: the
 * real grid opens with a lead that spans both columns and splits into a
 * picture and a text panel, so the content always arrived a card-height taller
 * than the placeholder and shoved the page down.
 *
 * The lead is the half worth matching exactly, and it can be: the lead card is
 * the one slot that always carries media, whatever the post has. The cards
 * after it are text-only here because a note only gets a picture if it has a
 * real cover, which is not knowable before the request lands.
 */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse-soft rounded-full bg-surface ${className}`} />;
}

function Skeleton() {
  return (
    <div className={GRID} aria-hidden="true">
      <div className="note-card note-card--lead sm:col-span-2 sm:grid sm:grid-cols-[1.05fr_1fr] lg:grid-cols-[1.2fr_1fr]">
        <div className="note-card__media animate-pulse-soft bg-surface sm:border-b-0 sm:border-r sm:border-r-edge" />
        <div className="flex flex-col gap-3 p-5 sm:p-7 lg:p-9">
          <Bar className="h-3 w-20" />
          <Bar className="h-8 w-full" />
          <Bar className="h-8 w-3/5" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-4/5" />
          <Bar className="mt-auto h-3 w-32" />
        </div>
      </div>

      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="note-card">
          <div className="flex flex-col gap-3 p-5 sm:p-6">
            <Bar className="h-3 w-28" />
            <Bar className="h-6 w-4/5" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Blog() {
  const [params, setParams] = useSearchParams();
  const tag = params.get("tag");
  const collection = params.get("collection");
  const filtered = Boolean(tag || collection);

  const [cols, setCols] = useState<Collection[] | null>(null);
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

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
  }, [attempt]);

  useEffect(() => {
    let alive = true;
    setPosts(null);
    setError(null);
    /*
     * Everything, by default.
     *
     * This asked for `collection=site`, which meant the index of the writing
     * excluded most of the writing: every note filed against a project was
     * reachable only by finding the project first. The collection badge on the
     * card already says where a note came from, and the rail above the grid
     * narrows it to one collection for anybody who wants that.
     */
    const request = blog.posts({
      ...(tag ? { tag } : {}),
      ...(collection ? { collection } : {}),
    });
    request
      .then((p) => alive && setPosts(p))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, [tag, collection, attempt]);

  const site = (cols ?? []).find((c) => c.slug === "site");
  const projects = (cols ?? []).filter((c) => c.kind === "project");
  const titleOf = (slug: string) => (cols ?? []).find((c) => c.slug === slug)?.title;

  // The newest note leads the page. Not while filtering: inside a tag or a
  // single collection no one note outranks the others.
  const lead = !filtered && posts !== null && posts.length > 1 ? posts[0] : null;
  const rest = lead && posts ? posts.slice(1) : (posts ?? []);

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

          {/* Whose notes these are, and the feed the <head> has advertised
              since the first deploy without anything ever linking it. */}
          <Byline className="mt-9 max-w-[34rem]" feed />
        </header>
      </div>

      <div className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-6 sm:pb-32">
        <CollectionFilter projects={projects} active={collection} />

        {filtered && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="eyebrow">Showing</span>
            {tag && <TagPill tag={tag} active />}
            {collection && (
              <span className="meta-pill">{titleOf(collection) ?? collection}</span>
            )}
            <button
              type="button"
              onClick={() => setParams({}, { replace: true })}
              className="tap mono inline-flex min-h-[44px] items-center py-2 text-[0.75rem] tracking-[0.1em] text-clay transition-colors duration-150 hover:text-sodium"
            >
              Show all notes
            </button>
            {/* The way out of the filter and into the project itself, which is
                what the rail used to be before it became a filter. */}
            {collection && collection !== "site" && (
              <Link
                to={`/projects/${collection}`}
                className="tap mono inline-flex min-h-[44px] items-center py-2 text-[0.75rem] tracking-[0.1em] text-sodium transition-colors duration-150 hover:underline"
              >
                Open the project <span aria-hidden="true" className="ml-1.5">&rarr;</span>
              </Link>
            )}
          </div>
        )}

        <div className="mt-8 sm:mt-12" aria-live="polite" aria-busy={posts === null && !error}>
          {error && (
            /*
             * The API runs on one machine I administer, so an unreachable
             * backend is a screen real visitors meet rather than a branch for
             * completeness. It used to be a single 13px grey sentence under a
             * giant headline, in a void, with nothing to press. It now says
             * what failed, offers the action that can fix it, and gives two
             * routes onward that need no API at all.
             */
            <div className="note-card px-6 py-12 text-left sm:px-10 sm:py-16">
              <p className="eyebrow">Notes unavailable</p>
              <h2 className="display-tight mt-4 text-[clamp(1.6rem,5.5vw,2.25rem)]">
                The server didn&rsquo;t answer.
              </h2>
              <p className="mt-4 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-bone/85">
                The page is here; the writing behind it is served by a small machine I run myself,
                and it isn&rsquo;t responding right now. Usually that means a restart rather than
                anything permanent.
              </p>
              <p className="mono mt-4 text-[0.75rem] text-clay">{error}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" onClick={retry} className="btn btn-solid">
                  Try again
                </button>
                <Link to="/projects" className="btn btn-quiet">
                  See the projects
                </Link>
                <Link to="/" className="btn btn-quiet">
                  Home
                </Link>
              </div>
            </div>
          )}

          {/* No stagger. A 240ms cascade on a grid that has just replaced a
              skeleton flashes the page empty between two states that were
              already the same shape. */}
          {!error && posts === null && <Skeleton />}

          {!error && posts !== null && posts.length === 0 && (
            <div className="note-card flex flex-col items-center px-6 py-14 text-center sm:py-20">
              <div className="w-52 overflow-hidden rounded-[var(--r-md)] opacity-40 sm:w-72">
                <div className="aspect-[16/9]">
                  <NoteGlyph seed={tag ?? collection ?? "empty"} />
                </div>
              </div>
              <h2 className="display-tight mt-8 text-2xl sm:text-3xl">
                {tag ? `Nothing tagged #${tag}.` : collection ? "Nothing filed here yet." : "Nothing here yet."}
              </h2>
              <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-bone/70">
                {filtered
                  ? "Other notes exist — this filter just doesn’t match any of them."
                  : "The notes go up as the work gets done. The projects are further along."}
              </p>
              <Link to={filtered ? "/blog" : "/projects"} className="btn btn-quiet mt-8">
                {filtered ? "Show all notes" : "See the projects"} <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          )}

          {!error && posts !== null && posts.length > 0 && (
            <div className={GRID}>
              {lead && (
                <NoteCard
                  key={lead.slug}
                  post={lead}
                  lead
                  label="Latest"
                  collectionTitle={lead.collection === "site" ? undefined : titleOf(lead.collection)}
                  className="animate-fade-up"
                />
              )}
              {rest.map((p) => (
                <NoteCard
                  key={p.slug}
                  post={p}
                  collectionTitle={p.collection === "site" ? undefined : titleOf(p.collection)}
                  className="animate-fade-up"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
