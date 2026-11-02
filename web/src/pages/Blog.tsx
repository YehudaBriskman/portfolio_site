import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Byline from "@/components/notes/Byline";
import NoteGlyph from "@/components/notes/NoteGlyph";
import NoteTile from "@/components/notes/NoteTile";
/* The card's own stylesheet, borrowed for the two states where there is
   nothing to list or nothing could be fetched: they stay paper cards — they
   are messages from the page, not notes. */
import card from "@/components/notes/NoteCard.module.css";
import dark from "@/components/notes/DarkCard.module.css";
import tileStyles from "@/components/notes/NoteTile.module.css";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import FilterControl, { FilterTokens, SearchField, type FacetSpec } from "@/components/gallery/FilterControl";
import RailLayout, { RailIndex } from "@/components/gallery/Rail";
import Wall, { WallSkeletonGrid, type Size } from "@/components/gallery/Wall";
import { activeCount, hrefCleared, readSelection } from "@/components/gallery/facets";
import {
  NOTE_FACETS,
  SEARCH_FROM,
  byYear,
  filterNotes,
  noteOptions,
  sizesOfNotes,
  type NoteFacet,
} from "@/components/notes/shelf";
import { blog, type Collection, type PostSummary } from "@/services/blog";

/*
 * The notes, as a gallery (#193).
 *
 * The same wall and the same arrival as /projects (`gallery/Wall.tsx`), hung
 * with the notes' own dark cards (`notes/NoteTile.tsx`), beside the same
 * rail and filter control. Notes read like docs, so the rail here also
 * carries an index: every note on the wall, by year, one link each.
 *
 * Everything is fetched once — the posts and the collections — and filtered
 * on the client by topic, year and where the note is filed (`notes/shelf.ts`
 * argues why). Each filter is the URL, so a filtered view is a link, and the
 * old `?tag=` and `?collection=` links land on the same view they always did.
 *
 * Search is offered once there are `SEARCH_FROM` notes: below that, the wall
 * is shorter than the time it takes to type.
 */

const LABEL: Record<NoteFacet, string> = { tag: "Topic", year: "Year", collection: "Filed under" };

/*
 * The loading state, shaped like the page it precedes: a lead and four
 * tiles, two rows of the four-column wall, which is the shape the page has
 * at any count above four. Dark, like the cards they stand in for, in the
 * tile's own classes (so each placeholder is the card's shape by
 * construction), and drawn with `SkeletonLines`, so the sweep, the gate and
 * the off-switches are the ones every placeholder on the site uses.
 *
 * What it cannot get right is how many notes there are, so it reserves the
 * shape of the region and lets the document grow at its bottom edge, which
 * is below the fold on arrival at every width this page is drawn at.
 */
const SKELETON: Size[] = ["lead", "tile", "tile", "tile", "tile"];

function WallSkeleton() {
  return (
    <SkeletonGate>
      <WallSkeletonGrid
        sizes={SKELETON}
        className={tileStyles.wall}
        render={(size) => (
          <div
            className={`on-panel ${dark.dark} ${tileStyles.tile}`}
            data-size={size}
            data-media={size === "lead" ? "" : undefined}
          >
            {size === "lead" && <div className={tileStyles.media} />}
            <div className={tileStyles.body}>
              <div className={tileStyles.meta}>
                <SkeletonLines lines={1} tail="9rem" />
              </div>
              <div className={tileStyles.skTitle}>
                <SkeletonLines lines={2} />
              </div>
            </div>
          </div>
        )}
      />
    </SkeletonGate>
  );
}

function RailSkeleton() {
  return (
    <SkeletonGate>
      <div className={tileStyles.railSkeleton}>
        <SkeletonLines lines={4} />
      </div>
    </SkeletonGate>
  );
}

export default function Blog() {
  const [params] = useSearchParams();
  const location = useLocation();
  const selection = readSelection(params, NOTE_FACETS);
  const q = (params.get("q") ?? "").trim();
  const on = activeCount(selection);
  const filtered = on > 0 || q.length > 0;

  const [cols, setCols] = useState<Collection[] | null>(null);
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  /* A retry clears the old answer in the render that asks for the new one,
     not an effect later. */
  const [shownAttempt, setShownAttempt] = useState(attempt);
  if (shownAttempt !== attempt) {
    setShownAttempt(attempt);
    setPosts(null);
    setError(null);
  }
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    blog
      .collections()
      .then((c) => alive && setCols(c))
      .catch(() => alive && setCols([]));
    /* Everything, once. Every filter on this page is applied to this list
       (`notes/shelf.ts`), so changing one costs no request. */
    blog
      .posts()
      .then((p) => alive && setPosts(p))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const site = (cols ?? []).find((c) => c.slug === "site");
  const titleOf = (slug: string) =>
    slug === "site" ? "The site" : ((cols ?? []).find((c) => c.slug === slug)?.title ?? slug);

  const all = posts ?? [];
  const shown = filterNotes(all, selection, q);
  const sizes = sizesOfNotes(all);
  const facets: FacetSpec[] = NOTE_FACETS.map((f) => ({
    key: f,
    label: LABEL[f],
    options: noteOptions(all, f, selection, q),
    ...(f === "collection" ? { labelOf: titleOf } : {}),
  }));
  /* "Filed under" only means something once a note is filed somewhere other
     than the site itself (or a link has chosen one). */
  const offered = facets.filter((f) => f.key !== "collection" || f.options.length > 1 || selection.collection);

  const chosen = NOTE_FACETS.filter((f) => selection[f]?.length).map(
    (f) =>
      `${LABEL[f].toLowerCase()} ${selection[f]!.map((v) => (f === "collection" ? titleOf(v) : v)).join(" or ")}`
  );
  if (q) chosen.push(`“${q}”`);
  const label = filtered ? `Notes: ${chosen.join(", ")}` : "All notes";

  const ready = !error && posts !== null;

  return (
    <PageShell>
      <div data-crest data-hue="120 92 150" className="wrap-wide pt-section">
        {/*
          The scenery is anchored to this box rather than to the whole page, so
          the ridgeline lands under the title instead of four thousand pixels
          down beneath the last card, where nobody was ever going to see it.
        */}
        <header className="isolate relative pb-section-sm">
          <p className="eyebrow">Blogs</p>
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

      <div className="wrap-wide pb-section">
        <RailLayout
          label="Filter and browse notes"
          count={on}
          done={`Show ${shown.length} ${shown.length === 1 ? "note" : "notes"}`}
          bar={<FilterTokens facets={offered} selection={selection} path="/blog" />}
          rail={
            error ? null : ready ? (
              <>
                <FilterControl
                  title="Filter"
                  facets={offered}
                  selection={selection}
                  path="/blog"
                  shown={shown.length}
                  total={all.length}
                  noun={all.length === 1 ? "note" : "notes"}
                  search={
                    all.length >= SEARCH_FROM ? (
                      <SearchField label="Search notes" path="/blog" placeholder="Title, topic or phrase…" />
                    ) : undefined
                  }
                />
                <RailIndex
                  title="Index"
                  groups={byYear(shown).map((g) => ({
                    label: g.label,
                    items: g.items.map((p) => ({ key: p.slug, href: `/blog/${p.slug}`, label: p.title })),
                  }))}
                />
              </>
            ) : (
              <RailSkeleton />
            )
          }
        >
          <div aria-busy={posts === null && !error}>
            {error && (
              /*
               * The API runs on one machine I administer, so an unreachable
               * backend is a screen real visitors meet rather than a branch
               * for completeness. It says what failed, offers the action that
               * can fix it, and gives two routes onward that need no API.
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

            {!error && posts === null && <WallSkeleton />}

            {ready && all.length === 0 && (
              <div className={`note-card ${card.card} flex flex-col items-center px-6 py-14 text-center sm:py-20`}>
                {/* The glyph's own corner, one step in from the card's 32px
                    for the 12px of air around it. */}
                <div className="w-52 overflow-hidden rounded-[calc(var(--r-lg)-12px)] opacity-80 sm:w-72">
                  <div className="aspect-[16/9]">
                    <NoteGlyph seed="empty" />
                  </div>
                </div>
                <h2 className="display-tight mt-12 text-2xl sm:text-3xl">Nothing here yet.</h2>
                <p className="mt-6 max-w-sm text-[0.9375rem] leading-relaxed text-clay">
                  The notes go up as the work gets done. The projects are further along.
                </p>
                <Link to="/projects" className="btn btn-quiet mt-12">
                  See the projects
                </Link>
              </div>
            )}

            {ready && all.length > 0 && shown.length === 0 && (
              /* Only a filter or a search can empty a shelf that has notes,
                 so the way out is to take them off. */
              <div className="max-w-[52ch] py-12">
                <h2 className="display-tight text-2xl">No note matches {chosen.join(" and ")}.</h2>
                <p className="mt-4 text-lg leading-relaxed">Take a filter off, or clear them all and see every note.</p>
                <Link
                  to={hrefCleared("/blog", location.search, [...NOTE_FACETS, "q"])}
                  className="tap mt-4 inline-flex min-h-[44px] items-center text-ink underline underline-offset-4"
                >
                  Show every note
                </Link>
              </div>
            )}

            {ready && shown.length > 0 && (
              <Wall
                label={label}
                name="n"
                className={tileStyles.wall}
                items={shown.map((p) => {
                  const size = sizes.get(p.slug) ?? "tile";
                  return {
                    key: p.slug,
                    size,
                    node: (
                      <NoteTile
                        post={p}
                        size={size}
                        collectionTitle={p.collection === "site" ? undefined : titleOf(p.collection)}
                      />
                    ),
                  };
                })}
              />
            )}
          </div>
        </RailLayout>
      </div>
    </PageShell>
  );
}
