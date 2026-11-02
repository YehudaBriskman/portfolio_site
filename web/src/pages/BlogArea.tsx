import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileText, House, Rss } from "lucide-react";
import PageShell from "@/components/PageShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Timeline from "@/components/dashboard/Timeline";
import { AreaGlyph, Chip, Chips, DashCard, OwnerCard, Row, RowList, TopList, ViewNav } from "@/components/dashboard/Parts";
import { ListSkeleton, RowsSkeleton } from "@/components/dashboard/Skeletons";
import styles from "@/components/dashboard/Dashboard.module.css";
import { shortDate, useWords } from "@/components/dashboard/i18n";
import { blog, type PostSummary } from "@/services/blog";
import { activity, areaFeedUrl, type ActivityEvent, type Area } from "@/services/activity";

/*
 * An area: `/blog/area/:slug` — the INTERIM page.
 *
 * #225 makes this the area's history in a commits look, with sharing, ids
 * and repo facts. Until it lands, the dashboard's tree, rows and rail link
 * here and get a plain filtered list on the same shell: the area's notes,
 * newest first, its feed, and the area's own slice of the activity feed on
 * the right. It is deliberately small, so #225 replaces the middle column
 * rather than unpicking a design.
 */

export default function BlogArea() {
  const { slug = "" } = useParams();
  const [t, lang] = useWords();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [seen, setSeen] = useState(`${slug}:${attempt}`);
  if (seen !== `${slug}:${attempt}`) {
    setSeen(`${slug}:${attempt}`);
    setPosts(null);
    setError(null);
    setEvents(null);
    setEventsError(null);
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
    activity
      .page({ area: slug, limit: 6 })
      .then((p) => alive && setEvents(p.items))
      .catch((e) => alive && setEventsError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, [slug, attempt]);

  const area = areas?.find((a) => a.slug === slug);
  const title = area?.title ?? (slug === "site" ? "The site" : slug);
  const notes = [...(posts ?? [])].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

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

  return (
    <PageShell>
      <DashboardShell
        railLabel={lang === "he" ? "עיון ברשימות" : "Browse the notes"}
        rail={rail}
        asideLabel={t.timeline}
        aside={<Timeline events={events} error={eventsError} onRetry={retry} logHref="/blog/log" />}
      >
        <header className={styles.hello}>
          <h1 className={`${styles.greeting} ${styles.areaTitle}`}>
            <AreaGlyph seed={slug} size={28} />
            <span translate="no">{title}</span>
          </h1>
          {area?.tagline && <p className={styles.lede}>{area.tagline}</p>}
          <p className={styles.lede}>{t.areaInterim}</p>
          <div className={styles.actions}>
            <a href={areaFeedUrl(slug)} className={styles.button}>
              <Rss size={14} aria-hidden="true" />
              &nbsp;RSS
            </a>
            {area?.kind === "project" && (
              <Link to={`/projects/${slug}`} className={styles.button}>
                {t.goToProject}
              </Link>
            )}
          </div>
        </header>

        {error && (
          <div className={styles.message} role="alert">
            <h2 className={styles.messageTitle}>{error === "not-found" ? t.areaMissing : t.notesFailedTitle}</h2>
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
          <DashCard title={t.everything} busy flush>
            <RowsSkeleton rows={6} />
          </DashCard>
        )}

        {!error && posts !== null && notes.length === 0 && (
          <div className={styles.message}>
            <h2 className={styles.messageTitle}>{areas !== null && !area ? t.areaMissing : t.emptyTitle}</h2>
            <Link to="/blog" className={styles.button}>
              {t.backTo}
            </Link>
          </div>
        )}

        {!error && notes.length > 0 && (
          <DashCard title={t.notes(notes.length)} flush>
            <RowList>
              {notes.map((p) => (
                <Row
                  key={p.slug}
                  icon={<FileText />}
                  title={p.title}
                  to={`/blog/${p.slug}`}
                  meta={[
                    p.publishedAt ? (
                      <time key="d" dateTime={p.publishedAt}>
                        {shortDate(p.publishedAt, lang)}
                      </time>
                    ) : null,
                    t.minRead(p.readingMinutes),
                  ]}
                  chips={
                    p.tags.length > 0 ? (
                      <Chips label={lang === "he" ? "נושא" : "Topic"}>
                        {p.tags.map((tag) => (
                          <Chip key={tag} to={`/blog?view=feed&tag=${encodeURIComponent(tag)}`}>
                            {tag}
                          </Chip>
                        ))}
                      </Chips>
                    ) : undefined
                  }
                />
              ))}
            </RowList>
          </DashCard>
        )}
      </DashboardShell>
    </PageShell>
  );
}
