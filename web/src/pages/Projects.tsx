import { Link, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import FilterControl, { FilterTokens, type FacetSpec } from "@/components/gallery/FilterControl";
import RailLayout from "@/components/gallery/Rail";
import { activeCount, readSelection } from "@/components/gallery/facets";
import Gallery from "@/components/projects/Gallery";
import { FACETS, applyFilters, optionsFor, sizesOf } from "@/components/projects/catalogue";
import { useProjects } from "@/hooks/useProjects";
import { relativeTime } from "@/services/blog";

/*
 * The catalogue: every project, hung as a gallery wall beside a side rail
 * that filters it, with every filter a URL a reader can link to.
 *
 * #169 gave this page its own job — the full set, four projects or forty,
 * found and opened fast. #175 answered it with a gallery under a dark
 * instrument panel; #193 took the panel out ("it doesn't belong") and moved
 * the filters from rows of chips into the shared filter control, in the same
 * rail the notes use (`gallery/Rail.tsx`, `gallery/FilterControl.tsx`).
 *
 * The three facts in the header stay: how many are in use, how many came
 * before, and when anything last moved. The last is the page's one async
 * region — a skeleton until the live index answers, and nothing at all if it
 * never does.
 */

const LABEL = { state: "State", year: "Year", stack: "Stack" } as const;

export default function Projects() {
  const { items, state, featured, archive } = useProjects();
  const [params] = useSearchParams();

  /* A facet the catalogue cannot offer (a stale link) is honoured rather
     than dropped, so the empty state below can say so and offer the way back. */
  const filters = readSelection(params, FACETS);
  const on = activeCount(filters);
  const shown = applyFilters(items, filters);
  const facets: FacetSpec[] = FACETS.map((f) => ({
    key: f,
    label: LABEL[f],
    options: optionsFor(items, f, filters),
    noTranslate: f === "stack",
  }));
  /* Over the whole set, so narrowing the wall never resizes a project. */
  const sizes = sizesOf(items);
  const chosen = FACETS.filter((f) => filters[f]?.length).map(
    (f) => `${LABEL[f].toLowerCase()} ${filters[f]!.join(" or ")}`
  );
  const label = on ? `Projects: ${chosen.join(", ")}` : "All projects";

  const lastPush = items
    .map((e) => e.collection.stats?.pushedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return (
    <PageShell>
      <section data-crest data-hue="58 106 102" className="wrap-wide section-y isolate relative">
        <header className="relative">
          <p className="eyebrow">Projects</p>
          <h1 className="display mt-3 text-section">What I&rsquo;ve built</h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-[1.6] text-ink/85 sm:text-xl">
            Every project in one index, with the year it is from and the state it is in. Open any of them
            for the decisions behind it, the notes and the source.
          </p>

          {/* Facts, not controls, so they are type. A `div` rather than a `p`
              because the skeleton gate is a block. */}
          <div className="mono mt-12 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs text-[rgb(var(--ink-soft))]">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--ink-soft))]" aria-hidden="true" />
              <b className="font-medium tabular-nums text-ink">{featured.length}</b> in use
            </span>
            {archive.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  <b className="font-medium tabular-nums text-ink">{archive.length}</b> earlier
                </span>
              </>
            )}
            {lastPush ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  last push <b className="font-medium text-ink">{relativeTime(lastPush)}</b>
                </span>
              </>
            ) : (
              state === "loading" && (
                <SkeletonGate className="inline-block w-[9rem] align-baseline">
                  <SkeletonLines lines={1} tail="100%" />
                </SkeletonGate>
              )
            )}
          </div>
        </header>

        {state === "error" && (
          <p className="mt-12 max-w-[52ch] text-sm leading-relaxed text-ink/70">
            Couldn&rsquo;t reach the live index just now, so the repository facts may be missing. Every
            project is still listed below.
          </p>
        )}
      </section>

      <div className="wrap-wide pb-section">
        <RailLayout
          label="Filter projects"
          count={on}
          done={`Show ${shown.length} ${shown.length === 1 ? "project" : "projects"}`}
          bar={<FilterTokens facets={facets} selection={filters} path="/projects" />}
          rail={
            <FilterControl
              title="Filter"
              facets={facets}
              selection={filters}
              path="/projects"
              shown={shown.length}
              total={items.length}
              noun="projects"
            />
          }
        >
          {shown.length > 0 ? (
            <Gallery entries={shown} sizes={sizes} label={label} />
          ) : (
            /* Only a filter can empty the wall — `useProjects` is seeded and
               never returns nothing — so the way out is the filters' own. */
            <div className="max-w-[52ch] py-12">
              <h2 className="display-tight text-2xl">No project matches {chosen.join(" and ")}.</h2>
              <p className="mt-4 text-lg leading-relaxed">
                Take a filter off, or start again from the whole catalogue.
              </p>
              <Link
                to="/projects"
                className="tap mt-4 inline-flex min-h-[44px] items-center text-ink underline underline-offset-4"
              >
                Show every project
              </Link>
            </div>
          )}
        </RailLayout>
      </div>
    </PageShell>
  );
}
