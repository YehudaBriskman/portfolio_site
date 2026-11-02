import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Byline from "@/components/notes/Byline";
import CollectionFilter from "@/components/notes/CollectionFilter";
import MetaPill from "@/components/notes/MetaPill";
import NoteCard from "@/components/notes/NoteCard";
/* The card's own stylesheet, borrowed for the boxes that are
   note-card-shaped without being note cards: the loading skeleton (which
   uses the slot and the face, so it is the card's height by construction,
   and is dark like the cards it stands in for) and the two states where
   there is nothing to list, which stay paper cards — they are messages
   from the page, not notes. */
import card from "@/components/notes/NoteCard.module.css";
import dark from "@/components/notes/DarkCard.module.css";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import NoteGlyph from "@/components/notes/NoteGlyph";
import TagPill from "@/components/notes/TagPill";
import { blog, type Collection, type PostSummary } from "@/services/blog";

const GRID = "grid grid-cols-1 gap-6 sm:grid-cols-2";

/*
 * The loading state, shaped like the page it precedes.
 *
 * App.tsx renders this route behind `<Suspense fallback={null}>`, so the first
 * thing a visitor to /blog sees is nothing at all; these are the first pixels
 * on the screen and whatever they claim about the layout is what the reader
 * watches get corrected.
 *
 * Since #179 every note card is one height, the lead included, so the
 * placeholder can be exact where it used to be an estimate: the slot and the
 * face are `NoteCard`'s own classes, so each placeholder is the height of
 * the card that replaces it by construction rather than by measurement. The
 * lead always carries media, so its picture column is drawn; the cards after
 * it are drawn without, because a note only gets a picture if it has a real
 * cover and that is not knowable before the request lands — which moves the
 * date line to the head of the card, exactly as a coverless card does.
 *
 * ── why this is not `LabelSkeleton` ───────────────────────────────────────
 *
 * Because a note card is not an object label. `NoteCard` has a badge row, a
 * stretched link, and its own type steps, so the schema-shaped skeleton would
 * be the wrong shape here. What is shared is the thing worth sharing:
 * `SkeletonLines` draws the lines, so the capsule, the sweep, the two
 * off-switches and the gate are the same ones the notes shelf uses, and
 * every line below takes its height from the card's own type step.
 *
 * ── the one thing this cannot get right ───────────────────────────────────
 *
 * How many notes there are. The grid is a lead plus `ceil((n-1)/2)` rows and
 * `n` is what the request is for, so no placeholder can reserve the real
 * height of this region — the honest thing is to reserve the shape of it and
 * let the document grow at its bottom edge, which is below the fold on
 * arrival at every width this page is drawn at.
 */

/** A row of the card's own type, with the skeleton's lines set in it. */
function Lines({ className, lines, tail }: { className: string; lines: number; tail?: string }) {
  return (
    <div className={className}>
      <SkeletonLines lines={lines} tail={tail} />
    </div>
  );
}

const LEAD_TITLE_LINES = 3;
const CARD_TITLE_LINES = 2;
const ROWS = 2;

function Skeleton() {
  return (
    <SkeletonGate className={GRID}>
      <div className={`${card.slot} ${card.cycle} sm:col-span-2`}>
        <div
          className={`note-card note-card--lead on-panel ${dark.dark} ${card.card} ${card.face} ${card.lead}`}
          data-cover=""
        >
          {/* The media slot, empty: the one part of a note card whose
              footprint is known before the response. */}
          <div className={`note-card__media ${card.media}`} />
          {/* The badge row's 44px floor, reproduced empty: the row's height
              is the card's and not the badge's. */}
          <div className={`${card.head} -my-1 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2`} />
          <Lines
            className={`${card.title} display-tight text-[1.75rem] sm:text-[2.125rem] lg:text-[2.5rem]`}
            lines={LEAD_TITLE_LINES}
          />
        </div>
      </div>

      {Array.from({ length: ROWS * 2 }, (_, i) => (
        <div key={i} className={`${card.slot} ${card.cycle}`}>
          <div className={`note-card on-panel ${dark.dark} ${card.card} ${card.face}`}>
            {/* The date-and-minutes row. One capsule rather than two: the
                separator between them is a dot `NoteCard` draws itself. */}
            <Lines
              className={`${card.head} mono -my-1 flex min-h-11 flex-wrap items-center text-[0.75rem]`}
              lines={1}
              tail="7.5rem"
            />
            <Lines className={`${card.title} display-tight text-[1.375rem] sm:text-2xl`} lines={CARD_TITLE_LINES} />
          </div>
        </div>
      ))}
    </SkeletonGate>
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

  /* A new filter or a retry clears the old answer in the render that asks
     for the new one, not an effect later. */
  const asked = `${tag}\u0000${collection}\u0000${attempt}`;
  const [shown, setShown] = useState(asked);
  if (shown !== asked) {
    setShown(asked);
    setPosts(null);
    setError(null);
  }

  useEffect(() => {
    let alive = true;
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
    <PageShell>
      <div data-crest data-hue="120 92 150" className="wrap pt-section">
        {/*
          The scenery is anchored to this box rather than to the whole page, so
          the ridgeline lands under the title instead of four thousand pixels
          down beneath the last card, where nobody was ever going to see it.
        */}
        <header className="isolate relative pb-section-sm">
          <p className="eyebrow">Notes</p>
          <h1 className="display mt-3 text-[clamp(2.75rem,11.5vw,4.75rem)] leading-[0.92]">
            {site?.title ?? "Writing"}
          </h1>
          <p className="mt-6 max-w-[34rem] text-base leading-[1.7] text-clay sm:text-lg">
            {site?.description ??
              "Decisions I made and what they cost. Mostly about making software prove it still works somewhere that isn’t my laptop."}
          </p>

          {/* Whose notes these are, and the feed the <head> has advertised
              since the first deploy without anything ever linking it. */}
          <Byline className="mt-12 max-w-[34rem]" feed />
        </header>
      </div>

      <div className="wrap pb-section">
        <CollectionFilter projects={projects} active={collection} />

        {filtered && (
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <span className="eyebrow">Showing</span>
            {tag && <TagPill tag={tag} active />}
            {collection && <MetaPill>{titleOf(collection) ?? collection}</MetaPill>}
            <button
              type="button"
              onClick={() => setParams({}, { replace: true })}
              className="tap mono inline-flex min-h-[44px] items-center py-2 text-xs tracking-[0.1em] text-clay transition-colors duration-150 hover:text-bone"
            >
              Show all notes
            </button>
            {/* The way out of the filter and into the project itself, which is
                what the rail used to be before it became a filter. */}
            {collection && collection !== "site" && (
              <Link
                to={`/projects/${collection}`}
                className="tap mono inline-flex min-h-[44px] items-center py-2 text-xs tracking-[0.1em] text-bone transition-colors duration-150 hover:underline"
              >
                Open the project <span aria-hidden="true" className="ml-1.5">&rarr;</span>
              </Link>
            )}
          </div>
        )}

        <div className="mt-12" aria-live="polite" aria-busy={posts === null && !error}>
          {error && (
            /*
             * The API runs on one machine I administer, so an unreachable
             * backend is a screen real visitors meet rather than a branch for
             * completeness. It used to be a single 13px grey sentence under a
             * giant headline, in a void, with nothing to press. It now says
             * what failed, offers the action that can fix it, and gives two
             * routes onward that need no API at all.
             */
            <div className={`note-card ${card.card} px-6 py-12 text-left sm:px-10 sm:py-16`}>
              <p className="eyebrow">Notes unavailable</p>
              <h2 className="display-tight mt-3 text-[clamp(1.6rem,5.5vw,2.25rem)]">
                The server didn&rsquo;t answer.
              </h2>
              <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-clay">
                The page is here; the writing behind it is served by a small machine I run myself,
                and it isn&rsquo;t responding right now. Usually that means a restart rather than
                anything permanent.
              </p>
              <p className="mono mt-3 text-[0.75rem] text-clay">{error}</p>
              <div className="mt-12 flex flex-wrap gap-3">
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
            <div className={`note-card ${card.card} flex flex-col items-center px-6 py-14 text-center sm:py-20`}>
              {/* The glyph's own corner, one step in from the card's 32px for
                  the 12px of air around it — the same concentric arithmetic
                  the figure mounts and the nav islands use. */}
              <div className="w-52 overflow-hidden rounded-[calc(var(--r-lg)-12px)] opacity-80 sm:w-72">
                <div className="aspect-[16/9]">
                  <NoteGlyph seed={tag ?? collection ?? "empty"} />
                </div>
              </div>
              <h2 className="display-tight mt-12 text-2xl sm:text-3xl">
                {tag ? `Nothing tagged #${tag}.` : collection ? "Nothing filed here yet." : "Nothing here yet."}
              </h2>
              <p className="mt-6 max-w-sm text-[0.9375rem] leading-relaxed text-clay">
                {filtered
                  ? "Other notes exist — this filter just doesn’t match any of them."
                  : "The notes go up as the work gets done. The projects are further along."}
              </p>
              <Link to={filtered ? "/blog" : "/projects"} className="btn btn-quiet mt-12">
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
                  className="scrub-rise"
                />
              )}
              {rest.map((p) => (
                <NoteCard
                  key={p.slug}
                  post={p}
                  collectionTitle={p.collection === "site" ? undefined : titleOf(p.collection)}
                  className="scrub-rise"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
