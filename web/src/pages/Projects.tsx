import PageShell from "@/components/PageShell";
/* InkWipe, not Reveal. Reveal was an IntersectionObserver that translated a
   section 26px before fading it in; the wipe is scroll-timeline driven and
   needs no observer. Its stagger props go with it: a scroll-driven animation
   ignores animation-delay outright, so a per-item delay could only ever have
   been theatre. Each item now prints when it arrives, which is the same
   sequence the stagger was imitating. */
import InkWipe from "@/components/motion/InkWipe";
import ProjectCard from "@/components/projects/ProjectCard";
import ArchiveCard from "@/components/projects/ArchiveCard";
import { useProjects } from "@/hooks/useProjects";
import { relativeTime } from "@/services/blog";

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
        {/* The `.sun` wash that used to anchor this header went with the
            accent, and nothing replaces it: the page is paper and the cards
            on it are objects with their own edges and shadows, which is what
            the glow was standing in for. */}
        <header className="relative">
          <p className="eyebrow">Projects</p>
          <h1 className="display mt-3 text-section">What I&rsquo;m building</h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-[1.6] text-ink/85 sm:text-xl">
            Two things people actually use, and the trail of smaller work that got me there.
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
            state it can produce. The two components that used to cover those
            cases were unreachable the day they were written. */}
        <div className="mt-12 space-y-6">
          {featured.map((entry, i) => (
            <InkWipe key={entry.collection.slug} as="div">
              {/* The first card is above the fold on a phone, so its
                  screenshot is the LCP element and must not be lazy. */}
              <ProjectCard entry={entry} index={i} lead={i === 0} eager={i === 0} />
            </InkWipe>
          ))}
        </div>

        {archive.length > 0 && (
          <section className="mt-section-sm" aria-labelledby="archive-heading">
            <div className="rule bleed-x" aria-hidden="true" />
            <h2 id="archive-heading" className="display-tight mt-12 text-2xl sm:text-3xl">
              Learning in public, 2024&ndash;25
            </h2>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2">
              {archive.map((entry, i) => (
                <li className="min-w-0" key={entry.collection.slug}>
                  <InkWipe as="div">
                    {/* Plate numbers run on from the featured cards, so the
                      page is one numbered series rather than two. */}
                  <ArchiveCard entry={entry} index={featured.length + i + 1} />
                  </InkWipe>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </PageShell>
  );
}
