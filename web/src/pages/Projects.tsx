import PageShell from "@/components/PageShell";
/* InkWipe, not Reveal. Reveal was an IntersectionObserver that translated a
   section 26px before fading it in; the wipe is scroll-timeline driven and
   needs no observer. */
import InkWipe from "@/components/motion/InkWipe";
import ProjectCarousel from "@/components/carousel/ProjectCarousel";
import { useProjects } from "@/hooks/useProjects";
import { relativeTime } from "@/services/blog";

/*
 * Every project, on one shelf.
 *
 * What this page was
 * ------------------
 * Two full-width cards — the first of them a 21:9 screenshot over display
 * type, a description, three highlights and a row of repository facts —
 * followed by a heading and a two-by-two grid of four more. Six projects,
 * four distinct card layouts between them, and about three thousand pixels
 * of page. Everything on it was also on the six detail pages it links to.
 *
 * It is one carousel now, in the same order it was always sorted in: the two
 * in use, then the four from 2024-25. The grouping heading those four used
 * to sit under has gone with the grid, and the sentence under the title is
 * where that distinction now lives — which is honest, because the grouping
 * was never a filter the reader could act on, and each card states its own
 * year and its own state anyway.
 *
 * The three facts in the header stay. They are the only things on this page
 * that are about the shelf rather than about one project — how many are in
 * use, how many came before, and when anything last moved — and a reader
 * deciding whether this is a live portfolio or an abandoned one is reading
 * exactly those.
 */

/* The page's own h1 is not a plate, so the first screenshot is plate one. */
const FIRST_PLATE = 1;

export default function Projects() {
  const { items, state, featured, archive } = useProjects();

  /* The freshest push across every project with a repository — one honest
     signal that the shelf is alive, and nothing at all when none is known. */
  const lastPush = items
    .map((e) => e.collection.stats?.pushedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return (
    <PageShell>
      <section data-crest data-hue="58 106 102" className="wrap section-y isolate relative">
        <header className="relative">
          <p className="eyebrow">Projects</p>
          <h1 className="display mt-3 text-section">What I&rsquo;m building</h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-[1.6] text-ink/85 sm:text-xl">
            Two things people actually use, and the trail of smaller work from 2024&ndash;25 that got me
            there.
          </p>

          {/* These were three capsules, which made the count of the shelf look
              like something you could press. They are facts; facts are type. */}
          <p className="mono mt-12 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs text-[rgb(var(--ink-soft))]">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--ink-soft))]" aria-hidden="true" />
              <b className="font-medium tabular-nums text-ink">{featured.length}</b> in use
            </span>
            {archive.length > 0 && (
              <>
                <span aria-hidden="true" className="text-[rgb(var(--ink-soft))]">
                  ·
                </span>
                <span>
                  <b className="font-medium tabular-nums text-ink">{archive.length}</b> earlier
                </span>
              </>
            )}
            {lastPush && (
              <>
                <span aria-hidden="true" className="text-[rgb(var(--ink-soft))]">
                  ·
                </span>
                <span>
                  last push <b className="font-medium text-ink">{relativeTime(lastPush)}</b>
                </span>
              </>
            )}
          </p>
        </header>

        <p className="sr-only" role="status">
          {state === "loading" ? "Loading projects" : `${items.length} projects`}
        </p>

        {state === "error" && (
          <p className="mt-12 max-w-[52ch] text-sm leading-relaxed text-ink/70">
            Couldn&rsquo;t reach the live index just now, so the repository facts below may be missing. The
            work itself is all here.
          </p>
        )}

        {/* No skeleton and no empty state here, and nothing to guard against:
            `useProjects` is seeded from the project table, so the list is
            populated on the first paint and `items.length === 0` is not a
            state it can produce. */}
        <div className="mt-12">
          <InkWipe as="div">
            {/* The first card is above the fold at every width, so its
                screenshot is the LCP element and must not be lazy. */}
            <ProjectCarousel
              entries={items}
              label="All projects"
              /* The only heading above the shelf on this page is the h1, so
                 a card title is an h2 here and an h3 on the home page, where
                 `Work` sits between. */
              heading="h2"
              firstPlate={FIRST_PLATE}
              eagerFirst
            />
          </InkWipe>
        </div>
      </section>
    </PageShell>
  );
}
