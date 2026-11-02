import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { BookMarked } from "lucide-react";
import PageShell from "@/components/PageShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Timeline from "@/components/dashboard/Timeline";
import { AreaGlyph, DashCard, OwnerCard, TopList } from "@/components/dashboard/Parts";
import { ListSkeleton } from "@/components/dashboard/Skeletons";
import dash from "@/components/dashboard/Dashboard.module.css";
import { INTL } from "@/components/dashboard/i18n";
import FilterControl, { FilterTokens, type FacetSpec } from "@/components/gallery/FilterControl";
import { activeCount, readSelection } from "@/components/gallery/facets";
import { FACETS, applyFilters, optionsFor } from "@/components/projects/catalogue";
import RepoCard from "@/components/work/RepoCard";
import styles from "@/components/work/Work.module.css";
import { SORTS, eventsByArea, hrefSorted, isPinned, readSort, sortEntries } from "@/components/work/order";
import { stateWord, useWorkWords } from "@/components/work/words";
import { useProjects } from "@/hooks/useProjects";
import { activity, type ActivityEvent, type Area } from "@/services/activity";

/*
 * Work, as a dashboard (#227), in the same language as Blogs (#224): who and
 * how to narrow it on the left, the projects in the middle, what shipped on
 * the right.
 *
 *   rail    the owner; the filter control from #193 (State, Year, Stack,
 *           `?state=&year=&stack=`, unchanged, so every old link lands on
 *           the same projects); Pinned, as quick links; the areas that
 *           have notes, ranked by activity.
 *   middle  the header; the pinned projects as repository cards; then every
 *           other project, sortable (`?sort=`, recently updated by default).
 *   aside   the latest releases across every project, and the channel log
 *           filtered to releases.
 *
 * THE DATA is what the page always read — `useProjects`, the published
 * collections over the seed table, so the list is never empty and a dead API
 * still lists everything — plus two reads of the activity API (#223): one
 * page of pushes and releases for the cards' strips, one of releases for the
 * aside, and the ranked areas for the rail. Each of those fails on its own
 * and costs only its own region.
 *
 * THE CAPTION LINE ("2 in use · 24 earlier · last push 3 days ago") is gone.
 * Its three facts are now places on the page: "in use" is Pinned, "earlier"
 * is the list under it with its own count, and the last push is the first
 * card under "Recently updated". Raised for the owner in the PR.
 *
 * The cards are the seeds' and the collections' own fields; nothing here is
 * invented to fill a card. A project with no repository behind it has no
 * strip and no facts row beyond what it does have.
 */

export default function Projects() {
  const { items, state } = useProjects();
  const [params] = useSearchParams();
  const location = useLocation();
  const [t, lang] = useWorkWords();
  const [now] = useState(() => Date.now());

  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [eventsFailed, setEventsFailed] = useState(false);
  const [releases, setReleases] = useState<ActivityEvent[] | null>(null);
  const [releasesError, setReleasesError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [areasDone, setAreasDone] = useState(false);
  const [attempt, setAttempt] = useState(0);

  /* A retry clears the old answer in the render that asks for the new one. */
  const [seen, setSeen] = useState(attempt);
  if (seen !== attempt) {
    setSeen(attempt);
    setReleases(null);
    setReleasesError(null);
  }
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    activity
      .page({ kind: ["push", "release"], limit: 50 })
      .then((p) => alive && setEvents(p.items))
      .catch(() => alive && setEventsFailed(true));
    activity
      .areas()
      .then((a) => alive && setAreas(a))
      .catch(() => alive && setAreas(null))
      .finally(() => alive && setAreasDone(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    activity
      .page({ kind: "release", limit: 6 })
      .then((p) => alive && setReleases(p.items))
      .catch((e) => alive && setReleasesError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, [attempt]);

  /* ── filters, the gallery's own control ─────────────────────────────── */
  const filters = readSelection(params, FACETS);
  const on = activeCount(filters);
  const shown = applyFilters(items, filters);
  const facets: FacetSpec[] = FACETS.map((f) => ({
    key: f,
    label: t.facet[f],
    options: optionsFor(items, f, filters),
    noTranslate: f === "stack",
  }));
  const sort = readSort(params);

  const pinned = shown.filter(isPinned);
  const rest = sortEntries(
    shown.filter((e) => !isPinned(e)),
    sort,
    INTL[lang]
  );
  const allPinned = items.filter(isPinned);

  /* ── which strip and which notes link each card gets ────────────────── */
  const bySlug = eventsByArea(events ?? []);
  const projectAreas = (areas ?? []).filter((a) => a.kind === "project");
  /* Without the areas endpoint, a published collection is the nearest
     honest answer to "does it have an area". */
  const hasArea = (slug: string, live: boolean) =>
    areas ? projectAreas.some((a) => a.slug === slug) : live;
  const stripsBusy = events === null && !eventsFailed;

  const card = (e: (typeof items)[number]) => (
    <li key={e.collection.slug}>
      <RepoCard
        entry={e}
        events={eventsFailed ? [] : bySlug.get(e.collection.slug)}
        eventsBusy={stripsBusy}
        hasArea={hasArea(e.collection.slug, e.live)}
        now={now}
      />
    </li>
  );

  /* ── the rail ───────────────────────────────────────────────────────── */
  const withNotes = projectAreas.filter((a) => a.noteCount > 0);
  const rail = (
    <>
      <OwnerCard />
      <div className={dash.railFilter}>
        <FilterControl
          title={lang === "he" ? "סינון" : "Filter"}
          facets={facets}
          selection={filters}
          path="/projects"
          shown={shown.length}
          total={items.length}
          noun={t.noun(items.length)}
        />
      </div>
      {allPinned.length > 0 && (
        <nav className={styles.pins} aria-labelledby="work-pins">
          <h2 id="work-pins" className={dash.railTitle}>
            {t.pinned}
          </h2>
          <ul className={styles.pinList}>
            {allPinned.map((e) => (
              <li key={e.collection.slug}>
                <Link to={`/projects/${e.collection.slug}`} className={styles.pinItem}>
                  <BookMarked size={16} aria-hidden="true" />
                  <span className={styles.pinLabel} translate="no">
                    {e.collection.title}
                  </span>
                  <span className={styles.pinState}>{stateWord(e.state, lang)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {!areasDone ? (
        <div>
          <h2 className={dash.railTitle}>{t.areas}</h2>
          <ListSkeleton lines={3} />
        </div>
      ) : (
        withNotes.length > 0 && (
          <TopList
            title={t.areas}
            items={withNotes.map((a) => ({
              key: a.slug,
              label: a.title,
              to: `/blog/area/${a.slug}`,
              count: a.noteCount,
              icon: <AreaGlyph seed={a.slug} />,
            }))}
          />
        )
      )}
    </>
  );

  const aside = (
    <Timeline
      title={t.releases}
      events={releases}
      error={releasesError}
      onRetry={retry}
      logHref="/blog/log?kind=release"
      empty={t.noReleases}
    />
  );

  const chosen = FACETS.filter((f) => filters[f]?.length).map(
    (f) => `${t.facet[f].toLowerCase()} ${filters[f]!.join(lang === "he" ? " או " : " or ")}`
  );

  return (
    <PageShell>
      <DashboardShell
        railLabel={t.browse}
        rail={rail}
        asideLabel={t.releases}
        aside={aside}
        count={on}
        bar={<FilterTokens facets={facets} selection={filters} path="/projects" />}
      >
        <header className={styles.head}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.lede}>{t.lede}</p>
          {state === "error" && (
            <p className={styles.notice} role="status">
              {t.liveFailed}
            </p>
          )}
        </header>

        {shown.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={dash.messageTitle}>{t.noMatch}</h2>
            <p>
              {chosen.join(", ")}. {t.noMatchBody}
            </p>
            <Link to="/projects" className={dash.button}>
              {t.clear}
            </Link>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <DashCard title={t.pinned} bare>
                <div className={styles.gridWrap}>
                  <ul className={styles.grid} aria-label={t.pinned}>
                    {pinned.map(card)}
                  </ul>
                </div>
              </DashCard>
            )}

            {rest.length > 0 && (
              <DashCard title={t.projects} bare>
                <div className={styles.listHead}>
                  <p className={styles.count} aria-live="polite">
                    {t.ofProjects(shown.length, items.length)}
                  </p>
                  <nav className={styles.sort} aria-label={t.sortBy}>
                    <span className={styles.sortLabel} aria-hidden="true">
                      {t.sortBy}
                    </span>
                    <ul>
                      {SORTS.map((s) => (
                        <li key={s}>
                          <Link
                            to={hrefSorted(location.search, s)}
                            className={styles.sortLink}
                            aria-current={s === sort ? "true" : undefined}
                            replace
                            preventScrollReset
                          >
                            {t.sort[s]}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
                <div className={styles.gridWrap}>
                  <ul className={styles.grid} aria-label={`${t.projects}, ${t.sort[sort]}`}>
                    {rest.map(card)}
                  </ul>
                </div>
              </DashCard>
            )}
          </>
        )}
      </DashboardShell>
    </PageShell>
  );
}
