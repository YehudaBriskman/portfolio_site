import Select from "@/components/ui/Select";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExternalLink, Plus, Search } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import TranslationPill from "@/components/admin/TranslationPill";
import { useTranslationStatus } from "@/services/translations";
import { Counter, EmptyState, ErrorState, LoadingRows, PageHeader, RelTime, StatePill, UnreadableNote } from "@/components/admin/ui";
import { useAdminWords } from "@/i18n/admin";
import { plural } from "@/i18n/words";
import { admin, type AdminCollection, type AdminPost } from "@/services/admin";
import PostsPhone from "@/components/admin/posts/PostsPhone";
import { usePhone } from "@/hooks/usePhone";
import { unreadableCount } from "@/services/tolerant";
import { titleOf } from "@/lib/safeTitle";

/*
 * The posts list (#288): GitHub's issue list. Status tabs with their counts,
 * a search and an area filter in one toolbar, and a dense table whose title
 * is the link; status is a word and a shape, the time is relative with the
 * date and time in its title.
 */

type StatusFilter = "all" | "draft" | "published" | "archived";
const STATUSES: StatusFilter[] = ["all", "published", "draft", "archived"];

/* Below 600px the list is rows, not a table: the phone screen is its own component, so a phone never mounts this one. */
export default function Admin() {
  return usePhone() ? <PostsPhone /> : <PostsDesktop />;
}

function PostsDesktop() {
  const w = useAdminWords();
  const heStatus = useTranslationStatus();
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [cols, setCols] = useState<AdminCollection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [params, setParams] = useSearchParams();

  // Filter state lives in the URL, so a filtered view is bookmarkable and the
  // browser's Back button does what it looks like it should.
  const query = params.get("q") ?? "";
  const status = (params.get("status") as StatusFilter | null) ?? "all";
  const area = params.get("area") ?? "all";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const load = useCallback(() => {
    Promise.all([admin.list(), admin.collections()])
      .then(([p, c]) => {
        setPosts(p);
        setCols(c);
        setSkipped(unreadableCount(p) + unreadableCount(c));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const retry = () => {
    setError(null);
    load();
  };

  const areaTitle = useMemo(() => {
    const map = new Map((cols ?? []).map((c) => [c.slug, c.title]));
    return (slug: string) => map.get(slug) ?? slug;
  }, [cols]);

  /* The list endpoint already returns every post, so searching and filtering
     are local: instant on a phone, and no round-trip per keystroke. */
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (posts ?? [])
      .filter((p) => (area === "all" ? true : p.collection === area))
      .filter((p) =>
        !q ? true : [p.title, p.slug, p.excerpt, ...p.tags].some((field) => field.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [posts, query, area]);
  const shown = matching.filter((p) => (status === "all" ? true : p.status === status));
  const countOf = (s: StatusFilter) => (s === "all" ? matching.length : matching.filter((p) => p.status === s).length);
  const tabLabel: Record<StatusFilter, string> = {
    all: w.all,
    published: w.status.published,
    draft: w.drafts,
    archived: w.status.archived,
  };

  return (
    <AdminShell title={w.nav.posts} section="posts" counts={{ posts: posts?.length, areas: cols?.length }}>
      <div className="a-wrap">
        <PageHeader
          title={w.nav.posts}
          description={w.notesIntro}
          actions={
            <>
              <Link to="/admin/areas/new" className="a-btn">
                {w.newArea}
              </Link>
              <Link to="/admin/posts/new" className="a-btn a-btn-primary">
                <Plus aria-hidden="true" />
                {w.newNote}
              </Link>
            </>
          }
        />

        <div className="a-toolbar">
          <label className="a-search">
            <span className="sr-only">{w.searchNotes}</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              className="a-input"
              placeholder={w.searchNotesHint}
              value={query}
              onChange={(e) => setParam("q", e.target.value)}
            />
          </label>
          <label className="w-full sm:w-auto">
            <span className="sr-only">{w.filterArea}</span>
            <Select className="sm:w-48" value={area} onChange={(e) => setParam("area", e.target.value)}>
              <option value="all">{w.allAreas}</option>
              {(cols ?? []).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <p className="sr-only" role="status">
          {posts === null ? w.loading : plural("en", shown.length, w.notesCount)}
        </p>

        <UnreadableNote count={skipped} />

        {error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : posts === null ? (
          <LoadingRows rows={5} />
        ) : posts.length === 0 ? (
          <EmptyState
            title={w.nothingWritten}
            action={
              <Link to="/admin/posts/new" className="a-btn a-btn-primary">
                {w.writeFirst}
              </Link>
            }
          />
        ) : (
          <div className="a-box">
            <div className="a-box-head !p-0 !min-h-0">
              <div className="a-tabs w-full border-0 px-2" role="group" aria-label={w.filterStatus}>
                {STATUSES.map((s) => (
                  <button key={s} type="button" className="a-tab" aria-pressed={status === s} onClick={() => setParam("status", s)}>
                    {tabLabel[s]}
                    <Counter n={countOf(s)} />
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="a-blank">
                <p className="a-blank-title">{w.noMatch}</p>
                <button type="button" className="a-btn mt-4" onClick={() => setParams({}, { replace: true })}>
                  {w.clearFilters}
                </button>
              </div>
            ) : (
              <table className="a-table">
                <caption className="sr-only">{w.nav.posts}</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">{w.colTitle}</th>
                    <th scope="col">{w.colStatus}</th>
                    <th scope="col">{w.colUpdated}</th>
                    <th scope="col">{w.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const changes = p.status === "published" && Boolean(p.draft);
                    return (
                      <tr key={p.slug}>
                        <td className="a-main">
                          <Link to={`/admin/posts/${p.slug}`} className="a-row-title a-clamp-2" title={titleOf(p.title, p.slug)}>
                            {titleOf(p.title, p.slug)}
                          </Link>
                          <span className="a-row-meta">
                            <span>{areaTitle(p.collection)}</span>
                            <span className="tabular-nums">{w.minutes(p.readingMinutes)}</span>
                            {p.tags.length > 0 && (
                              <span className="flex flex-wrap gap-1">
                                {p.tags.map((t) => (
                                  <span key={t} className="a-tag">
                                    {t}
                                  </span>
                                ))}
                              </span>
                            )}
                            <span className="md:hidden">
                              <RelTime iso={p.updatedAt} />
                            </span>
                          </span>
                          <span className="mt-2 flex flex-wrap gap-1.5 sm:hidden">
                            <StatePill state={p.status} />
                            {changes && <StatePill state="changes" />}
                            <TranslationPill status={heStatus("post", p.slug)} />
                          </span>
                        </td>
                        <td className="a-fit hidden sm:table-cell">
                          <span className="flex flex-wrap justify-end gap-1.5">
                            {changes && <StatePill state="changes" />}
                            <StatePill state={p.status} />
                            <TranslationPill status={heStatus("post", p.slug)} />
                          </span>
                        </td>
                        <td className="a-when a-fit hidden md:table-cell">
                          <RelTime iso={p.updatedAt} />
                        </td>
                        <td className="a-fit !pl-0">
                          {p.status === "published" ? (
                            <a
                              href={`https://yehudabriskman.com/blog/${p.slug}`}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="a-btn a-btn-ghost a-icon-btn"
                              aria-label={w.viewOnSite(p.title)}
                              title={w.viewOnSite(p.title)}
                            >
                              <ExternalLink aria-hidden="true" />
                            </a>
                          ) : (
                            <span className="inline-block w-8" aria-hidden="true" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
