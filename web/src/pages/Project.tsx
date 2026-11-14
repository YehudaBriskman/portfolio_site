import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowUpRight, BookMarked, BookOpen, Code2, FileText, FolderGit2, GitFork, NotebookPen, Rss, Star, Tag } from "lucide-react";
import { heldHeight, useRememberHeight } from "@/lib/heldHeight";
import PageShell from "@/components/PageShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { OwnerCard, Row, RowList, ViewNav } from "@/components/dashboard/Parts";
import { ListSkeleton, RowsSkeleton } from "@/components/dashboard/Skeletons";
import { RepoFacts } from "@/components/dashboard/History";
import dash from "@/components/dashboard/Dashboard.module.css";
import history from "@/components/dashboard/History.module.css";
import Written from "@/components/motion/Written";
/* Arrive, not InkWipe (#251): the wipe covered the text with a clip and a
   coloured band while it ran; an arrival only moves the block the last 12px
   and draws a ring by its heading. See motion/Arrive.tsx. */
import Arrive from "@/components/motion/Arrive";
import Ring from "@/components/motion/Ring";
import HeadStrand from "@/components/motion/HeadStrand";
import PostList from "@/components/PostList";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import Shot from "@/components/projects/Shot";
import Figure from "@/components/Figure";
import Plate from "@/components/projects/Plate";
import ProjectBrief from "@/components/projects/ProjectBrief";
import ProjectDecisions from "@/components/projects/ProjectDecisions";
import ProjectStack from "@/components/projects/ProjectStack";
import { kindOf } from "@/components/projects/catalogue";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { relatedTo, useProjects } from "@/hooks/useProjects";
import { blog, type PostSummary } from "@/services/blog";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { activity, areaFeedUrl, type ActivityEvent } from "@/services/activity";
import Tabs from "@/components/work/Tabs";
import tabStyles from "@/components/work/Tabs.module.css";
import work from "@/components/work/Work.module.css";
import styles from "@/pages/Project.module.css";
import { isPinned, panelId, readTab, tabId, type Tab } from "@/components/work/order";
import { stateWord, useWorkWords } from "@/components/work/words";
import { fullDate, relative, shortDate } from "@/components/dashboard/i18n";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { useProjectWords } from "@/i18n/pages";
import AvatarCircle from "@/components/phone/AvatarCircle";
import PillBadge from "@/components/phone/PillBadge";
import ListRow from "@/components/phone/ListRow";
import GroupedSection from "@/components/phone/GroupedSection";
import PinnedAction from "@/components/phone/PinnedAction";
import { StatGrid, StatTile } from "@/components/phone/StatTile";
import { toneOfKind } from "@/components/phone/tone";
import { useHistoryWords } from "@/components/dashboard/historyWords";
import { count as countFmt } from "@/components/dashboard/i18n";
import ShareMenu from "@/components/share/ShareMenu";
import { inEnglish } from "@/i18n/words";

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
 *
 * THE DASHBOARD (#242). The page now stands on the same dark shell as
 * /projects, /blog, an area and the log (`dashboard/DashboardShell.tsx`),
 * as a GitHub repository page does under GitHub's own chrome:
 *
 *   rail    the owner; the way back to all of Work; the pinned projects,
 *           this one marked as the current page.
 *   middle  the header (Work / name, the status pill, the tagline, and the
 *           outbound links as the dashboard's buttons: exactly one primary,
 *           as before), the tabs, and the panel. Overview is the content it
 *           always was, re-laid in bordered cards in the same order.
 *   aside   About: the repository's facts from the stored stats, each
 *           stamped "as of" the scheduled read (`RepoFacts`, the area
 *           header's, reused rather than a second copy), and the ways on:
 *           the area's notes, the repository, the area's feed.
 *
 * The facts used to be a fourth row of display type in the Overview
 * (`ProjectMeta`); they are said once now, in the aside, and the latest
 * release is left out of them there because the header's Release button
 * already says it.
 *
 * MOTION. The Overview keeps the devices it had: the description and the
 * brief and decisions are `Written`, the cards under the figure arrive
 * through `Arrive` with a `Ring` by their heading (#251), and the figure
 * keeps its drift. Everything else on the
 * shell has none (`docs/motion-contract.md`).
 */
export default function Project() {
  /* The only page with a --vh reader: the figure drift below, which is also
     where it is written. See the hook. */
  const drift = useRef<HTMLDivElement>(null);
  useScrollProgress(drift);

  const { project = "" } = useParams();
  const [params] = useSearchParams();
  const { items, state: listState } = useProjects();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [releases, setReleases] = useState<ActivityEvent[] | null>(null);
  const [releasesError, setReleasesError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reduced = usePrefersReducedMotion();
  const [t, lang] = useWorkWords();
  const w = useProjectWords();
  const [hw] = useHistoryWords();
  const idBase = useId();
  const [now] = useState(() => Date.now());

  /* A seed is only a fallback for a failed fetch. Its links, order and facts
     differ from the published collection's, so painting it first and swapping
     moved the head, the tabbed card and the side list on arrival (CLS 0.15).
     Until the list has answered, a seed-backed slug is "loading", not "ok". */
  const found = items.find((e) => e.collection.slug === project) ?? null;
  const entry = found && (found.live || listState !== "loading") ? found : null;
  const others = relatedTo(items, project);
  const state = entry ? "ok" : listState === "loading" ? "loading" : "missing";
  const location = useLocation();
  const navigate = useNavigate();
  const requested = readTab(params, location.hash);
  useRememberHeight(`project:${project}`, state === "ok");

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
  useDocumentTitle(state === "missing" ? w.notFound : (entry?.collection.title ?? null));

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

  /* A tab with nothing in it is not offered. Docs is empty on every project
     today and Releases on most, and an empty panel is a dead end the tab
     strip should not lead to. Until the list is known the tab stays offered
     only when the URL asked for it, so a deep link does not lose its tab
     to a request still in flight. */
  const docsKnown = posts !== null;
  const releasesKnown = releases !== null || releasesError;
  const showDocs = docsKnown ? docs.length > 0 : requested === "docs";
  const showReleases = releasesKnown || releaseRows.length > 0 ? releaseRows.length > 0 : requested === "releases";
  const offered: Tab[] = [
    "overview",
    "notes",
    ...(showReleases ? (["releases"] as const) : []),
    ...(showDocs ? (["docs"] as const) : []),
  ];
  const tab: Tab = offered.includes(requested) ? requested : "overview";

  /* `#docs` is read as `?tab=docs` and then rewritten to it, so the hash
     cannot come back and outvote the parameter after the reader changes tab. */
  useEffect(() => {
    if (!location.hash || params.has("tab") || readTab(params, location.hash) === "overview") return;
    const p = new URLSearchParams(params);
    p.set("tab", readTab(params, location.hash));
    navigate({ pathname: location.pathname, search: `?${p}`, hash: "" }, { replace: true, preventScrollReset: true });
  }, [location.hash, location.pathname, params, navigate]);

  const selectTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === "overview") p.delete("tab");
    else p.set("tab", next);
    const search = p.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "", hash: "" },
      { replace: true, preventScrollReset: true },
    );
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
    className: `${tabStyles.panel} ${styles.panel}`,
  });

  /* ── the rail: who, the way back, and the pinned projects ──────────── */
  const pinned = items.filter(isPinned);
  const pinsId = `${idBase}-pins`;
  const rail = (
    <>
      <OwnerCard />
      <ViewNav
        label={t.backToWork}
        views={[{ key: "work", label: t.allWork, to: "/projects", icon: <FolderGit2 />, current: false }]}
      />
      {pinned.length > 0 && (
        <nav className={work.pins} aria-labelledby={pinsId}>
          <h2 id={pinsId} className={dash.railTitle}>
            {t.pinned}
          </h2>
          <ul className={work.pinList}>
            {pinned.map((e) => (
              <li key={e.collection.slug}>
                <Link
                  to={`/projects/${e.collection.slug}`}
                  className={`${work.pinItem} ${styles.pinItem}`}
                  aria-current={e.collection.slug === project ? "page" : undefined}
                >
                  {/* The project on screen is circled (#251), as the rail's
                      current view is; same box either way. */}
                  <span className={styles.pinIcon} aria-hidden="true">
                    {e.collection.slug === project ? (
                      <Ring size={24} draw={false}>
                        <BookMarked size={16} />
                      </Ring>
                    ) : (
                      <BookMarked size={16} />
                    )}
                  </span>
                  <span className={work.pinLabel} translate="no">
                    {e.collection.title}
                  </span>
                  <span className={work.pinState}>{stateWord(e.state, lang)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );

  /* ── the aside: About, GitHub's place for the facts ────────────────── */
  const aboutId = `${idBase}-about`;
  const aside = (
    <div className={history.side}>
      <section className={history.sideCard} aria-labelledby={aboutId}>
        <h2 id={aboutId} className={history.sideTitle}>
          <Ring size={10} />
          {t.about}
        </h2>
        {!c ? (
          <ListSkeleton lines={3} />
        ) : (
          <>
            {c.stats && (
              /* The release is the header's button; said once. */
              <RepoFacts stats={{ ...c.stats, latestRelease: null }} repoUrl={c.repoUrl} />
            )}
            <ul className={history.sideLinks}>
              {entry?.live && (
                <li>
                  <Link to={`/blog/area/${c.slug}`} className={history.sideLink} data-primary="">
                    <NotebookPen aria-hidden="true" />
                    {t.areaNotes}
                    <span aria-hidden="true" className={styles.arrow}>
                      →
                    </span>
                  </Link>
                </li>
              )}
              {c.repoUrl && (
                <li>
                  <a href={c.repoUrl} className={history.sideLink} rel="noopener noreferrer">
                    <ArrowUpRight aria-hidden="true" />
                    {t.repository}
                    <span className={history.sideUrl} dir="ltr" translate="no">
                      {c.repoUrl.replace(/^https:\/\/github\.com\//, "")}
                    </span>
                  </a>
                </li>
              )}
              {entry?.live && (
                <li>
                  <a href={areaFeedUrl(c.slug)} className={history.sideLink} type="application/rss+xml">
                    <Rss aria-hidden="true" />
                    {t.feed}
                  </a>
                </li>
              )}
            </ul>
          </>
        )}
      </section>
    </div>
  );

  /* ── the header: Work / name, pill, tagline, the outbound buttons ──── */
  const release = c?.stats?.latestRelease ?? null;
  const repoIsPrimary = Boolean(entry && !entry.primaryLink && c?.repoUrl);
  const head =
    entry && c ? (
      <header className={styles.head} data-phone-card="header">
        <div className={styles.nameLine}>
          <AvatarCircle size={56} tone={toneOfKind(kindOf(entry.state))}>
            <BookMarked className={styles.nameIcon} size={20} aria-hidden="true" />
          </AvatarCircle>
          <Link to="/projects" className={styles.crumb}>
            {t.backToWork}
          </Link>
          <span className={styles.slash} aria-hidden="true">
            /
          </span>
          <h1 className={styles.title} translate="no">
            {c.title}
          </h1>
          <PillBadge
            className={`${work.pill} ${styles.pill}`}
            dataKind={kindOf(entry.state)}
            tone={toneOfKind(kindOf(entry.state))}
          >
            {stateWord(entry.state, lang)}
            {entry.year && <span className={styles.num}>{entry.year}</span>}
          </PillBadge>
          <span className={`ms-auto ${styles.share}`}>
            <ShareMenu kind="project" entity={{ slug: c.slug, title: c.title, summary: c.tagline }} />
          </span>
        </div>
        <HeadStrand />
        {/* The second voice, under the name: a phrase somebody wrote, so
            not a heading. */}
        {c.tagline && <p className={styles.tagline}>{c.tagline}</p>}
        {/* Phone only. One tile per datum the repository has; a datum it
            does not have gets no tile (never a dash). */}
        <StatGrid label={t.about}>
          {[
            c.stats?.language ? (
              <StatTile key="lang" icon={<Code2 />} value={c.stats.language} label={hw.language} tone="blue" />
            ) : null,
            c.stats?.stars != null ? (
              <StatTile key="stars" icon={<Star />} value={countFmt(c.stats.stars, lang)} label={hw.stars} tone="yellow" />
            ) : null,
            c.stats?.forks != null ? (
              <StatTile key="forks" icon={<GitFork />} value={countFmt(c.stats.forks, lang)} label={hw.forks} tone="purple" />
            ) : null,
            release ? <StatTile key="rel" icon={<Tag />} value={release.tag} label={hw.release} tone="green" /> : null,
          ]}
        </StatGrid>
        {(entry.primaryLink || c.repoUrl || release || entry.otherLinks.length > 0) && (
          /* Exactly one primary: the live product if there is one,
             otherwise the repository. Two competing primaries is none. */
          <div className={dash.actions}>
            {entry.primaryLink && (
              <a
                href={entry.primaryLink.url}
                className={`${dash.button} ${styles.button}`}
                data-primary=""
                data-phone-dup=""
                rel="noopener noreferrer"
              >
                {entry.primaryLink.label}
                <ArrowUpRight aria-hidden="true" />
              </a>
            )}
            {c.repoUrl && (
              <a
                href={c.repoUrl}
                className={`${dash.button} ${styles.button}`}
                data-primary={repoIsPrimary ? "" : undefined}
                data-phone-dup={repoIsPrimary ? "" : undefined}
                rel="noopener noreferrer"
              >
                <FolderGit2 aria-hidden="true" />
                {t.source}
              </a>
            )}
            {release && (
              <a
                href={release.url}
                className={`${dash.button} ${styles.button}`}
                data-phone-dup=""
                rel="noopener noreferrer"
                title={`${t.release}: ${release.tag}`}
              >
                <Tag aria-hidden="true" />
                <span dir="ltr" translate="no">
                  {release.tag}
                </span>
              </a>
            )}
            {entry.otherLinks.map((l) => (
              <a href={l.url} className={`${dash.button} ${styles.button}`} key={l.url} rel="noopener noreferrer">
                {l.label}
                <ArrowUpRight aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
      </header>
    ) : null;

  /* The one primary action, pinned at the bottom of a phone: the live product
     if there is one, otherwise the repository: today's links and words. */
  const pin =
    entry && c
      ? entry.primaryLink
        ? { url: entry.primaryLink.url, label: entry.primaryLink.label }
        : c.repoUrl
          ? { url: c.repoUrl, label: t.source }
          : null
      : null;

  return (
    <PageShell>
      {pin && (
        <PinnedAction href={pin.url}>
          {pin.label}
          <ArrowUpRight size={18} aria-hidden="true" />
        </PinnedAction>
      )}
      <DashboardShell railLabel={t.browse} rail={rail} asideLabel={t.about} aside={aside} head={head} back={{ to: "/projects", label: t.backToWork }}>
        {/* One H1 in every state, including this one — the heading order must
            not depend on how far a fetch got. */}
        {state === "loading" && (
          <div className={styles.loading} aria-busy="true" style={{ minHeight: heldHeight(`project:${project}`) }}>
            <h1 className="sr-only">{t.loadingProject}</h1>
            <SkeletonGate className={styles.headSkeleton}>
              <SkeletonLines lines={1} tail="40%" />
              <SkeletonLines lines={1} tail="70%" />
            </SkeletonGate>
            <div className={styles.flushCard}>
              <RowsSkeleton rows={3} />
            </div>
          </div>
        )}

        {state === "missing" && (
          <div className={dash.message}>
            <h1 className={dash.messageTitle}>{t.notHere}</h1>
            <p className={dash.messageBody}>{t.notHereBody}</p>
            <div className={dash.actions}>
              <Link to="/projects" className={dash.button} data-primary="">
                {t.seeEverything}
              </Link>
            </div>
          </div>
        )}

        {entry && c && (
          <div className={styles.tabbed}>
            <Tabs
              label={t.tabs}
              idBase={idBase}
              selected={tab}
              onSelect={selectTab}
              tabs={[
                { key: "overview", label: t.tab.overview, icon: <BookOpen /> },
                { key: "notes", label: t.tab.notes, count: posts ? notes.length : null, icon: <NotebookPen /> },
                ...(showReleases
                  ? [{ key: "releases" as const, label: t.tab.releases, count: releaseRows.length || null, icon: <Tag /> }]
                  : []),
                ...(showDocs
                  ? [{ key: "docs" as const, label: t.tab.docs, count: posts ? docs.length : null, icon: <FileText /> }]
                  : []),
              ]}
            />

            {tab === "overview" && (
              <div {...panel("overview")}>
                <section className={styles.card} aria-label={c.title}>
                  {c.description && (
                    <Written className={styles.description} {...inEnglish(lang, c.description)}>
                      {c.description}
                    </Written>
                  )}
                  {/* The drift's own box: `--vh` is written here and read
                      here, so a scroll re-styles this figure and not the
                      document (#174). `sizes` is the figure's real width:
                      the middle column is capped at 62rem, less the card's
                      padding. It is the LCP element. */}
                  <div
                    ref={drift}
                    className={styles.figure}
                    style={reduced ? undefined : { transform: "translate3d(0, calc(var(--vh, 0) * -14px), 0)" }}
                  >
                    <Figure index={1} caption={c.tagline || c.title} note={entry.year ?? undefined}>
                      {c.coverImage ? (
                        <Shot
                          src={c.coverImage}
                          alt={`${c.title} screenshot`}
                          className={shape}
                          sizes="(min-width: 1280px) 960px, 100vw"
                          eager
                        />
                      ) : (
                        <Plate className={shape} title={c.title} tagline={c.tagline} tech={entry.tech} />
                      )}
                    </Figure>
                  </div>
                </section>

                {(entry.problem || entry.role || entry.outcome) && (
                  <Arrive className={styles.card}>
                    <ProjectBrief entry={entry} />
                  </Arrive>
                )}

                {entry.highlights.length > 0 && (
                  <Arrive as="section" className={styles.card} aria-labelledby="highlights-heading">
                      <h2 id="highlights-heading" className={`${styles.cardTitle} ${styles.marked}`}>
                        <Ring size={12} />
                        {w.worthKnowing}
                      </h2>
                      {/* The landing page has always shown these and the
                          project page never did, which was the clearest
                          single case of the detail page being thinner than
                          its own card. */}
                      <ul className={styles.highlights}>
                        {entry.highlights.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                  </Arrive>
                )}

                {entry.decisions.length > 0 && (
                  <Arrive className={styles.card}>
                    <ProjectDecisions decisions={entry.decisions} />
                  </Arrive>
                )}

                {entry.tech.length > 0 && (
                  <Arrive className={styles.card}>
                    <ProjectStack tech={entry.tech} />
                  </Arrive>
                )}

                {others.length > 0 && (
                  <section className={styles.flushCard} aria-labelledby="elsewhere-heading">
                    <h2 id="elsewhere-heading" className={styles.flushTitle}>
                      {w.elsewhere}
                    </h2>
                    <RowList>
                      {others.map((o) => (
                        <Row
                          key={o.collection.slug}
                          icon={<BookMarked />}
                          title={o.collection.title}
                          to={`/projects/${o.collection.slug}`}
                          meta={[o.collection.tagline, o.year]}
                        />
                      ))}
                    </RowList>
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
                  <p className={styles.empty}>{entry.live ? t.noNotesLive : t.noNotes}</p>
                )}
                {entry.live && (
                  <Link to={`/blog/area/${c.slug}`} className={styles.onward}>
                    {t.areaHistory}
                    <span aria-hidden="true" className={styles.arrow}>
                      &nbsp;→
                    </span>
                  </Link>
                )}
              </div>
            )}

            {tab === "releases" && (
              <div {...panel("releases")} aria-busy={releases === null && !releasesError}>
                <h2 className="sr-only">{t.tab.releases}</h2>
                <p className={styles.lede}>{t.releasesFrom}</p>
                {releasesError && releaseRows.length === 0 ? (
                  <div className={styles.empty} role="alert">
                    <p>{t.releasesFailed}</p>
                    <button type="button" className={dash.button} onClick={retry}>
                      {t.retry}
                    </button>
                  </div>
                ) : releases === null && releaseRows.length === 0 ? (
                  <div className={styles.flushCard}>
                    <RowsSkeleton rows={3} />
                  </div>
                ) : releaseRows.length === 0 ? (
                  <p className={styles.empty}>{t.noReleasesHere}</p>
                ) : (
                  <GroupedSection>
                  <ol className={styles.list}>
                    {releaseRows.map((r, i) => (
                      <li key={r.id}>
                        <ListRow className={styles.listRow} href={r.href} tone="green" icon={<Tag className={styles.listIcon} aria-hidden="true" />}>
                          <span className={styles.listTitle}>
                            <span className={styles.tagName} dir="ltr" translate="no">
                              {r.tag}
                            </span>
                            {i === 0 && <span className={styles.latest}>{t.latest}</span>}
                          </span>
                          {r.at && (
                            <time className={styles.listMeta} dateTime={r.at} title={fullDate(r.at, lang)}>
                              {`${shortDate(r.at, lang)} · ${relative(r.at, now, lang)}`}
                            </time>
                          )}
                        </ListRow>
                      </li>
                    ))}
                  </ol>
                  </GroupedSection>
                )}
                {c.repoUrl && (
                  <a href={`${c.repoUrl}/releases`} className={styles.onward} rel="noopener noreferrer">
                    {t.onGitHub}
                  </a>
                )}
              </div>
            )}

            {tab === "docs" && (
              <div {...panel("docs")} aria-busy={posts === null}>
                <h2 className="sr-only">{t.tab.docs}</h2>
                <p className={styles.lede}>{t.docsFrom}</p>
                {posts === null ? (
                  <div className={styles.flushCard}>
                    <RowsSkeleton rows={3} />
                  </div>
                ) : docs.length === 0 ? (
                  <p className={styles.empty}>{t.noDocs}</p>
                ) : (
                  <GroupedSection>
                  <ol className={styles.list}>
                    {docs.map((p) => (
                      <li key={p.slug}>
                        <ListRow to={`/blog/${p.slug}`} className={styles.listRow} tone="blue" icon={<FileText className={styles.listIcon} aria-hidden="true" />}>
                          <span className={styles.listTitle}>{p.title}</span>
                          {p.subtitle && <span className={styles.listMeta}>{p.subtitle}</span>}
                        </ListRow>
                      </li>
                    ))}
                  </ol>
                  </GroupedSection>
                )}
              </div>
            )}
          </div>
        )}
      </DashboardShell>
    </PageShell>
  );
}

