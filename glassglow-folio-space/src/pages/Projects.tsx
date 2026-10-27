import PageShell from "@/components/PageShell";
import { PROJECTS_LAYERS } from "@/components/scene/LayerStack";
import Reveal from "@/components/Reveal";
import ProjectCard from "@/components/projects/ProjectCard";
import ProjectRow from "@/components/projects/ProjectRow";
import CardSkeleton from "@/components/projects/CardSkeleton";
import EmptyProjects from "@/components/projects/EmptyProjects";
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
        {/* Scoped to the header rather than the section: anchored to the foot of
            a 4000px page the ridgeline sat behind the last card, where it was
            both invisible and a legibility risk. */}
        <header className="relative">
          <div
            className="sun -z-10 -left-24 -top-16 h-[300px] w-[300px] sm:-left-10 sm:h-[460px] sm:w-[460px]"
            aria-hidden="true"
          />

          <p className="eyebrow">Projects</p>
          <h1 className="display mt-4 text-section">What I&rsquo;m building</h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-[1.6] text-bone/85 sm:text-xl">
            Two things people actually use, and the trail of smaller work that got me there.
          </p>

          <div className="rail mt-7">
            <span className="chip chip-hot">
              <span className="h-1.5 w-1.5 rounded-full bg-sodium" aria-hidden="true" />
              <b>{featured.length}</b> in use
            </span>
            {archive.length > 0 && (
              <span className="chip">
                <b>{archive.length}</b> earlier
              </span>
            )}
            {lastPush && (
              <span className="chip">
                last push <b>{relativeTime(lastPush)}</b>
              </span>
            )}
          </div>
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

        {items.length === 0 ? (
          state === "loading" ? (
            <div className="mt-12 space-y-6" aria-hidden="true">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <EmptyProjects />
          )
        ) : (
          <>
            <div className="mt-12 space-y-6 sm:mt-16 sm:space-y-10 lg:space-y-14">
              {featured.map((entry, i) => (
                <Reveal key={entry.collection.slug} delay={Math.min(i * 70, 280)}>
                  {/* The first card is above the fold on a phone, so its
                      screenshot is the LCP element and must not be lazy. */}
                  <ProjectCard entry={entry} index={i} eager={i === 0} />
                </Reveal>
              ))}
            </div>

            {archive.length > 0 && (
              <>
                <div className="-mx-5 mt-16 sm:-mx-6 sm:mt-24">
                </div>
                <div className="mt-6">
                  <p className="eyebrow">Learning in public, 2024&ndash;25</p>
                  <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {archive.map((entry, i) => (
                      <li className="min-w-0" key={entry.collection.slug}>
                        <Reveal delay={Math.min(i * 45, 220)} y={12}>
                          <ProjectRow entry={entry} />
                        </Reveal>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </PageShell>
  );
}
