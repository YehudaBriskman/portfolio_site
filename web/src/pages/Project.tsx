import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
/* InkWipe, not Reveal. Reveal was an IntersectionObserver that translated a
   section 26px before fading it in; the wipe is scroll-timeline driven and
   needs no observer. Its stagger props go with it: a scroll-driven animation
   ignores animation-delay outright, so a per-item delay could only ever have
   been theatre. Each item now prints when it arrives, which is the same
   sequence the stagger was imitating. */
import InkWipe from "@/components/motion/InkWipe";
import PostList from "@/components/PostList";
import ProjectMeta from "@/components/ProjectMeta";
import Shot from "@/components/projects/Shot";
import Figure from "@/components/Figure";
import Action from "@/components/ui/Action";
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
     130px tall. The border the shape used to carry is `Shot`'s own now, so
     the plate fallback and the screenshot are edged the same way. */
  const shape = "aspect-[3/2] sm:aspect-[2/1]";

  return (
    <PageShell>
      <section data-crest data-hue="88 76 148" className="wrap section-y isolate relative">
        <Action tone="text" glyph="back" to="/projects">
          Projects
        </Action>

        {/* One H1 in every state, including this one — the heading order must
            not depend on how far a fetch got. */}
        {state === "loading" && (
          <>
            <h1 className="sr-only">Loading project</h1>
            <div className="mt-12 animate-pulse-soft" aria-hidden="true">
              <div className="h-12 w-2/3 rounded-full bg-[rgb(var(--rule)_/_0.6)]" />
              <div className="mt-6 h-6 w-1/2 rounded-full bg-[rgb(var(--rule)_/_0.4)]" />
              <div className="card-shot mt-12 aspect-[3/2] bg-[rgb(var(--rule)_/_0.4)] sm:aspect-[2/1]" />
            </div>
          </>
        )}

        {state === "missing" && (
          <div className="mt-12">
            <h1 className="display text-section">Not here</h1>
            <p className="mt-6 max-w-[46ch] text-lg text-ink/85">No project at that address.</p>
            <div className="mt-12">
              <Action tone="solid" glyph="onward" to="/projects">
                See everything
              </Action>
            </div>
          </div>
        )}

        {entry && c && (
          <>
            {/* The `.sun` wash behind this header went with the accent; the
                plate stack supplies the light now. */}
            <div className="relative mt-12">
              <p className="mono flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-[rgb(var(--ink-soft))]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--ink-soft))]" aria-hidden="true" />
                {entry.status}
                {entry.year && <span className="tabular-nums">{entry.year}</span>}
              </p>
              <h1 className="display mt-3 text-[clamp(2.4rem,7vw,4.5rem)] leading-[0.94]">{c.title}</h1>
              {/* The second voice, under the name. A tagline is a phrase
                  somebody wrote, not a heading, and in the display face at the
                  accent's colour it was reading as a second, smaller title
                  competing with the real one directly above it. */}
              {c.tagline && (
                <p className="editorial mt-6 max-w-[26ch] text-[clamp(1.5rem,4.6vw,2.4rem)] text-ink">
                  {c.tagline}
                </p>
              )}
              {c.description && (
                <p className="mt-6 max-w-[52ch] text-lg leading-[1.6] text-ink/85">{c.description}</p>
              )}
            </div>

            <ProjectActions entry={entry} className="mt-12" />

            {/* Reads --vh, which useScrollProgress already publishes on <html>,
                so the drift costs no listener of its own. On the wrapper rather
                than the image: the image carries the card's hover transition and
                would lag a scroll by 0.8s.

                `sizes` is the figure's real width — `.wrap` caps the section
                at 72rem and takes a 2.5rem gutter off each side, so this is
                1072px on a wide screen. It matters more here than anywhere: this is the LCP
                element, and it was being served the 800px variant and upscaled
                by half again. */}
            <Figure
              index={1}
              caption={c.tagline || c.title}
              note={entry.year ?? undefined}
              className="mt-12"
              style={reduced ? undefined : { transform: "translate3d(0, calc(var(--vh, 0) * -14px), 0)" }}
            >
              {c.coverImage ? (
                <Shot
                  src={c.coverImage}
                  alt={`${c.title} screenshot`}
                  className={shape}
                  sizes="(min-width: 1152px) 1072px, 100vw"
                  eager
                />
              ) : (
                <Plate className={shape} title={c.title} tagline={c.tagline} tech={entry.tech} />
              )}
            </Figure>

            <ProjectMeta c={c} />

            <ProjectBrief entry={entry} className="mt-section-sm" />

            {entry.highlights.length > 0 && (
              <InkWipe as="div">
                <section className="mt-section-sm" aria-labelledby="highlights-heading">
                  <h2 id="highlights-heading" className="display-tight text-2xl sm:text-3xl">
                    Worth knowing
                  </h2>
                  {/* The landing page has always shown these and the project
                      page never did, which is the clearest single case of the
                      detail page being thinner than its own card. */}
                  <ul className="mt-6 grid gap-x-12 gap-y-6 sm:grid-cols-2">
                    {entry.highlights.map((h) => (
                      <li key={h} className="flex max-w-[46ch] gap-3.5 text-base leading-[1.55] text-ink/85">
                        <span className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--ink-soft))]" aria-hidden="true" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </section>
              </InkWipe>
            )}

            {entry.decisions.length > 0 && (
              <InkWipe as="div">
                <ProjectDecisions decisions={entry.decisions} className="mt-section-sm" />
              </InkWipe>
            )}

            <ProjectStack tech={entry.tech} className="mt-section-sm" />

            {docs.length > 0 && (
              <>
                <div className="rule bleed-x mt-section-sm" aria-hidden="true" />
                <InkWipe as="div">
                  <div className="mt-12">
                    <h2 className="display-tight text-2xl sm:text-3xl">Docs</h2>
                    <ol className="mt-6 divide-y divide-[rgb(var(--rule))] border-y border-[rgb(var(--rule))]">
                      {docs.map((p, i) => (
                        <li key={p.slug}>
                          <Link to={`/blog/${p.slug}`} className="group flex min-h-[64px] items-center gap-4 py-4">
                            <span className="mono w-6 shrink-0 text-xs tabular-nums text-[rgb(var(--ink-soft))]" aria-hidden="true">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-base text-ink underline decoration-transparent decoration-1 underline-offset-[5px] transition-[text-decoration-color] [transition-duration:var(--dur-fast)] group-hover:decoration-[rgb(var(--ink-soft))]">
                                {p.title}
                              </span>
                              {p.subtitle && <span className="mono block truncate text-xs text-[rgb(var(--ink-soft))]">{p.subtitle}</span>}
                            </span>
                            <span
                              aria-hidden="true"
                              className="mono text-xs text-[rgb(var(--ink-soft))] transition-transform [transition-duration:var(--dur-fast)] group-hover:translate-x-1"
                            >
                              →
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                </InkWipe>
              </>
            )}

            {/* The Notes block used to render its heading unconditionally and
                then apologise underneath it — "No notes on this one yet." was
                the last thing most of these pages said. A section with nothing
                in it is not information, so when the fetch has come back empty
                there is simply no section. */}
            {(posts === null || notes.length > 0) && (
              <>
                <div className="rule bleed-x mt-section-sm" aria-hidden="true" />
                <div className="mt-12">
                  <h2 className="display-tight text-2xl sm:text-3xl">Notes</h2>
                  <div className="mt-6">
                    {posts === null ? (
                      <div className="animate-pulse-soft space-y-3" aria-hidden="true">
                        <div className="h-5 w-1/2 rounded-full bg-[rgb(var(--rule)_/_0.6)]" />
                        <div className="h-4 w-2/3 rounded-full bg-[rgb(var(--rule)_/_0.4)]" />
                      </div>
                    ) : (
                      <PostList posts={notes} />
                    )}
                  </div>
                </div>
              </>
            )}

            {others.length > 0 && (
              <section className="relative mt-section-sm" aria-labelledby="elsewhere-heading">
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

            <div className="mt-section-sm">
              <Action tone="text" glyph="back" to="/projects">
                All projects
              </Action>
            </div>
          </>
        )}
      </section>
    </PageShell>
  );
}
