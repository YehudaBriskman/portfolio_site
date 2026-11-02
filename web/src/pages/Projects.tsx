import { Link, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import ProjectIndex from "@/components/projects/ProjectIndex";
import StateFilter from "@/components/projects/StateFilter";
import { filterEarnsPlace, statesOf } from "@/components/projects/catalogue";
import { useProjects } from "@/hooks/useProjects";
import { relativeTime } from "@/services/blog";

/*
 * The catalogue: every project, in a register a reader can run down.
 *
 * This page used to be the home page's device a second time — the pile, and
 * before that the shelf — on the argument that two ways of showing a project
 * would drift apart. The owner's call (#169) is that the two pages do not
 * have the same job: the home page's run is branding, a curated few moving
 * on a curve, and this is the full set, which has to hold four projects or
 * forty and let a reader find and open any one of them fast. So it gets its
 * own arrangement, `ProjectIndex`, and its own device, `riffle` — the
 * argument that it is not the run wearing a different hat is the ledger
 * entry in `docs/motion-contract.md`.
 *
 * The three facts in the header stay. They are the only things on this page
 * about the collection rather than about one project — how many are in use,
 * how many came before, and when anything last moved. The last of them is
 * the page's one async region: the seeds carry no repository facts, so it is
 * a skeleton until the live index answers and nothing at all if it never
 * does.
 */

export default function Projects() {
  const { items, state, featured, archive } = useProjects();
  const [params] = useSearchParams();

  const states = statesOf(items);
  const filterable = filterEarnsPlace(items.length, states);
  /* A `?state=` the register cannot offer (a stale link, or a list that has
     shrunk under the threshold) is honoured rather than silently dropped, so
     the empty state below can say so and offer the way back. */
  const active = params.get("state");
  const shown = active ? items.filter((e) => e.state === active) : items;

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

        {filterable && <StateFilter states={states} total={items.length} active={active} />}
      </section>

      <div className="wrap pb-section">
        {/* Always in the tree, so the count is announced when a filter changes
            it: a live region inserted already holding its text says nothing. */}
        <div aria-live="polite">
          {active && (
            <p className="mb-6 text-sm text-[rgb(var(--ink-soft))]">
              Showing <b className="tabular-nums text-ink">{shown.length}</b> of{" "}
              <span className="tabular-nums">{items.length}</span>
            </p>
          )}
        </div>

        {shown.length > 0 ? (
          <ProjectIndex entries={shown} label={active ? `Projects: ${active}` : "All projects"} />
        ) : (
          /* Only a filter can empty the register — `useProjects` is seeded and
             never returns nothing — so the way out is the filter's own. */
          <div className="max-w-[52ch] py-12">
            <p className="text-lg leading-relaxed">No project is in the state &ldquo;{active}&rdquo; right now.</p>
            <Link
              to="/projects"
              className="tap mt-4 inline-flex min-h-[44px] items-center text-ink underline underline-offset-4"
            >
              Show every project
            </Link>
          </div>
        )}
      </div>
    </PageShell>
  );
}
