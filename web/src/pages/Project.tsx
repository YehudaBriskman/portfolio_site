import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, FileText, NotebookPen, Tag } from "lucide-react";
import PageShell from "@/components/PageShell";
import Written from "@/components/motion/Written";
/* InkWipe, not Reveal. Reveal was an IntersectionObserver that translated a
   section 26px before fading it in; the wipe is scroll-timeline driven and
   needs no observer. Its stagger props go with it: a scroll-driven animation
   ignores animation-delay outright, so a per-item delay could only ever have
   been theatre. Each item now prints when it arrives, which is the same
   sequence the stagger was imitating. */
import InkWipe from "@/components/motion/InkWipe";
import PostList from "@/components/PostList";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";
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
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { relatedTo, useProjects } from "@/hooks/useProjects";
import { blog, type PostSummary } from "@/services/blog";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { activity, type ActivityEvent } from "@/services/activity";
import Tabs from "@/components/work/Tabs";
import tabStyles from "@/components/work/Tabs.module.css";
import { panelId, readTab, tabId, type Tab } from "@/components/work/order";
import { useWorkWords } from "@/components/work/words";
import { fullDate, relative, shortDate } from "@/components/dashboard/i18n";
import { useScrollProgress } from "@/hooks/useScrollProgress";

/* Docs and notes are the same document type on the same shelf, split by one
   tag. `Post.source` already distinguishes authored from repo-ingested content
   server-side but is not exposed publicly yet; when it is, this becomes
   `p.source === "git"` and nothing else on the page changes. The repository
   paths a collection may publish from (`repo.docPaths`) stay private on
   purpose; what they produced is public, and that is what the Docs tab lists. */
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
 *
 * TABS (#227). Under the name, as on a GitHub repository: Overview (all of
 * the above, unchanged), Notes, Releases and Docs. The tab is `?tab=` in the
 * URL, replaced rather than pushed (Back leaves the project rather than
 * stepping through its tabs), and Overview is no parameter, so every old
 * link still lands where it did. The tabs are the APG pattern
 * (`work/Tabs.tsx`). Notes links on to the area's own history page rather
 * than rebuilding it here: #225 is that page.
 */
export default function Project() {
  /* The only page with a --vh reader: the figure drift below, which is also
     where it is written. See the hook. */
  const drift = useRef<HTMLDivElement>(null);
  useScrollProgress(drift);

  const { project = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { items, state: listState } = useProjects();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [releases, setReleases] = useState<ActivityEvent[] | null>(null);
  const [releasesError, setReleasesError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reduced = usePrefersReducedMotion();
  const [t, lang] = useWorkWords();
  const idBase = useId();
  const [now] = useState(() => Date.now());

  const entry = items.find((e) => e.collection.slug === project) ?? null;
  const others = relatedTo(items, project);
  const state = entry ? "ok" : listState === "loading" ? "loading" : "missing";
  const tab = readTab(params);

  /* Another project's notes are cleared in the render that changes project,
     not an effect later; a retry clears the releases the same way. */
  const [postsFor, setPostsFor] = useState(project);
  if (postsFor !== project) {
    setPostsFor(project);
    setPosts(null);
  }
  const [releasesFor, setReleasesFor] = useState(`${project}:${attempt}`);
  if (releasesFor !== `${project}:${attempt}`) {
    setReleasesFor(`${project}:${attempt}`);
    setReleases(null);
    setReleasesError(false);
  }
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
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
    let alive = true;
    activity
      .page({ area: project, kind: "release", limit: 20 })
      .then((p) => alive && setReleases(p.items))
      .catch(() => alive && setReleasesError(true));
    return () => {
      alive = false;
    };
  }, [project, attempt]);

  /*
   * The tab title, from the live collection rather than from the URL.
   *
   * `lib/pageTitle.ts` already resolves `/projects/icaros` to "Icaros" out of
   * the seed table, so this is only an improvement in the one case the seed
   * cannot cover: a published collection with a slug the table does not hold,
   * or one whose title has been edited since. It is kept for that case, and
   * because the title should come from the same object the `h1` does.
   *
   * What went: the cleanup. It restored the home page's title on unmount, so
   * every page reached *from* a project page started life titled as the home
   * page — the same bug, caused by the attempt to be tidy about it. Nothing
   * needs restoring now that every route change writes a title of its own.
   */
  useDocumentTitle(state === "missing" ? "Not found" : (entry?.collection.title ?? null));

  const { docs, notes } = useMemo(() => {
    const all = posts ?? [];
    return {
      docs: all.filter((p) => (p.tags ?? []).includes(DOC_TAG)).slice().reverse(),
      notes: all.filter((p) => !(p.tags ?? []).includes(DOC_TAG)),
    };
  }, [posts]);

  const c = entry?.collection;

  /* The repository's latest release stands in for the feed while the feed is
     loading or down, so the tab is never emptier than the card was. */
  const fromStats = c?.stats?.latestRelease;
  const releaseRows: { id: string; tag: string; at: string | null; href: string }[] =
    releases && releases.length > 0
      ? releases.map((e) => ({ id: e.id, tag: String(e.meta.tag ?? e.title), at: e.at, href: e.href }))
      : fromStats
        ? [{ id: "stats", tag: fromStats.tag, at: fromStats.publishedAt, href: fromStats.url }]
        : [];

  const selectTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === "overview") p.delete("tab");
    else p.set("tab", next);
    setParams(p, { replace: true, preventScrollReset: true });
  };

  /* Near the screenshots' own 2.1:1, so the hero shows the interface rather
     than a band cut out of it. 3:2 on a phone, where 2:1 would be a letterbox
     130px tall. The border the shape used to carry is `Shot`'s own now, so
     the plate fallback and the screenshot are edged the same way. */
  const shape = "aspect-[3/2] sm:aspect-[2/1]";

  const panel = (key: Tab) => ({
    role: "tabpanel" as const,
    id: panelId(idBase, key),
    "aria-labelledby": tabId(idBase, key),
    tabIndex: 0,
    className: tabStyles.panel,
  });

  return (
    <PageShell>
      <section data-crest data-hue="88 76 148" className="wrap section-y isolate relative">
        <Action tone="text" glyph="back" to="/projects">
          {t.backToWork}
        </Action>

        {/* One H1 in every state, including this one — the heading order must
            not depend on how far a fetch got. */}
        {state === "loading" && (
          <>
            <h1 className="sr-only">Loading project</h1>
            <div className="mt-12 scrub-pulse" aria-hidden="true">
              <div className="h-12 w-2/3 rounded-full bg-[rgb(var(--rule)_/_0.6)]" />
              <div className="mt-6 h-6 w-1/2 rounded-full bg-[rgb(var(--rule)_/_0.4)]" />
              <div className="mt-12 h-11 w-full border-b border-[rgb(var(--rule))]" />
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
            </div>

            <div className="mt-12">
              <Tabs
                label={t.tabs}
                idBase={idBase}
                selected={tab}
                onSelect={selectTab}
                tabs={[
                  { key: "overview", label: t.tab.overview, icon: <BookOpen /> },
                  { key: "notes", label: t.tab.notes, count: posts ? notes.length : null, icon: <NotebookPen /> },
                  { key: "releases", label: t.tab.releases, count: releaseRows.length || null, icon: <Tag /> },
                  { key: "docs", label: t.tab.docs, count: posts ? docs.length : null, icon: <FileText /> },
                ]}
              />
            </div>

            {tab === "overview" && (
              <div {...panel("overview")}>
                {c.description && (
                  <Written className="max-w-[52ch] text-lg leading-[1.6] text-ink/85">{c.description}</Written>
                )}

                <ProjectActions entry={entry} className="mt-12" />

                {/* `sizes` is the figure's real width — `.wrap` caps the section
                    at 72rem and takes a 2.5rem gutter off each side, so this is
                    1072px on a wide screen. It matters more here than anywhere: this is the LCP
                    element, and it was being served the 800px variant and upscaled
                    by half again. */}
                {/* The drift's own box: `--vh` is written here and read here, so
                    a scroll re-styles this figure and not the document (#174). */}
                <div
                  ref={drift}
                  className="mt-12"
                  style={reduced ? undefined : { transform: "translate3d(0, calc(var(--vh, 0) * -14px), 0)" }}
                >
                  <Figure index={1} caption={c.tagline || c.title} note={entry.year ?? undefined}>
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
                </div>

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
              </div>
            )}

            {tab === "notes" && (
              <div {...panel("notes")} aria-busy={posts === null}>
                <h2 className="sr-only">{t.tab.notes}</h2>
                {posts === null ? (
                  /* The same two-column grid `PostList` renders, one row of it
                     reserved, in the card's own type steps
                     (`gallery/SkeletonLines.tsx`). */
                  <SkeletonGate className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="note-card">
                        <div className="flex flex-col p-6">
                          <div className="mono -my-1 flex min-h-11 flex-wrap items-center text-[0.75rem]">
                            <SkeletonLines lines={1} tail="7.5rem" />
                          </div>
                          <div className="mt-3 display-tight text-[1.375rem] sm:text-2xl">
                            <SkeletonLines lines={2} />
                          </div>
                          <div className="mt-3 text-[0.9375rem] leading-[1.65]">
                            <SkeletonLines lines={1} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </SkeletonGate>
                ) : notes.length > 0 ? (
                  <PostList posts={notes} />
                ) : (
                  <p className={tabStyles.empty}>{entry.live ? t.noNotesLive : t.noNotes}</p>
                )}
                {entry.live && (
                  <Link to={`/blog/area/${c.slug}`} className={tabStyles.onward}>
                    {t.areaHistory}
                    <span aria-hidden="true" className={tabStyles.flip}>
                      &nbsp;→
                    </span>
                  </Link>
                )}
              </div>
            )}

            {tab === "releases" && (
              <div {...panel("releases")} aria-busy={releases === null && !releasesError}>
                <h2 className="sr-only">{t.tab.releases}</h2>
                <p className={tabStyles.panelLede}>{t.releasesFrom}</p>
                {releasesError && releaseRows.length === 0 ? (
                  <p className={tabStyles.empty} role="alert">
                    {t.releasesFailed}
                    <button type="button" className={tabStyles.retry} onClick={retry}>
                      {t.retry}
                    </button>
                  </p>
                ) : releases === null && releaseRows.length === 0 ? (
                  <SkeletonGate className={tabStyles.rows}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={tabStyles.row}>
                        <SkeletonLines lines={1} tail="40%" />
                      </div>
                    ))}
                  </SkeletonGate>
                ) : releaseRows.length === 0 ? (
                  <p className={tabStyles.empty}>{t.noReleasesHere}</p>
                ) : (
                  <ol className={tabStyles.rows}>
                    {releaseRows.map((r, i) => (
                      <li key={r.id}>
                        <a className={tabStyles.row} href={r.href} rel="noopener noreferrer">
                          <span className={tabStyles.rowTitle}>
                            <span className={tabStyles.tagName} dir="ltr" translate="no">
                              {r.tag}
                            </span>
                          </span>
                          {i === 0 && <span className={tabStyles.latest}>{t.latest}</span>}
                          {r.at && (
                            <time className={tabStyles.rowMeta} dateTime={r.at} title={fullDate(r.at, lang)}>
                              {`${shortDate(r.at, lang)} · ${relative(r.at, now, lang)}`}
                            </time>
                          )}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
                {c.repoUrl && (
                  <a href={`${c.repoUrl}/releases`} className={tabStyles.onward} rel="noopener noreferrer">
                    {t.onGitHub}
                  </a>
                )}
              </div>
            )}

            {tab === "docs" && (
              <div {...panel("docs")} aria-busy={posts === null}>
                <h2 className="sr-only">{t.tab.docs}</h2>
                <p className={tabStyles.panelLede}>{t.docsFrom}</p>
                {posts === null ? (
                  <SkeletonGate className={tabStyles.rows}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={tabStyles.row}>
                        <SkeletonLines lines={1} tail="55%" />
                      </div>
                    ))}
                  </SkeletonGate>
                ) : docs.length === 0 ? (
                  <p className={tabStyles.empty}>{t.noDocs}</p>
                ) : (
                  <ol className={tabStyles.rows}>
                    {docs.map((p) => (
                      <li key={p.slug}>
                        <Link to={`/blog/${p.slug}`} className={tabStyles.row}>
                          <span className={tabStyles.rowTitle}>{p.title}</span>
                          {p.subtitle && <span className={tabStyles.rowMeta}>{p.subtitle}</span>}
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            <div className="mt-section-sm">
              <Action tone="text" glyph="back" to="/projects">
                {t.backToWork}
              </Action>
            </div>
          </>
        )}
      </section>
    </PageShell>
  );
}
