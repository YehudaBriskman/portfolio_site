import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { PROJECTS_LAYERS } from "@/components/scene/LayerStack";
import Reveal from "@/components/Reveal";
import PostList from "@/components/PostList";
import ProjectMeta from "@/components/ProjectMeta";
import Shot from "@/components/projects/Shot";
import Plate from "@/components/projects/Plate";
import ProjectActions from "@/components/projects/ProjectActions";
import ProjectBrief from "@/components/projects/ProjectBrief";
import ProjectDecisions from "@/components/projects/ProjectDecisions";
import ProjectStack from "@/components/projects/ProjectStack";
import ProjectRow from "@/components/projects/ProjectRow";
import { relatedTo, useProjects } from "@/hooks/useProjects";
import { blog, type PostSummary } from "@/services/blog";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const SITE_TITLE = "Yehuda Briskman · Full-stack engineer & team lead";

/* Docs and notes are the same document type on the same shelf, split by one
   tag. `Post.source` already distinguishes authored from repo-ingested content
   server-side but is not exposed publicly yet; when it is, this becomes
   `p.source === "git"` and nothing else on the page changes. */
const DOC_TAG = "doc";

/*
 * The project page.
 *
 * It used to hold strictly less than the card that linked to it: a status
 * line, a title, a two-word tagline, one sentence, a screenshot, a row of
 * chips, and a Notes heading over "No notes on this one yet." Everything that
 * argued for the work — the highlights, what was wrong before it existed, what
 * came of it, the decisions behind it — lived on the landing page or nowhere,
 * so following the link cost the reader surface instead of buying it.
 *
 * Everything below the hero is conditional on content actually existing. A
 * project with nothing written about it gets a short page, never a long one
 * made of headings with nothing under them.
 */
export default function Project() {
  const { project = "" } = useParams();
  const { items, state: listState } = useProjects();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const reduced = usePrefersReducedMotion();

  const entry = items.find((e) => e.collection.slug === project) ?? null;
  const others = relatedTo(items, project);
  const state = entry ? "ok" : listState === "loading" ? "loading" : "missing";

  useEffect(() => {
    let alive = true;
    setPosts(null);
    blog
      .posts({ collection: project })
      // A project with no shelf yet is not an error — it simply has no notes.
      .catch(() => [] as PostSummary[])
      .then((p) => alive && setPosts(p));
    return () => {
      alive = false;
    };
  }, [project]);

  useEffect(() => {
    if (!entry) return;
    document.title = `${entry.collection.title} · Yehuda Briskman`;
    return () => {
      document.title = SITE_TITLE;
    };
  }, [entry]);

  const { docs, notes } = useMemo(() => {
    const all = posts ?? [];
    return {
      docs: all.filter((p) => (p.tags ?? []).includes(DOC_TAG)).slice().reverse(),
      notes: all.filter((p) => !(p.tags ?? []).includes(DOC_TAG)),
    };
  }, [posts]);

  const c = entry?.collection;

  /* Near the screenshots' own 2.1:1, so the hero shows the interface rather
     than a band cut out of it. 3:2 on a phone, where 2:1 would be a letterbox
     130px tall. */
  const shape = "aspect-[3/2] border border-edge sm:aspect-[2/1]";

  return (
    <PageShell layers={PROJECTS_LAYERS}>
      <section data-crest data-hue="88 76 148" className="isolate relative mx-auto max-w-6xl px-5 pb-24 pt-24 sm:px-6 sm:pb-32 sm:pt-32 lg:pt-40">
        <Link to="/projects" className="btn btn-quiet -ml-1 text-clay">
          <span aria-hidden="true">←</span> Projects
        </Link>

        {/* One H1 in every state, including this one — the heading order must
            not depend on how far a fetch got. */}
        {state === "loading" && (
          <>
            <h1 className="sr-only">Loading project</h1>
            <div className="mt-10 animate-pulse-soft" aria-hidden="true">
              <div className="h-12 w-2/3 rounded-full bg-edge/40" />
              <div className="mt-5 h-6 w-1/2 rounded-full bg-edge/25" />
              <div className="card-shot mt-10 aspect-[3/2] bg-edge/25 sm:aspect-[2/1]" />
            </div>
          </>
        )}

        {state === "missing" && (
          <div className="mt-12">
            <h1 className="display text-section">Not here</h1>
            <p className="mt-5 max-w-[46ch] text-lg text-bone/85">No project at that address.</p>
            <Link to="/projects" className="btn btn-solid mt-8">
              See everything <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}

        {entry && c && (
          <>
            <div className="relative mt-8">
              <div
                className="sun -z-10 -left-20 -top-24 h-[320px] w-[320px] sm:h-[440px] sm:w-[440px]"
                aria-hidden="true"
              />
              <p className="mono flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-clay">
                <span className="h-2 w-2 shrink-0 rounded-full bg-sodium" aria-hidden="true" />
                {entry.status}
                {entry.year && <span className="tabular-nums">{entry.year}</span>}
              </p>
              <h1 className="display mt-4 text-[clamp(2.4rem,7vw,4.5rem)] leading-[0.94]">{c.title}</h1>
              {c.tagline && (
                <p className="display-tight mt-4 max-w-[24ch] text-[clamp(1.3rem,4.2vw,2.1rem)] text-sodium">
                  {c.tagline}
                </p>
              )}
              {c.description && (
                <p className="mt-6 max-w-[52ch] text-lg leading-[1.6] text-bone/85">{c.description}</p>
              )}
            </div>

            <ProjectActions entry={entry} className="mt-8" />

            {/* Reads --vh, which useScrollProgress already publishes on <html>,
                so the drift costs no listener of its own. On the wrapper rather
                than the image: the image carries the card's hover transition and
                would lag a scroll by 0.8s.

                `sizes` is the figure's real width — the section is capped at
                max-w-6xl and padded, so this is a little over 1100px on a wide
                screen. It matters more here than anywhere: this is the LCP
                element, and it was being served the 800px variant and upscaled
                by half again. */}
            <figure
              className="m-0 mt-10 sm:mt-14"
              style={reduced ? undefined : { transform: "translate3d(0, calc(var(--vh, 0) * -14px), 0)" }}
            >
              {c.coverImage ? (
                <Shot
                  src={c.coverImage}
                  alt={`${c.title} screenshot`}
                  className={shape}
                  sizes="(min-width: 1152px) 1104px, 100vw"
                  eager
                />
              ) : (
                <Plate className={shape} title={c.title} tagline={c.tagline} tech={entry.tech} />
              )}
            </figure>

            <ProjectMeta c={c} />

            <ProjectBrief entry={entry} className="mt-12 sm:mt-16" />

            {entry.highlights.length > 0 && (
              <Reveal>
                <section className="mt-14 sm:mt-20" aria-labelledby="highlights-heading">
                  <h2 id="highlights-heading" className="display-tight text-2xl sm:text-3xl">
                    Worth knowing
                  </h2>
                  {/* The landing page has always shown these and the project
                      page never did, which is the clearest single case of the
                      detail page being thinner than its own card. */}
                  <ul className="mt-7 grid gap-x-10 gap-y-5 sm:grid-cols-2">
                    {entry.highlights.map((h) => (
                      <li key={h} className="flex max-w-[46ch] gap-3.5 text-base leading-[1.55] text-bone/85">
                        <span className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-sodium" aria-hidden="true" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>
            )}

            {entry.decisions.length > 0 && (
              <Reveal>
                <ProjectDecisions decisions={entry.decisions} className="mt-14 sm:mt-20" />
              </Reveal>
            )}

            <ProjectStack tech={entry.tech} className="mt-14 sm:mt-20" />

            {docs.length > 0 && (
              <>
                <div className="rule -mx-5 mt-14 sm:-mx-6 sm:mt-20" aria-hidden="true" />
                <Reveal>
                  <div className="mt-8">
                    <h2 className="display-tight text-2xl sm:text-3xl">Docs</h2>
                    <ol className="mt-6 divide-y divide-edge border-y border-edge">
                      {docs.map((p, i) => (
                        <li key={p.slug}>
                          <Link to={`/blog/${p.slug}`} className="group flex min-h-[64px] items-center gap-4 py-4">
                            <span className="mono w-6 shrink-0 text-xs tabular-nums text-clay" aria-hidden="true">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-base text-bone transition-colors group-hover:text-sodium">
                                {p.title}
                              </span>
                              {p.subtitle && <span className="mono block truncate text-xs text-clay">{p.subtitle}</span>}
                            </span>
                            <span
                              aria-hidden="true"
                              className="mono text-xs text-clay transition-transform [transition-duration:var(--dur-fast)] group-hover:translate-x-1"
                            >
                              →
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                </Reveal>
              </>
            )}

            {/* The Notes block used to render its heading unconditionally and
                then apologise underneath it — "No notes on this one yet." was
                the last thing most of these pages said. A section with nothing
                in it is not information, so when the fetch has come back empty
                there is simply no section. */}
            {(posts === null || notes.length > 0) && (
              <>
                <div className="rule -mx-5 mt-14 sm:-mx-6 sm:mt-20" aria-hidden="true" />
                <div className="mt-8">
                  <h2 className="display-tight text-2xl sm:text-3xl">Notes</h2>
                  <div className="mt-6">
                    {posts === null ? (
                      <div className="animate-pulse-soft space-y-3" aria-hidden="true">
                        <div className="h-5 w-1/2 rounded-full bg-edge/40" />
                        <div className="h-4 w-2/3 rounded-full bg-edge/25" />
                      </div>
                    ) : (
                      <PostList posts={notes} />
                    )}
                  </div>
                </div>
              </>
            )}

            {others.length > 0 && (
              <section className="relative mt-20 sm:mt-28" aria-labelledby="elsewhere-heading">
                <h2 id="elsewhere-heading" className="display-tight text-2xl sm:text-3xl">
                  Elsewhere
                </h2>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {others.map((o) => (
                    <li key={o.collection.slug}>
                      <ProjectRow entry={o} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Link to="/projects" className="btn btn-quiet mt-12 w-full">
              <span aria-hidden="true">←</span> All projects
            </Link>
          </>
        )}
      </section>
    </PageShell>
  );
}
