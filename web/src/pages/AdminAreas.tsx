import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import HeGlyph from "@/components/admin/posts/HeGlyph";
import { Empty, ErrorState, PageHeader, UnreadableNote } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column, type DataTableWords } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar, useFilterBar } from "@/components/ui/FilterBar";
import type { FilterDef } from "@/components/ui/filters";
import { ICON } from "@/components/ui/icons";
import { RowActions } from "@/components/ui/RowActions";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { useAdminWords } from "@/i18n/admin";
import { useFiltersWords } from "@/i18n/filters";
import { toast } from "@/lib/toast";
import { admin, type AdminCollection, type AdminPost } from "@/services/admin";
import { unreadableCount } from "@/services/tolerant";
import { useTranslationStatus } from "@/services/translations";
import AreasPhone from "@/components/admin/posts/AreasPhone";
import { usePostsPhoneWords } from "@/components/admin/posts/words";
import posts from "@/components/admin/posts/posts.module.css";
import { usePhone } from "@/hooks/usePhone";

/*
 * The areas index. A table in the order the site shows them, so the order is the row order and has no column of
 * its own (it is set in the area's own settings). A visible area says nothing; a hidden one carries a glyph. The
 * row's one primary is Edit; Hide sits in More behind a confirm. Below 600px the phone list is its own component.
 */
export default function AdminAreas() {
  return usePhone() ? <AreasPhone /> : <AreasDesktop />;
}

function AreasDesktop() {
  const w = useAdminWords();
  const p = usePostsPhoneWords();
  const f = useFiltersWords();
  const nav = useNavigate();
  const heStatus = useTranslationStatus();
  const [cols, setCols] = useState<AdminCollection[] | null>(null);
  const [list, setList] = useState<AdminPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [asking, setAsking] = useState<AdminCollection | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([admin.collections(), admin.list()])
      .then(([c, l]) => {
        setCols(c);
        setList(l);
        setSkipped(unreadableCount(c) + unreadableCount(l));
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : w.loadFailed));
  }, [w.loadFailed]);
  useEffect(load, [load]);

  const countFor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const x of list ?? []) counts.set(x.collection, (counts.get(x.collection) ?? 0) + 1);
    return (slug: string) => counts.get(slug) ?? 0;
  }, [list]);

  const defs = useMemo<FilterDef[]>(
    () => [
      { id: "status", kind: "segmented", label: p.filterVisibility, options: (["published", "hidden"] as const).map((s) => ({ value: s, label: p.visibility[s], count: (cols ?? []).filter((c) => c.status === s).length })) },
      { id: "kind", kind: "segmented", label: p.filterKind, options: (["site", "project"] as const).map((k) => ({ value: k, label: p.kinds[k] })) },
      {
        id: "he",
        kind: "segmented",
        label: p.filterHebrew,
        options: [
          { value: "missing", label: p.heMissing },
          { value: "stale", label: p.heStale },
        ],
      },
    ],
    [p, cols],
  );
  const bar = useFilterBar("areas", defs);
  const str = (id: string) => (typeof bar.filters[id] === "string" ? (bar.filters[id] as string) : "");

  const shown = useMemo(() => {
    const term = bar.query.trim().toLowerCase();
    return [...(cols ?? [])]
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .filter((c) => !str("status") || c.status === str("status"))
      .filter((c) => !str("kind") || c.kind === str("kind"))
      .filter((c) => !str("he") || heStatus("area", c.slug) === str("he"))
      .filter((c) => !term || [c.title, c.slug].some((x) => x.toLowerCase().includes(term)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, bar.query, bar.filters, heStatus]);

  async function hide(c: AdminCollection) {
    setBusy(true);
    try {
      await admin.hideCollection(c.slug);
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

  const columns: Column<AdminCollection>[] = [
    {
      id: "area",
      header: w.colArea,
      primary: true,
      cell: (c) => (
        <>
          {c.title}
          {c.status === "hidden" && <StatusGlyph kind="hidden" size={16} className="ms-2 align-middle" />}
          <code dir="ltr" className={posts.slug}>
            /{c.slug}
          </code>
        </>
      ),
    },
    { id: "kind", header: p.filterKind, hideBelow: "md", width: "9rem", cell: (c) => p.kinds[c.kind] },
    {
      id: "repo",
      header: w.colRepo,
      hideBelow: "lg",
      width: "14rem",
      cell: (c) => (c.repo ? <code dir="ltr">{`${c.repo.owner}/${c.repo.name}`}</code> : <Empty label={p.noRepo} />),
    },
    { id: "posts", header: w.colNotes, align: "num", width: "6rem", cell: (c) => countFor(c.slug) },
    { id: "he", header: w.areaHebrew, hideBelow: "sm", width: "6rem", cell: (c) => (c.status === "published" ? <HeGlyph status={heStatus("area", c.slug)} /> : <Empty />) },
  ];

  const first = cols !== null && cols.length === 0;
  const filtered = Boolean(str("status") || str("kind") || str("he") || bar.query.trim());

  return (
    <AdminShell title={w.nav.areas} section="areas" counts={{ posts: list?.length, areas: cols?.length }}>
      <div className="a-wrap">
        <PageHeader
          title={w.nav.areas}
          description={p.areaIntro}
          primary={{ id: "new", label: w.newArea, icon: ICON.add, onSelect: () => nav("/admin/areas/new") }}
          newMenu
        />

        <div className={posts.page}>
          {!first && (
            <FilterBar
              defs={defs}
              value={bar.filters}
              onChange={bar.setFilters}
              common={["status", "kind", "he"]}
              query={bar.query}
              onQueryChange={bar.setQuery}
              resultCount={shown.length}
              words={{ search: p.searchAreas, clearSearch: p.clearSearch, results: f.results, clearAll: f.clearAll }}
            />
          )}

          <p className="sr-only" role="status">
            {cols === null ? w.loading : p.countAreas(shown.length)}
          </p>

          <UnreadableNote count={skipped} />

          {error && !(cols ?? []).length ? (
            <ErrorState message={error} onRetry={() => (setError(null), load())} />
          ) : first ? (
            <EmptyState variant="first-use" title={p.noAreas} action={{ label: p.firstArea, onClick: () => nav("/admin/areas/new") }} />
          ) : (
            <DataTable<AdminCollection>
              label={w.nav.areas}
              rows={shown}
              columns={columns}
              rowKey={(c) => c.slug}
              rowLabel={(c) => c.title}
              words={words}
              loading={cols === null && !error}
              onOpen={(c) => nav(`/admin/areas/${c.slug}`)}
              empty={<EmptyState variant="no-results" title={w.noMatch} clear={filtered ? { label: w.clearFilters, onClick: bar.clearAll } : undefined} />}
              rowActions={(c) => (
                <RowActions
                  label={c.title}
                  moreLabel={w.moreActions}
                  primary={{ id: "edit", icon: ICON.draft, label: p.edit, onSelect: () => nav(`/admin/areas/${c.slug}`) }}
                  actions={c.status === "published" ? [{ id: "hide", icon: ICON.hidden, label: p.hideAct, tone: "danger", onSelect: () => setAsking(c) }] : []}
                />
              )}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={asking !== null}
        title={asking ? p.hideTitle(asking.title) : ""}
        confirm={p.hideAct}
        cancel={p.keep}
        busy={busy}
        onConfirm={() => asking && void hide(asking)}
        onCancel={() => setAsking(null)}
      >
        {p.hideBody}
      </ConfirmDialog>
    </AdminShell>
  );
}
