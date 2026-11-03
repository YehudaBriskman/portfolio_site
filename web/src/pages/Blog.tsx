import { useCallback, useEffect, useId, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FileText, Hash, House, Rss } from "lucide-react";
import PageShell from "@/components/PageShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import AskBox from "@/components/dashboard/AskBox";
import Timeline from "@/components/dashboard/Timeline";
import Tree from "@/components/dashboard/Tree";
import type { TreeNode } from "@/components/dashboard/tree";
import {
  AreaGlyph,
  Chip,
  Chips,
  DashCard,
  OwnerCard,
  Row,
  RowList,
  TopList,
  ViewNav,
} from "@/components/dashboard/Parts";
import { ListSkeleton, PostsSkeleton, RowsSkeleton } from "@/components/dashboard/Skeletons";
import styles from "@/components/dashboard/Dashboard.module.css";
import HeadStrand from "@/components/motion/HeadStrand";
import Ring from "@/components/motion/Ring";
import { greeting, monthLabel, shortDate, useWords, type Lang, type Words } from "@/components/dashboard/i18n";
import FilterControl, { FilterTokens, SearchField, type FacetSpec } from "@/components/gallery/FilterControl";
import { activeCount, hrefCleared, readSelection } from "@/components/gallery/facets";
import { NOTE_FACETS, SEARCH_FROM, filterNotes, noteOptions, type NoteFacet } from "@/components/notes/shelf";
import { blog, topPosts, type Collection, type PostSummary } from "@/services/blog";
import { activity, type ActivityEvent, type Area } from "@/services/activity";

/*
 * Blogs, as a dashboard (#224), in the layout of GitHub's: who and where on
 * the left, the writing in the middle, what is happening on the right.
 *
 * TWO VIEWS, BOTH URLS
 *   /blog             Home: a greeting, the search box, top posts, the tree
 *                     of areas and notes, and the latest few.
 *   /blog?view=feed   Feed: every note, newest first, by month.
 *
 * EVERYTHING ELSE IS THE URL TOO. The topic and year filters are the
 * gallery's control (#193) and its `?tag=&year=` parameters, unchanged, so
 * every link into the old gallery lands on the same notes. `@area` in the
 * search box and the old `?collection=` links are the third facet. The open
 * branches of the tree are `?open=`, replaced rather than pushed, so Back
 * leaves the page rather than closing a folder.
 *
 * WHAT IS FETCHED. The notes once (every filter is applied to that list,
 * `notes/shelf.ts`), the areas ranked by activity (`/api/areas`, #223), and
 * one page of the activity feed for the timeline. The three fail apart: a
 * dead activity endpoint costs the timeline, not the notes. Areas fall back
 * to the collections the notes are filed in, so the rail and the tree still
 * draw without them.
 *
 * SPARSE. With three notes or fewer, "Top posts" would be the same notes as
 * "Latest" in a different box, so it is not drawn: a datum is said once.
 */

const PAGE = 20;
const LATEST = 6;
const SPARSE = 3;

type View = "home" | "feed";

const FACET_LABEL: Record<Lang, Record<NoteFacet, string>> = {
  en: { tag: "Topic", year: "Year", collection: "Area" },
  he: { tag: "נושא", year: "שנה", collection: "תחום" },
};

/** The ranked areas, or — without the endpoint — the collections notes are filed in. */
function areasFrom(api: Area[] | null, cols: Collection[], posts: PostSummary[]): Pick<Area, "slug" | "title" | "noteCount" | "kind" | "repoUrl">[] {
  if (api) return api.filter((a) => a.noteCount > 0 || a.kind === "site");
  const counts = new Map<string, number>();
  for (const p of posts) counts.set(p.collection, (counts.get(p.collection) ?? 0) + 1);
  return [...counts]
    .map(([slug, noteCount]) => {
      const c = cols.find((x) => x.slug === slug);
      return { slug, title: c?.title ?? (slug === "site" ? "The site" : slug), noteCount, kind: c?.kind ?? "project", repoUrl: c?.repoUrl ?? null };
    })
    .sort((a, b) => b.noteCount - a.noteCount);
}

function withParams(search: string, set: Record<string, string | null>): string {
  const p = new URLSearchParams(search);
  for (const [k, v] of Object.entries(set)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `/blog?${s}` : "/blog";
}

function metaOf(p: PostSummary, t: Words, lang: Lang, areaTitle: (slug: string) => string) {
  return [
    <span key="a" translate="no">
      {areaTitle(p.collection)}
    </span>,
    p.publishedAt ? (
      <time key="d" dateTime={p.publishedAt}>
        {shortDate(p.publishedAt, lang)}
      </time>
    ) : null,
    t.minRead(p.readingMinutes),
  ];
}

function TopicChips({ post, label }: { post: PostSummary; label: string }) {
  if (post.tags.length === 0) return null;
  return (
    <Chips label={label}>
      {post.tags.map((tag) => (
        <Chip key={tag} to={`/blog?view=feed&tag=${encodeURIComponent(tag)}`}>
          {tag}
        </Chip>
      ))}
    </Chips>
  );
}

export default function Blog() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [t, lang] = useWords();
  const view: View = params.get("view") === "feed" ? "feed" : "home";
  const selection = readSelection(params, NOTE_FACETS);
  const q = (params.get("q") ?? "").trim();
  const on = activeCount(selection);
  const open = (params.get("open") ?? "").split(",").filter(Boolean);

  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [cols, setCols] = useState<Collection[]>([]);
  const [apiAreas, setApiAreas] = useState<Area[] | null>(null);
  const [areasDone, setAreasDone] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [eventsAttempt, setEventsAttempt] = useState(0);
  const [shown, setShown] = useState(PAGE);
  const [now] = useState(() => new Date());
  const hintId = useId();

  /* A retry clears the old answer in the render that asks for the new one. */
  const [seenAttempt, setSeenAttempt] = useState(attempt);
  if (seenAttempt !== attempt) {
    setSeenAttempt(attempt);
    setPosts(null);
    setPostsError(null);
  }
  const [seenEvents, setSeenEvents] = useState(eventsAttempt);
  if (seenEvents !== eventsAttempt) {
    setSeenEvents(eventsAttempt);
    setEvents(null);
    setEventsError(null);
  }
  /* A new filter starts the feed from its first page. */
  const filterKey = `${params.getAll("tag").join()}|${params.getAll("year").join()}|${params.getAll("collection").join()}|${q}|${view}`;
  const [seenFilter, setSeenFilter] = useState(filterKey);
  if (seenFilter !== filterKey) {
    setSeenFilter(filterKey);
    setShown(PAGE);
  }

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const retryEvents = useCallback(() => setEventsAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    blog
      .posts()
      .then((p) => alive && setPosts(p))
      .catch((e) => alive && setPostsError(e instanceof Error ? e.message : "Failed to load"));
    blog
      .collections()
      .then((c) => alive && setCols(c))
      .catch(() => alive && setCols([]));
    activity
      .areas()
      .then((a) => alive && setApiAreas(a))
      .catch(() => alive && setApiAreas(null))
      .finally(() => alive && setAreasDone(true));
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    let alive = true;
    activity
      .page({ limit: 6 })
      .then((p) => alive && setEvents(p.items))
      .catch((e) => alive && setEventsError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, [eventsAttempt]);

  const all = posts ?? [];
  const areas = areasFrom(apiAreas, cols, all);
  const areaTitle = (slug: string) =>
    areas.find((a) => a.slug === slug)?.title ?? cols.find((c) => c.slug === slug)?.title ?? (slug === "site" ? "The site" : slug);
  const matching = filterNotes(all, selection, q);
  const newest = [...matching].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const ready = posts !== null && !postsError;
  const filtered = on > 0 || q.length > 0;
  const sparse = ready && all.length <= SPARSE;

  /* ── the filter control, the gallery's own ─────────────────────────── */
  const labels = FACET_LABEL[lang];
  const facets: FacetSpec[] = NOTE_FACETS.map((f) => ({
    key: f,
    label: labels[f],
    options: noteOptions(all, f, selection, q),
    ...(f === "collection" ? { labelOf: areaTitle, noTranslate: true } : {}),
  }));
  /* Areas have their own list above the filters; the facet is shown only
     when a link or an `@` search has chosen one, so it can be taken off. */
  const offered = facets.filter((f) => f.key !== "collection" || selection.collection?.length);

  /* ── the rail ───────────────────────────────────────────────────────── */
  const homeHref = withParams(location.search, { view: null });
  const feedHref = withParams(location.search, { view: "feed", open: null });
  const rail = (
    <>
      <OwnerCard />
      <ViewNav
        label={t.views}
        views={[
          { key: "home", label: t.home, to: homeHref, icon: <House />, current: view === "home" },
          { key: "feed", label: t.feed, to: feedHref, icon: <Rss />, current: view === "feed" },
        ]}
      />
      {!areasDone && posts === null ? (
        <div>
          <h2 className={styles.railTitle}>{t.topAreas}</h2>
          <ListSkeleton />
        </div>
      ) : (
        areas.length > 0 && (
          <TopList
            title={t.topAreas}
            items={areas.map((a) => ({
              key: a.slug,
              label: a.title,
              to: `/blog/area/${a.slug}`,
              count: a.noteCount,
              icon: <AreaGlyph seed={a.slug} />,
            }))}
          />
        )
      )}
      {ready && all.length > 0 && (
        <div className={styles.railFilter}>
          <FilterControl
            title={t.filter}
            facets={offered}
            selection={selection}
            path="/blog"
            shown={matching.length}
            total={all.length}
            noun={lang === "he" ? "רשימות" : all.length === 1 ? "note" : "notes"}
            search={
              view === "feed" && all.length >= SEARCH_FROM ? (
                <SearchField label={t.askLabel} path="/blog" placeholder={t.searchPlaceholder} />
              ) : undefined
            }
          />
        </div>
      )}
    </>
  );

  const aside = <Timeline events={events} error={eventsError} onRetry={retryEvents} logHref="/blog/log" />;

  /* ── the states every view shares ──────────────────────────────────── */
  const failed = postsError && (
    <div className={styles.message} role="alert">
      <h2 className={styles.messageTitle}>{t.notesFailedTitle}</h2>
      <p className={styles.messageBody}>{t.notesFailedBody}</p>
      <code className={styles.messageCode}>{postsError}</code>
      <div className={styles.actions}>
        <button type="button" className={styles.button} data-primary="" onClick={retry}>
          {t.retry}
        </button>
        <Link to="/projects" className={styles.button}>
          {t.seeProjects}
        </Link>
      </div>
    </div>
  );

  const empty = ready && all.length === 0 && (
    <div className={styles.message}>
      <h2 className={styles.messageTitle}>{t.emptyTitle}</h2>
      <p className={styles.messageBody}>{t.emptyBody}</p>
      <Link to="/projects" className={styles.button}>
        {t.seeProjects}
      </Link>
    </div>
  );

  const noMatch = ready && all.length > 0 && matching.length === 0 && (
    <div className={styles.message}>
      <h2 className={styles.messageTitle}>{t.noMatch}</h2>
      <Link to={hrefCleared("/blog", location.search, [...NOTE_FACETS, "q"])} className={styles.button}>
        {t.clearFilters}
      </Link>
    </div>
  );

  const row = (p: PostSummary) => (
    <Row
      key={p.slug}
      icon={<FileText />}
      title={p.title}
      to={`/blog/${p.slug}`}
      meta={metaOf(p, t, lang, areaTitle)}
      chips={<TopicChips post={p} label={labels.tag} />}
      badge={p.featured != null ? <span className={styles.featured}>{t.featured}</span> : undefined}
    />
  );

  /* ── Home ───────────────────────────────────────────────────────────── */
  const topicCounts = new Map<string, number>();
  for (const p of all) for (const tag of p.tags) topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
  const topics = [...topicCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const tree: TreeNode[] = areas
    .map((a) => {
      const notes = newest.filter((p) => p.collection === a.slug);
      return {
        id: a.slug,
        text: a.title,
        label: <span translate="no">{a.title}</span>,
        icon: <AreaGlyph seed={a.slug} />,
        meta: notes.length,
        children: notes.map((p) => ({
          id: `${a.slug}/${p.slug}`,
          text: p.title,
          label: p.title,
          href: `/blog/${p.slug}`,
          icon: <FileText aria-hidden="true" />,
          meta: p.publishedAt ? shortDate(p.publishedAt, lang) : undefined,
        })),
      };
    })
    .filter((n) => n.children.length > 0);

  const setOpen = (next: string[]) =>
    navigate(withParams(location.search, { open: next.length ? next.join(",") : null }), {
      replace: true,
      preventScrollReset: true,
    });

  const home = (
    <>
      <header className={styles.hello}>
        <h1 className={styles.greeting}>
          <span className="sr-only">{`${lang === "he" ? "בלוגים" : "Blogs"}: `}</span>
          {greeting(now, lang)}
        </h1>
        <HeadStrand />
        <p className={styles.lede}>
          {lang === "he"
            ? "רשימות עבודה: החלטות שקיבלתי ומה הן עלו, לפי תחום."
            : "Working notes: decisions I made and what they cost, filed by area like a repository."}
        </p>
      </header>

      <AskBox
        key={q}
        initial={q}
        topics={topics.map(([tag]) => ({ value: tag, label: tag }))}
        areas={areas.map((a) => ({ value: a.slug, label: a.title }))}
        onAsk={(asked) => {
          const p = new URLSearchParams();
          p.set("view", "feed");
          if (asked.q) p.set("q", asked.q);
          asked.tags.forEach((tag) => p.append("tag", tag));
          asked.areas.forEach((a) => p.append("collection", a));
          navigate(`/blog?${p.toString()}`);
        }}
      >
        {topics.length > 0 && (
          <ul className={styles.quickChips} aria-label={t.quickTopics}>
            {topics.slice(0, 5).map(([tag]) => (
              <li key={tag}>
                <Link to={`/blog?view=feed&tag=${encodeURIComponent(tag)}`} className={styles.quickChip} translate="no">
                  <Hash aria-hidden="true" />
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AskBox>

      {failed}
      {empty}

      {posts === null && !postsError && (
        <DashCard title={t.topPosts} busy bare>
          <PostsSkeleton />
        </DashCard>
      )}

      {ready && !sparse && (
        <section className={styles.section} aria-labelledby={`${hintId}-top`}>
          <div className={styles.sectionHead}>
            <h2 id={`${hintId}-top`} className={styles.sectionTitle}>
              {t.topPosts}
            </h2>
            <Link to={feedHref} className={styles.sectionAction}>
              {t.viewAll}
              <span className="sr-only">{`: ${t.everything}`}</span>
            </Link>
          </div>
          <div className={styles.postsWrap}>
            <ul className={styles.posts}>
              {topPosts(all, 3).map((p) => (
                <li key={p.slug} className={styles.post}>
                  <div className={styles.postHead}>
                    <AreaGlyph seed={p.collection} size={14} />
                    <span className={styles.postArea} translate="no">
                      {areaTitle(p.collection)}
                    </span>
                    {p.featured != null && <span className={styles.featured}>{t.featured}</span>}
                  </div>
                  <h3 className={styles.postTitle}>
                    <Link to={`/blog/${p.slug}`}>{p.title}</Link>
                  </h3>
                  <p className={styles.postExcerpt}>{p.excerpt}</p>
                  <div className={styles.postMeta}>
                    {p.publishedAt && (
                      <time className={styles.metaPart} dateTime={p.publishedAt}>
                        {shortDate(p.publishedAt, lang)}
                      </time>
                    )}
                    <span className={styles.metaPart}>{t.minRead(p.readingMinutes)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {posts === null && !postsError && (
        <DashCard title={t.tree} busy flush>
          <RowsSkeleton rows={4} />
        </DashCard>
      )}
      {ready && tree.length > 0 && (
        <DashCard title={t.tree} flush>
          <Tree nodes={tree} expanded={open} onExpandedChange={setOpen} label={t.tree} describedBy={hintId} />
          <p id={hintId} className={styles.treeHint}>
            {t.treeHint}
          </p>
        </DashCard>
      )}

      {posts === null && !postsError && (
        <DashCard title={t.latest} busy flush>
          <RowsSkeleton rows={LATEST} />
        </DashCard>
      )}
      {ready && all.length > 0 && (matching.length === 0 ? noMatch : (
        <DashCard
          title={t.latest}
          flush
          action={matching.length > LATEST ? { to: feedHref, label: t.viewAll, describe: t.everything } : undefined}
        >
          <RowList>{newest.slice(0, LATEST).map(row)}</RowList>
          {sparse && <p className={styles.feedFoot}>{t.sparse}</p>}
        </DashCard>
      ))}
    </>
  );

  /* ── Feed ───────────────────────────────────────────────────────────── */
  const page = newest.slice(0, shown);
  const months: { label: string; key: string; items: PostSummary[] }[] = [];
  for (const p of page) {
    const key = p.publishedAt?.slice(0, 7) ?? "undated";
    const last = months.at(-1);
    if (last?.key === key) last.items.push(p);
    else months.push({ key, label: monthLabel(p.publishedAt, lang), items: [p] });
  }

  const feed = (
    <>
      <header className={styles.hello}>
        <h1 className={styles.greeting}>
          <span className="sr-only">{`${lang === "he" ? "בלוגים" : "Blogs"}: `}</span>
          {t.feed}
        </h1>
        <HeadStrand />
        <p className={styles.lede} aria-live="polite">
          {ready ? (filtered ? t.ofNotes(matching.length, all.length) : t.notes(all.length)) : " "}
        </p>
      </header>

      {failed}
      {empty}
      {noMatch}

      {posts === null && !postsError && (
        <DashCard title={t.everything} busy flush>
          <RowsSkeleton rows={8} />
        </DashCard>
      )}

      {ready && matching.length > 0 && (
        <DashCard title={t.everything} flush>
          {months.map((m) => (
            <section key={m.key} className={styles.month} aria-label={m.label}>
              <h3 className={styles.monthHead}>
                <Ring size={10} tone="soft" />
                {m.label}
              </h3>
              <RowList>{m.items.map(row)}</RowList>
            </section>
          ))}
          {newest.length > shown ? (
            <div className={styles.feedFoot}>
              <button type="button" className={styles.button} onClick={() => setShown((n) => n + PAGE)}>
                {t.showMoreNotes}
              </button>
            </div>
          ) : (
            sparse && <p className={styles.feedFoot}>{t.sparse}</p>
          )}
        </DashCard>
      )}
    </>
  );

  return (
    <PageShell>
      <DashboardShell
        railLabel={lang === "he" ? "עיון ברשימות" : "Browse the notes"}
        rail={rail}
        asideLabel={t.timeline}
        aside={aside}
        count={on}
        bar={<FilterTokens facets={offered} selection={selection} path="/blog" />}
      >
        {view === "home" ? home : feed}
      </DashboardShell>
    </PageShell>
  );
}
