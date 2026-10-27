import PageShell from "@/components/PageShell";
import { PROJECTS_LAYERS } from "@/components/scene/LayerStack";
import Reveal from "@/components/Reveal";
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
    <PageShell layers={PROJECTS_LAYERS}>
      <section data-crest data-hue="58 106 102" className="isolate relative mx-auto max-w-6xl px-5 pb-24 pt-24 sm:px-6 sm:pb-32 sm:pt-32 lg:pt-40">
        {/* The `.sun` wash that used to anchor this header went with the
            accent. There is a photographic plate behind the page now, which is
            the thing the glow was standing in for when there was nothing but a
            flat ground here. */}
        <header className="relative">
          <p className="eyebrow">Projects</p>
          <h1 className="display mt-4 text-section">What I&rsquo;m building</h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-[1.6] text-bone/85 sm:text-xl">
            Two things people actually use, and the trail of smaller work that got me there.
          </p>

          {/* These were three capsules, which made the count of the shelf look
              like something you could press. They are facts; facts are type. */}
          <p className="mono mt-7 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs text-clay">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-clay" aria-hidden="true" />
              <b className="font-medium tabular-nums text-bone">{featured.length}</b> in use
            </span>
            {archive.length > 0 && (
              <>
                <span aria-hidden="true" className="text-clay/50">
                  ·
                </span>
                <span>
                  <b className="font-medium tabular-nums text-bone">{archive.length}</b> earlier
                </span>
              </>
            )}
            {lastPush && (
              <>
                <span aria-hidden="true" className="text-clay/50">
                  ·
                </span>
                <span>
                  last push <b className="font-medium text-bone">{relativeTime(lastPush)}</b>
                </span>
              </>
            )}
          </p>
        </header>

        <p className="sr-only" role="status">
          {state === "loading" ? "Loading projects" : `${items.length} projects`}
        </p>

        {state === "error" && (
          <p className="mt-10 max-w-[52ch] text-sm leading-relaxed text-bone/70">
            Couldn&rsquo;t reach the live index just now, so the repository facts below may be missing. The
            work itself is all here.
          </p>
        )}

        {/* No skeleton and no empty state here, and nothing to guard against:
            `useProjects` is seeded from the project table, so the list is
            populated on the first paint and `items.length === 0` is not a
            state it can produce. The two components that used to cover those
            cases were unreachable the day they were written. */}
        <div className="mt-12 space-y-6 sm:mt-16 sm:space-y-10 lg:space-y-14">
          {featured.map((entry, i) => (
            <Reveal key={entry.collection.slug} delay={Math.min(i * 70, 280)}>
              {/* The first card is above the fold on a phone, so its
                  screenshot is the LCP element and must not be lazy. */}
              <ProjectCard entry={entry} index={i} lead={i === 0} eager={i === 0} />
            </Reveal>
          ))}
        </div>

        {archive.length > 0 && (
          <section className="mt-16 sm:mt-24" aria-labelledby="archive-heading">
            <div className="rule -mx-5 sm:-mx-6" aria-hidden="true" />
            <h2 id="archive-heading" className="display-tight mt-8 text-2xl sm:text-3xl">
              Learning in public, 2024&ndash;25
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
              {archive.map((entry, i) => (
                <li className="min-w-0" key={entry.collection.slug}>
                  <Reveal delay={Math.min(i * 45, 220)} y={12}>
                    <ArchiveCard entry={entry} />
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </PageShell>
  );
}
