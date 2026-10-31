import PageShell from "@/components/PageShell";
import ProjectPile from "@/components/projects/ProjectPile";
import { useProjects } from "@/hooks/useProjects";
import { relativeTime } from "@/services/blog";

/*
 * Every project, in one pile.
 *
 * What this page was
 * ------------------
 * Two full-width cards — the first of them a 21:9 screenshot over display
 * type, a description, three highlights and a row of repository facts —
 * followed by a heading and a two-by-two grid of four more. Six projects,
 * four distinct card layouts between them, and about three thousand pixels
 * of page. Everything on it was also on the six detail pages it links to.
 *
 * That became a shelf, and the shelf is now the pile the home page is built
 * around. It is the same order it was always sorted in: the two in use, then
 * the four from 2024-25. The grouping heading those four used to sit under
 * has gone, and the sentence under the title is where the distinction now
 * lives — which is honest, because the grouping was never a filter the reader
 * could act on, and each label states its own year and its own state anyway.
 *
 * The same component as the home page, rather than a second arrangement of
 * the same data.
 * ----------------------------------------------------------------------
 * This page and the home page were the two places the retired carousel was
 * used, and reaching for a different device here would mean two ways of
 * showing a project, drifting apart with every change to either. The pile
 * does not care what ground it stands on: it reads `--canvas-2`, `--ink` and
 * `--rule`, which is exactly the set `.on-panel` re-points, so the dark act
 * is a class on a wrapper and not a prop on a component. The catalogue is the
 * one page where the whole collection is the subject, so it gets the dark
 * ground too — the home page's "one dark act" rule is a rule about one page.
 *
 * The three facts in the header stay. They are the only things on this page
 * that are about the collection rather than about one project — how many are
 * in use, how many came before, and when anything last moved — and a reader
 * deciding whether this is a live portfolio or an abandoned one is reading
 * exactly those.
 */

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

        {/*
         * The `sr-only role="status"` that used to sit here is gone.
         *
         * It read "6 projects" — or "Loading projects", a state `useProjects`
         * cannot produce on this page because it is seeded from the table — and
         * it was the only route on the site that announced anything at all when
         * you arrived at it. A count is not a name: it told a reader how many
         * objects were in a room without telling them which room they had just
         * walked into, which is the question a route change raises.
         *
         * `components/RouteAnnouncer.tsx` now announces every route by name
         * from one region mounted above `<Routes>`. This one is removed and not
         * kept beside it, because two polite regions firing on one navigation
         * is noise a reader cannot turn down, and the counts a reader might
         * actually want are the three facts in the header directly above —
         * "2 in use · 4 earlier · last push …" — which are ordinary text and
         * are read in the ordinary way.
         */}
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
      </section>

      {/*
        The act, on its own ground.

        `.on-panel` is on a full-width wrapper rather than on the section
        above, because the header is paper and the collection is not: the
        ground dropping out between the two is the point at which the page
        stops introducing the work and starts showing it. The class re-points
        the colour tokens for the whole subtree and restates `color` with
        them, which is the part that is easy to miss — `color` inherits as a
        computed value, so redefining `--ink` alone leaves every word in here
        set in the body's ink on a near-black ground. See the note on
        `--panel` in index.css.
      */}
      <div data-chrome="dark" className="on-panel relative isolate">
        <div className="wrap section-y">
          {/* No heading of its own, and the labels are `h2`. The page's
              `h1` already says what the collection is; a second line saying
              it again would be a heading added only to justify a heading
              level. Six `h2`s under the `h1` is the outline a reader
              navigating by headings actually wants — the page, then its
              objects.

              `eagerFirst`, because the first card carries the first picture
              on the page and sits at or just past the fold at every width.
              Left lazy it is the LCP element and is fetched last. */}
          <ProjectPile entries={items} label="All projects" heading="h2" eagerFirst />
        </div>
      </div>
    </PageShell>
  );
}
