import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { House, Rss } from "lucide-react";
import PageShell from "@/components/PageShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { AreaGlyph, OwnerCard, TopList, ViewNav } from "@/components/dashboard/Parts";
import { ListSkeleton } from "@/components/dashboard/Skeletons";
import { AreaSideCard, HistoryList, HistorySkeleton, RepoFacts, TopicBar } from "@/components/dashboard/History";
import styles from "@/components/dashboard/Dashboard.module.css";
import ShareMenu from "@/components/share/ShareMenu";
import HeadStrand from "@/components/motion/HeadStrand";
import history from "@/components/dashboard/History.module.css";
import { useWords } from "@/components/dashboard/i18n";
import { useHistoryWords } from "@/components/dashboard/historyWords";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { areaTitleName } from "@/lib/pageTitle";
import { blog, type PostSummary } from "@/services/blog";
import { activity, areaFeedUrl, type Area } from "@/services/activity";

/*
 * An area: `/blog/area/:slug` (#225). The area's notes as a commit history.
 *
 * It replaces #224's interim filtered list on the same shell. The middle is
 * the history, one card per day, each note a row with its short id and its
 * three actions; the header is the area and, when it is linked to a repo,
 * the repo's facts from the stored stats; the aside is the way out — the
 * project, the repo, the area's feed, its published docs — and what the
 * area's notes are about.
 *
 * THE URL HOLDS THE FILTER. `?topic=<tag>` narrows the history to one topic;
 * the topic chips on the rows and the legend in the aside both write it, and
 * a second press on the current topic clears it. Nothing else is state.
 *
 * STATES. A skeleton in the rows' shape while the notes load; an error with
 * a retry; "no area by that name" for a slug that is not one; an empty area
 * that offers its feed; a filter that matches nothing, with the way back.
 */

export default function BlogArea() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const topic = params.get("topic");
  const [t, lang] = useWords();
  const [w] = useHistoryWords();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [seen, setSeen] = useState(`${slug}:${attempt}`);
  if (seen !== `${slug}:${attempt}`) {
    setSeen(`${slug}:${attempt}`);
    setPosts(null);
    setError(null);
  }
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    blog
      .posts({ collection: slug })
      .then((p) => alive && setPosts(p))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    activity
      .areas()
      .then((a) => alive && setAreas(a))
      .catch(() => alive && setAreas([]));
    return () => {
      alive = false;
    };
  }, [slug, attempt]);

  const area = areas?.find((a) => a.slug === slug) ?? null;
  const title = area?.title ?? (slug === "site" ? (lang === "he" ? "האתר" : "The site") : slug);
  useDocumentTitle(area ? areaTitleName(area.title, lang) : null);

  const all = posts ?? [];
  const shown = topic ? all.filter((p) => p.tags.includes(topic)) : all;
  const base = `/blog/area/${encodeURIComponent(slug)}`;
  const topicHref = (tag: string) => `${base}?topic=${encodeURIComponent(tag)}`;
  const legendHref = (tag: string) => (tag === topic ? base : topicHref(tag));
  const missing = areas !== null && !area && posts !== null && all.length === 0;

  const rail = (
    <>
      <OwnerCard />
      <ViewNav
        label={t.views}
        views={[
          { key: "home", label: t.home, to: "/blog", icon: <House />, current: false },
          { key: "feed", label: t.feed, to: "/blog?view=feed", icon: <Rss />, current: false },
        ]}
      />
      {areas === null ? (
        <ListSkeleton />
      ) : (
        <TopList
          title={t.topAreas}
          items={areas
            .filter((a) => a.noteCount > 0)
            .map((a) => ({
              key: a.slug,
              label: a.title,
              to: `/blog/area/${a.slug}`,
              count: a.noteCount,
              icon: <AreaGlyph seed={a.slug} />,
            }))}
        />
      )}
    </>
  );

  const aside = (
    <AreaSideCard area={area} slug={slug} feedUrl={areaFeedUrl(slug)}>
      {posts === null ? <ListSkeleton lines={3} /> : <TopicBar posts={all} topicHref={legendHref} current={topic} />}
    </AreaSideCard>
  );

  const head = (
    <header className={styles.hello}>
      <h1 className={`${styles.greeting} ${styles.areaTitle}`}>
        <AreaGlyph seed={slug} size={28} />
        <span translate="no">{title}</span>
      </h1>
      <HeadStrand />
      {area?.tagline && (
        <p className={styles.lede}>
          <bdi>{area.tagline}</bdi>
        </p>
      )}
      <div>
        <ShareMenu kind="area" variant="text" entity={{ slug, title, summary: area?.tagline }} />
      </div>
      {area?.stats && <RepoFacts stats={area.stats} repoUrl={area.repoUrl} />}
    </header>
  );

  return (
    <PageShell>
      <DashboardShell
        phonePage="blog"
        railLabel={lang === "he" ? "עיון ברשימות" : "Browse the notes"}
        rail={rail}
        asideLabel={w.aboutArea}
        aside={aside}
        asideFirst
        back={{ to: "/blog", label: lang === "he" ? "בלוג" : "Blogs" }}
        head={head}
      >

        {error && (
          <div className={styles.message} role="alert">
            <h2 className={styles.messageTitle}>{error === "not-found" ? t.areaMissing : t.notesFailedTitle}</h2>
            {error !== "not-found" && <p className={styles.messageBody}>{t.notesFailedBody}</p>}
            <div className={styles.actions}>
              {error !== "not-found" && (
                <button type="button" className={styles.button} data-primary="" onClick={retry}>
                  {t.retry}
                </button>
              )}
              <Link to="/blog" className={styles.button}>
                {t.backTo}
              </Link>
            </div>
          </div>
        )}

        {!error && posts === null && (
          <section className={history.historyWrap} aria-busy="true" aria-label={w.historyLabel}>
            <HistorySkeleton />
          </section>
        )}

        {!error && posts !== null && all.length === 0 && (
          <div className={styles.message}>
            <h2 className={styles.messageTitle}>{missing ? t.areaMissing : w.emptyArea}</h2>
            {!missing && <p className={styles.messageBody}>{w.emptyAreaBody}</p>}
            <div className={styles.actions}>
              {!missing && (
                <a href={areaFeedUrl(slug)} className={styles.button} data-primary="">
                  {w.rss}
                </a>
              )}
              <Link to="/blog" className={styles.button}>
                {t.backTo}
              </Link>
            </div>
          </div>
        )}

        {!error && all.length > 0 && (
          <section className={history.historyWrap} aria-labelledby="area-history-title">
            <div className={history.historyHead}>
              <h2 id="area-history-title" className={styles.sectionTitle}>
                {w.shown(shown.length, all.length)}
              </h2>
              {topic && (
                <p className={history.filterBar}>
                  <span className={history.filterName}>
                    {`${w.filteredBy}: `}
                    <span translate="no">{topic}</span>
                  </span>
                  <Link to={base} className={styles.sectionAction}>
                    {w.clearFilter}
                  </Link>
                </p>
              )}
              <p className={history.keysHint}>
                <kbd translate="no">j</kbd> <kbd translate="no">k</kbd> {w.keysHint}
              </p>
            </div>
            {shown.length > 0 ? (
              <HistoryList posts={shown} topicHref={topicHref} />
            ) : (
              <div className={styles.message}>
                <h3 className={styles.messageTitle}>{t.noMatch}</h3>
                <Link to={base} className={styles.button}>
                  {w.clearFilter}
                </Link>
              </div>
            )}
          </section>
        )}
      </DashboardShell>
    </PageShell>
  );
}
