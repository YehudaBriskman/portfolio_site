import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { Empty, ErrorState, PageHeader, RelTime, UnreadableNote } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column, type DataTableWords } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar, useFilterBar } from "@/components/ui/FilterBar";
import { FilterSheet } from "@/components/ui/FilterSheet";
import type { FilterDef } from "@/components/ui/filters";
import { ICON } from "@/components/ui/icons";
import { RowActions } from "@/components/ui/RowActions";
import { Tabs } from "@/components/ui/Tabs";
import { useAdminWords } from "@/i18n/admin";
import { useFiltersWords } from "@/i18n/filters";
import { plural } from "@/i18n/words";
import { toast } from "@/lib/toast";
import { titleOf } from "@/lib/safeTitle";
import { admin, type AdminCollection, type AdminPost } from "@/services/admin";
import { unreadableCount } from "@/services/tolerant";
import { useTranslationStatus } from "@/services/translations";
import LangPair from "./LangPair";
import { usePostsPhoneWords } from "./words";
import styles from "./posts.module.css";

/*
 * The posts list on a desktop: one table whose header sticks. The status is said once, by the tab strip and, on
 * All, by a group header, never by a pill on every row; the language pair and the last-edited time are columns.
 * A row opens the editor; its one primary is Edit and the rest (view live, archive) sit in More. Search and the
 * Hebrew chip are the filter row; the area is in the Filters sheet, as on the phone. Below 600px the phone list
 * is its own component and this one is never mounted.
 */

type StatusFilter = "all" | "draft" | "published" | "archived";
const STATUSES: StatusFilter[] = ["all", "published", "draft", "archived"];
const RANK: Record<string, number> = { published: 0, draft: 1, archived: 2 };

export default function PostsDesktop() {
  const w = useAdminWords();
  const p = usePostsPhoneWords();
  const f = useFiltersWords();
  const nav = useNavigate();
  const heStatus = useTranslationStatus();
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [cols, setCols] = useState<AdminCollection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [asking, setAsking] = useState<AdminPost | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [params, setParams] = useSearchParams();
  const status = (STATUSES as string[]).includes(params.get("status") ?? "") ? (params.get("status") as StatusFilter) : "all";

  const load = useCallback(() => {
    Promise.all([admin.list(), admin.collections()])
      .then(([list, areas]) => {
        setPosts(list);
        setCols(areas);
        setSkipped(unreadableCount(list) + unreadableCount(areas));
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : w.loadFailed));
  }, [w.loadFailed]);
  useEffect(load, [load]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        id: "he",
        kind: "segmented",
        label: p.filterHebrew,
        options: [
          { value: "missing", label: p.heMissing },
          { value: "stale", label: p.heStale },
        ],
      },
      {
        id: "area",
        kind: "segmented",
        label: p.filterArea,
        options: (cols ?? []).map((c) => ({ value: c.slug, label: c.title, count: (posts ?? []).filter((x) => x.collection === c.slug).length })),
      },
    ],
    [p, cols, posts],
  );
  const bar = useFilterBar("posts", defs);
  const str = (id: string) => (typeof bar.filters[id] === "string" ? (bar.filters[id] as string) : "");
  const area = str("area");
  const he = str("he");
  const areaTitle = useMemo(() => {
    const map = new Map((cols ?? []).map((c) => [c.slug, c.title]));
    return (slug: string) => map.get(slug) ?? slug;
  }, [cols]);

  /* The list endpoint already returns every post, so searching and filtering are local: no round-trip per keystroke. */
  const matching = useMemo(() => {
    const q = bar.query.trim().toLowerCase();
    return (posts ?? [])
      .filter((x) => !area || x.collection === area)
      .filter((x) => !he || heStatus("post", x.slug) === he)
      .filter((x) => !q || [x.title, x.slug, x.excerpt, ...x.tags].some((field) => field.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [posts, bar.query, area, he, heStatus]);
  const shown = useMemo(() => {
    const list = status === "all" ? matching : matching.filter((x) => x.status === status);
    /* On All the rows sit under their status header, so they are put in that order (newest first within it). */
    return status === "all" ? [...list].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9)) : list;
  }, [matching, status]);
  const countOf = (s: StatusFilter) => (s === "all" ? matching.length : matching.filter((x) => x.status === s).length);
  const tabLabel: Record<StatusFilter, string> = { all: w.all, published: w.status.published, draft: w.drafts, archived: w.status.archived };

  const setStatus = (s: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (s === "all") next.delete("status");
        else next.set("status", s);
        return next;
      },
      { replace: true },
    );

  async function archive(post: AdminPost) {
    setBusy(true);
    try {
      await admin.archive(post.slug);
      load();
    } catch {
      toast.error(p.failedOne);
    } finally {
      setBusy(false);
      setAsking(null);
    }
  }

  const words: DataTableWords = {
    selectAll: f.selectAll,
    selectRow: (label) => label,
    actions: w.colActions,
    loading: w.loading,
    bulkLabel: w.colActions,
    count: (n) => String(n),
    cancel: p.keep,
    more: w.moreActions,
  };

  const columns: Column<AdminPost>[] = [
    {
      id: "title",
      header: w.colTitle,
      primary: true,
      cell: (x) => (
        <Link to={`/admin/posts/${x.slug}`} className={`${styles.title} a-clamp-2`} title={titleOf(x.title, x.slug)}>
          {titleOf(x.title, x.slug)}
        </Link>
      ),
    },
    { id: "area", header: w.colArea, hideBelow: "lg", width: "10rem", cell: (x) => areaTitle(x.collection) },
    {
      id: "lang",
      header: w.colStatus,
      hideBelow: "sm",
      width: "7rem",
      cell: (x) => (x.status === "published" ? <LangPair changes={Boolean(x.draft)} he={heStatus("post", x.slug)} /> : <Empty />),
    },
    {
      id: "updated",
      header: w.colUpdated,
      hideBelow: "sm",
      width: "8rem",
      cell: (x) => <RelTime iso={x.updatedAt} />,
    },
  ];

  const filtered = Boolean(area || he || bar.query.trim());
  const first = posts !== null && posts.length === 0;

  return (
    <AdminShell title={w.nav.posts} section="posts" counts={{ posts: posts?.length, areas: cols?.length }}>
      <div className="a-wrap">
        <PageHeader
          title={w.nav.posts}
          description={w.notesIntro}
          primary={{ id: "new", label: w.newNote, icon: ICON.add, onSelect: () => nav("/admin/posts/new") }}
        />

        <div className={styles.page}>
          {!first && (
            <>
              <Tabs
                label={w.filterStatus}
                value={status}
                onValueChange={setStatus}
                items={STATUSES.map((s) => ({ id: s, label: tabLabel[s], count: posts ? countOf(s) : undefined }))}
              />
              <FilterBar
                defs={defs}
                value={bar.filters}
                onChange={bar.setFilters}
                common={["he"]}
                onOpenSheet={() => setSheet(true)}
                query={bar.query}
                onQueryChange={bar.setQuery}
                resultCount={shown.length}
                words={{ search: p.searchPosts, clearSearch: p.clearSearch, results: f.results, clearAll: f.clearAll }}
              />
            </>
          )}

          <p className="sr-only" role="status">
            {posts === null ? w.loading : plural("en", shown.length, w.notesCount)}
          </p>

          <UnreadableNote count={skipped} />

          {error && !(posts ?? []).length ? (
            <ErrorState message={error} onRetry={() => (setError(null), load())} />
          ) : first ? (
            <EmptyState
              variant="first-use"
              title={w.nothingWritten}
              action={{ label: w.writeFirst, onClick: () => nav("/admin/posts/new") }}
            />
          ) : (
            <DataTable<AdminPost>
              label={w.nav.posts}
              rows={shown}
              columns={columns}
              rowKey={(x) => x.slug}
              rowLabel={(x) => titleOf(x.title, x.slug)}
              words={words}
              density="comfortable"
              loading={posts === null && !error}
              onOpen={(x) => nav(`/admin/posts/${x.slug}`)}
              groupBy={status === "all" ? (x) => x.status : undefined}
              groupLabel={(key, list) => `${w.status[key as "published"] ?? key} ${list.length}`}
              empty={
                <EmptyState
                  variant="no-results"
                  title={w.noMatch}
                  clear={filtered ? { label: w.clearFilters, onClick: bar.clearAll } : undefined}
                />
              }
              rowActions={(x) => {
                const title = titleOf(x.title, x.slug);
                return (
                  <RowActions
                    label={title}
                    moreLabel={w.moreActions}
                    primary={{ id: "edit", icon: ICON.draft, label: p.edit, onSelect: () => nav(`/admin/posts/${x.slug}`) }}
                    actions={[
                      ...(x.status === "published"
                        ? [{ id: "live", icon: ICON.external, label: p.viewLive, onSelect: () => void window.open(`https://yehudabriskman.com/blog/${x.slug}`, "_blank", "noopener,noreferrer") }]
                        : []),
                      ...(x.status !== "archived"
                        ? [{ id: "archive", icon: ICON.archived, label: p.archiveAct, tone: "danger" as const, onSelect: () => setAsking(x) }]
                        : []),
                    ]}
                  />
                );
              }}
            />
          )}
        </div>
      </div>

      <FilterSheet open={sheet} onClose={() => setSheet(false)} defs={defs} value={bar.filters} onApply={(next) => (bar.setFilters(next), setSheet(false))} />

      <ConfirmDialog
        open={asking !== null}
        title={asking ? p.archiveTitle(titleOf(asking.title, asking.slug)) : ""}
        confirm={p.archiveAct}
        cancel={p.keep}
        busy={busy}
        onConfirm={() => asking && void archive(asking)}
        onCancel={() => setAsking(null)}
      >
        {p.archiveBody}
      </ConfirmDialog>
    </AdminShell>
  );
}
