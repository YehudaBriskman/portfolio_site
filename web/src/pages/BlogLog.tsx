import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, FileText, Folder, Globe, House, List, Rocket, Rss, Upload } from "lucide-react";
import PageShell from "@/components/PageShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { AreaGlyph, OwnerCard, ViewNav } from "@/components/dashboard/Parts";
import { ListSkeleton, RowsSkeleton } from "@/components/dashboard/Skeletons";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import { FilterTokens, type FacetSpec } from "@/components/gallery/FilterControl";
import styles from "@/components/dashboard/Dashboard.module.css";
import log from "./BlogLog.module.css";
import { fullDate, relative, useWords } from "@/components/dashboard/i18n";
import {
  LOG_PAGE,
  LOG_PATH,
  LOG_WORDS,
  filterCount,
  groupByDay,
  hrefToggledArea,
  hrefToggledKind,
  logFeedHref,
  logHref,
  readLogFilters,
} from "@/components/dashboard/log";
import { ACTIVITY_KINDS, activity, type ActivityEvent, type ActivityKind, type Area } from "@/services/activity";

/*
 * The channel log: `/blog/log` (#226). Every event the activity API serves,
 * newest first, under a heading per day — GitHub's changelog and feed, on
 * the dashboard's shell (#224).
 *
 *   rail    who, the three views, and the filters: kind and area
 *   main    the days, each a list of rows; "Load more" at the foot
 *   aside   the feed of exactly what is shown
 *
 * THE URL IS THE STATE (`dashboard/log.ts`): `?kind=release&area=windom`.
 * The filters are links, so a filtered log can be opened in a new tab,
 * shared or bookmarked, and the Work page links straight to `?kind=release`.
 * A filter change starts the log again from its newest event.
 *
 * "LOAD MORE", NOT INFINITE SCROLL. The footer stays reachable, the reader
 * decides when the page grows, and the cursor stays out of the URL (a shared
 * link opens at the newest). When the next events arrive, focus moves to the
 * first of them, so a keyboard or screen-reader user carries on reading
 * where the old list ended instead of being left on a button that may now
 * be gone; a polite status says how many are shown.
 *
 * A ROW: the kind's icon, the title as the link, then the kind, the area and
 * the age. The age is relative ("3 days ago") because the heading above it
 * already gives the day; the exact time is in the `<time>` element's
 * `dateTime` and its `title`. A repo event links to GitHub and says so, in
 * words for a screen reader and with an arrow for the eye.
 *
 * STATES: a skeleton in the shape of a day of rows; an error with a retry;
 * an empty log; a filtered log with nothing in it, which offers to clear
 * the filters; and the end of the log, which says it is the end.
 *
 * MOTION: none of its own (`docs/motion-contract.md`, the dashboard row).
 */

const ICON: Record<ActivityKind, typeof FileText> = {
  post: FileText,
  release: Rocket,
  push: Upload,
  site: Globe,
  area: Folder,
};

const external = (href: string) => /^https?:\/\//.test(href);

function FilterList({
  title,
  clear,
  children,
}: {
  title: string;
  clear?: { to: string; label: string };
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={log.filter} aria-labelledby={id}>
      <div className={log.filterHead}>
        <h2 id={id} className={styles.railTitle}>
          {title}
        </h2>
        {clear && (
          <Link to={clear.to} className={log.clear} preventScrollReset>
            {clear.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Option({ to, current, icon, children }: { to: string; current: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className={log.option} aria-current={current ? "true" : undefined} preventScrollReset>
        <span className={log.check} aria-hidden="true" />
        <span aria-hidden="true">{icon}</span>
        <span className={log.optionLabel}>{children}</span>
      </Link>
    </li>
  );
}

function LogRow({ event, now }: { event: ActivityEvent; now: number }) {
  const [t, lang] = useWords();
  const w = LOG_WORDS[lang];
  const Icon = ICON[event.kind];
  const leaves = external(event.href);
  const title = (
    <>
      {event.title}
      {leaves && (
        <>
          <ArrowUpRight size={14} className={log.external} aria-hidden="true" />{" "}
          <span className="sr-only">{`(${w.leaves})`}</span>
        </>
      )}
    </>
  );
  const parts: ReactNode[] = [
    t.kind[event.kind],
    event.area ? (
      <Link to={`/blog/area/${event.area.slug}`} className={log.areaLink} translate="no">
        {event.area.title}
      </Link>
    ) : null,
    <time dateTime={event.at} title={fullDate(event.at, lang)} className={log.time}>
      {relative(event.at, now, lang)}
    </time>,
  ].filter(Boolean);

  return (
    <li className={styles.row} data-kind={event.kind}>
      <span className={styles.rowIcon} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.rowBody}>
        <div className={styles.rowTitleLine}>
          {leaves ? (
            <a href={event.href} rel="noopener noreferrer" className={styles.rowTitle} data-event-link="">
              {title}
            </a>
          ) : (
            <Link to={event.href} className={styles.rowTitle} data-event-link="">
              {title}
            </Link>
          )}
        </div>
        <div className={styles.rowMeta}>
          {parts.map((p, i) => (
            <span key={i} className={styles.metaPart}>
              {p}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

function LogSkeleton() {
  return (
    <div className={styles.card} data-flush="">
      {[6, 3].map((rows, i) => (
        <div key={i} className={log.day}>
          <div className={styles.monthHead}>
            <SkeletonGate>
              <span className={log.dayHeadSkeleton}>
                <SkeletonLines lines={1} tail="10rem" />
              </span>
            </SkeletonGate>
          </div>
          <RowsSkeleton rows={rows} />
        </div>
      ))}
    </div>
  );
}

export default function BlogLog() {
  const [params] = useSearchParams();
  const [t, lang] = useWords();
  const w = LOG_WORDS[lang];
  const filters = readLogFilters(params);
  const on = filterCount(filters);
  const filterKey = logHref(filters);

  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState<"idle" | "loading" | "failed">("idle");
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  /** Where the newest "Load more" began, so focus can go to its first row. */
  const focusFrom = useRef<number | null>(null);
  const list = useRef<HTMLDivElement>(null);

  /* A new filter, or a retry, clears the old answer in the render that asks for the new one. */
  const [seen, setSeen] = useState(`${filterKey}#${attempt}`);
  if (seen !== `${filterKey}#${attempt}`) {
    setSeen(`${filterKey}#${attempt}`);
    setEvents(null);
    setCursor(null);
    setError(null);
    setMore("idle");
  }

  useEffect(() => {
    let alive = true;
    const { kinds, area } = readLogFilters(new URLSearchParams(filterKey.split("?")[1] ?? ""));
    activity
      .page({ limit: LOG_PAGE, kind: kinds.length ? kinds : undefined, area: area ?? undefined })
      .then((p) => {
        if (!alive) return;
        setNow(Date.now());
        setEvents(p.items);
        setCursor(p.nextCursor);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, [filterKey, attempt]);

  useEffect(() => {
    let alive = true;
    activity
      .areas()
      .then((a) => alive && setAreas(a))
      .catch(() => alive && setAreas([]));
    return () => {
      alive = false;
    };
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  /* Which list is on screen, so a "Load more" answer for a list the reader
     has since filtered away is dropped rather than appended to the new one. */
  const showing = useRef(seen);
  useEffect(() => {
    showing.current = seen;
  }, [seen]);

  const loadMore = () => {
    if (!cursor || more === "loading" || !events) return;
    setMore("loading");
    const from = events.length;
    const asked = seen;
    activity
      .page({
        limit: LOG_PAGE,
        before: cursor,
        kind: filters.kinds.length ? filters.kinds : undefined,
        area: filters.area ?? undefined,
      })
      .then((p) => {
        if (showing.current !== asked) return;
        focusFrom.current = from;
        setEvents((prev) => [...(prev ?? []), ...p.items]);
        setCursor(p.nextCursor);
        setMore("idle");
      })
      .catch(() => showing.current === asked && setMore("failed"));
  };

  /* The first of the new rows takes focus once it is in the document. */
  useLayoutEffect(() => {
    const from = focusFrom.current;
    if (from === null) return;
    focusFrom.current = null;
    list.current?.querySelectorAll<HTMLElement>("[data-event-link]")[from]?.focus();
  });

  const days = events ? groupByDay(events, lang) : [];

  /* ── the rail ───────────────────────────────────────────────────────── */
  const kindLabel = (k: string) => w.kindPlural[k as ActivityKind] ?? k;
  const areaTitle = (slug: string) => areas?.find((a) => a.slug === slug)?.title ?? slug;
  const facets: FacetSpec[] = [
    { key: "kind", label: w.kinds, options: [], labelOf: kindLabel },
    { key: "area", label: w.areas, options: [], labelOf: areaTitle, noTranslate: true },
  ];
  const selection = {
    ...(filters.kinds.length ? { kind: filters.kinds } : {}),
    ...(filters.area ? { area: [filters.area] } : {}),
  };
  const shownAreas = (areas ?? []).filter((a) => a.lastActivityAt !== null || a.slug === filters.area);

  const rail = (
    <>
      <OwnerCard />
      <ViewNav
        label={t.views}
        views={[
          { key: "home", label: t.home, to: "/blog", icon: <House />, current: false },
          { key: "feed", label: t.feed, to: "/blog?view=feed", icon: <Rss />, current: false },
          { key: "log", label: w.log, to: LOG_PATH, icon: <List />, current: true },
        ]}
      />
      <div data-filter-scope="">
        <FilterList
          title={w.kinds}
          clear={filters.kinds.length ? { to: logHref({ ...filters, kinds: [] }), label: w.anyKind } : undefined}
        >
          <ul className={log.filterList}>
            {ACTIVITY_KINDS.map((k) => {
              const Icon = ICON[k];
              return (
                <Option key={k} to={hrefToggledKind(filters, k)} current={filters.kinds.includes(k)} icon={<Icon />}>
                  {w.kindPlural[k]}
                </Option>
              );
            })}
          </ul>
        </FilterList>
      </div>
      <div data-filter-scope="">
        <FilterList
          title={w.areas}
          clear={filters.area ? { to: logHref({ ...filters, area: null }), label: w.anyArea } : undefined}
        >
          {areas === null ? (
            <ListSkeleton lines={4} />
          ) : shownAreas.length === 0 ? (
            <p className={styles.topEmpty}>{w.noAreas}</p>
          ) : (
            <ul className={log.filterList}>
              {shownAreas.map((a) => (
                <Option
                  key={a.slug}
                  to={hrefToggledArea(filters, a.slug)}
                  current={filters.area === a.slug}
                  icon={<AreaGlyph seed={a.slug} />}
                >
                  <span translate="no">{a.title}</span>
                </Option>
              ))}
            </ul>
          )}
        </FilterList>
      </div>
    </>
  );

  /* ── the aside ──────────────────────────────────────────────────────── */
  const feedHref = logFeedHref(filters);
  const subscribeId = useId();
  const aside = (
    <section className={log.subscribe} aria-labelledby={subscribeId}>
      <h2 id={subscribeId}>{w.subscribe}</h2>
      <p>{w.subscribeBody}</p>
      <ul className={log.subscribeLinks}>
        <li>
          <a href={feedHref} type="application/rss+xml">
            <Rss size={14} aria-hidden="true" />
            {`${w.log} · ${w.rss}`}
          </a>
        </li>
        <li>
          <a href="/feed.xml" type="application/rss+xml">
            <Rss size={14} aria-hidden="true" />
            {w.subscribeAll}
          </a>
        </li>
      </ul>
    </section>
  );

  /* ── the main column ────────────────────────────────────────────────── */
  const failed = error && (
    <div className={styles.message} role="alert">
      <h2 className={styles.messageTitle}>{w.failedTitle}</h2>
      <p className={styles.messageBody}>{w.failedBody}</p>
      <code className={styles.messageCode}>{error}</code>
      <div className={styles.actions}>
        <button type="button" className={styles.button} data-primary="" onClick={retry}>
          {t.retry}
        </button>
        <Link to="/blog" className={styles.button}>
          {t.backTo}
        </Link>
      </div>
    </div>
  );

  const empty = events !== null && events.length === 0 && (
    <div className={styles.message}>
      <h2 className={styles.messageTitle}>{on > 0 ? w.noMatch : w.emptyTitle}</h2>
      {on === 0 && <p className={styles.messageBody}>{w.emptyBody}</p>}
      {on > 0 ? (
        <Link to={LOG_PATH} className={styles.button}>
          {w.clear}
        </Link>
      ) : (
        <Link to="/blog" className={styles.button}>
          {t.backTo}
        </Link>
      )}
    </div>
  );

  return (
    <PageShell>
      <link rel="alternate" type="application/rss+xml" title={w.feedTitle} href={feedHref} />
      <DashboardShell
        railLabel={w.railLabel}
        rail={rail}
        asideLabel={w.subscribe}
        aside={aside}
        count={on}
        bar={<FilterTokens facets={facets} selection={selection} path={LOG_PATH} />}
      >
        <header className={styles.hello}>
          <h1 className={styles.greeting}>{w.title}</h1>
          <p className={styles.lede}>{w.lede}</p>
        </header>

        {failed}
        {empty}

        {!error && events === null && (
          <section aria-busy="true" aria-label={w.events}>
            <LogSkeleton />
          </section>
        )}

        {events !== null && events.length > 0 && (
          <div className={styles.card} data-flush="" ref={list}>
            {days.map((d) => {
              const id = `day-${d.key}`;
              return (
                <section key={d.key} className={log.day} aria-labelledby={id}>
                  <h2 id={id} className={styles.monthHead}>
                    {d.label}
                  </h2>
                  <ol className={styles.rows}>
                    {d.items.map((e) => (
                      <LogRow key={e.id} event={e} now={now} />
                    ))}
                  </ol>
                </section>
              );
            })}
            <div className={log.foot}>
              <p className="sr-only" role="status">
                {w.shown(events.length)}
              </p>
              {cursor ? (
                <>
                  {more === "failed" && (
                    <span role="alert">{w.moreFailed}</span>
                  )}
                  <button
                    type="button"
                    className={`${styles.button} ${log.loadMore}`}
                    aria-disabled={more === "loading" || undefined}
                    onClick={loadMore}
                  >
                    {more === "loading" ? w.loading : more === "failed" ? t.retry : w.loadMore}
                  </button>
                </>
              ) : (
                <p>{w.end}</p>
              )}
            </div>
          </div>
        )}
      </DashboardShell>
    </PageShell>
  );
}
