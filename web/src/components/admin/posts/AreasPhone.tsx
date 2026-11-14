import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/admin/ui";
import { FilterChips, FiltersRestoredNote } from "@/components/ui/FilterChips";
import { FilterSheet } from "@/components/ui/FilterSheet";
import type { FilterDef } from "@/components/ui/filters";
import { ICON } from "@/components/ui/icons";
import { RecordRow } from "@/components/ui/RecordRow";
import { SelectionBar, SelectionHeader, type SelectionAction } from "@/components/ui/SelectionBar";
import { StatusGlyph, type StatusKind } from "@/components/ui/StatusGlyph";
import { UndoToast, useUndoable } from "@/components/ui/UndoToast";
import { useSavedFilters } from "@/components/ui/useSavedFilters";
import { useSelection } from "@/components/ui/useSelection";
import { useAdminWords } from "@/i18n/admin";
import { admin, type AdminCollection, type AdminPost } from "@/services/admin";
import { useTranslationStatus } from "@/services/translations";
import { usePostsPhoneWords } from "./words";

/*
 * Areas below 600px. The job: find an area and see whether the site shows it. A row is the name, how many posts
 * it holds, and ONE glyph only when it is hidden (or, if shown, when its Hebrew is missing or old). The slug,
 * the repository and the order are in the editor. Bulk: Hide, which the server does as a soft hide and which
 * waits out an Undo window; showing an area again is the editor's visibility field.
 */
export default function AreasPhone() {
  const w = useAdminWords();
  const p = usePostsPhoneWords();
  const nav = useNavigate();
  const heStatus = useTranslationStatus();
  const [cols, setCols] = useState<AdminCollection[] | null>(null);
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [note, setNote] = useState("");
  const undoable = useUndoable();

  const load = useCallback(() => {
    Promise.all([admin.collections(), admin.list()])
      .then(([c, list]) => {
        setCols(c);
        setPosts(list);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(load, [load]);

  const countFor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const x of posts ?? []) counts.set(x.collection, (counts.get(x.collection) ?? 0) + 1);
    return (slug: string) => counts.get(slug) ?? 0;
  }, [posts]);
  const statusOf = useCallback((c: AdminCollection) => (hidden.has(c.slug) ? "hidden" : c.status), [hidden]);

  const defs = useMemo<FilterDef[]>(
    () => [
      { id: "status", kind: "segmented", label: p.filterVisibility, options: (["published", "hidden"] as const).map((s) => ({ value: s, label: p.visibility[s], count: (cols ?? []).filter((c) => statusOf(c) === s).length })) },
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
    [p, cols, statusOf],
  );
  const [filters, setFilters, saved] = useSavedFilters("areas", defs);
  const str = (id: string) => (typeof filters[id] === "string" ? (filters[id] as string) : "");
  const status = str("status");
  const kind = str("kind");
  const he = str("he");

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...(cols ?? [])]
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .filter((c) => !status || statusOf(c) === status)
      .filter((c) => !kind || c.kind === kind)
      .filter((c) => !he || heStatus("area", c.slug) === he)
      .filter((c) => !term || [c.title, c.slug].some((f) => f.toLowerCase().includes(term)));
  }, [cols, q, status, kind, he, statusOf, heStatus]);
  const selection = useSelection(useMemo(() => visible.map((c) => c.slug), [visible]));

  const hide = (slugs: string[]) => {
    const list = (cols ?? []).filter((c) => slugs.includes(c.slug) && c.status !== "hidden");
    if (list.length === 0) return;
    const ids = list.map((c) => c.slug);
    setHidden((cur) => new Set([...cur, ...ids]));
    const show = () => setHidden((cur) => new Set([...cur].filter((x) => !ids.includes(x))));
    undoable.schedule({
      message: p.hiding(ids.length),
      onUndo: show,
      commit: async () => {
        const failed = (await Promise.allSettled(ids.map((slug) => admin.hideCollection(slug)))).filter((r) => r.status === "rejected").length;
        setNote(failed ? p.failedSome(failed) : "");
        show();
        load();
      },
    });
  };
  const actions: SelectionAction<string>[] = [{ id: "hide", icon: ICON.hidden, label: p.hideAct, run: hide }];

  const rowFor = (c: AdminCollection) => {
    const state = statusOf(c);
    const hebrew = state === "published" ? heStatus("area", c.slug) : null;
    const glyph: StatusKind | null = state === "hidden" ? "hidden" : hebrew === "missing" || hebrew === "stale" ? hebrew : null;
    return (
      <RecordRow
        key={c.slug}
        as="li"
        icon={c.kind === "site" ? ICON.note : ICON.project}
        title={c.title}
        facts={[{ icon: ICON.note, text: p.postsIn(countFor(c.slug)), label: w.colNotes }]}
        status={glyph ? <StatusGlyph kind={glyph} /> : undefined}
        selectable={selection.on}
        selected={selection.has(c.slug)}
        openLabel={selection.on ? c.title : p.openArea(c.title, p.postsIn(countFor(c.slug)))}
        onOpen={() => (selection.on ? selection.toggle(c.slug) : nav(`/admin/areas/${c.slug}`))}
        onLongPress={() => selection.enter(c.slug)}
      />
    );
  };

  const filtered = Boolean(status || kind || he || q.trim());

  return (
    <AdminShell title={w.nav.areas} section="areas" counts={{ posts: posts?.length, areas: cols?.length }}>
      <div className="a-wrap min-w-0 space-y-2" data-testid="areas-phone">
        <h1 className="sr-only">{w.nav.areas}</h1>

        {selection.on ? (
          <SelectionHeader selection={selection} total={visible.length} />
        ) : (
          <div className="flex items-center gap-2">
            <input type="search" className="a-input min-h-[44px] min-w-0 flex-1 !ps-3 text-base" dir="auto" aria-label={p.searchAreas} placeholder={p.searchAreasHint} value={q} onChange={(e) => setQ(e.target.value)} />
            {visible.length > 0 && <SelectionHeader selection={selection} total={visible.length} />}
            <Link to="/admin/areas/new" className="a-btn a-btn-primary inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center" aria-label={p.newArea} title={p.newArea}>
              <ICON.add size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
            </Link>
          </div>
        )}

        <FilterChips defs={defs} value={filters} onChange={setFilters} common={["status", "kind"]} onOpenSheet={() => setSheet(true)} resultCount={visible.length} />
        <FiltersRestoredNote restored={saved.restored} onUndo={saved.undoRestore} onDismiss={saved.dismissRestored} />

        <p className="sr-only" role="status">{cols ? p.countAreas(visible.length) : ""}</p>
        {note && <p role="status" className="a-hint !mt-0">{note}</p>}

        {error ? (
          <ErrorState message={error} onRetry={() => (setError(null), load())} />
        ) : cols === null ? (
          <LoadingRows label={w.loading} />
        ) : cols.length === 0 ? (
          <EmptyState title={p.noAreas} action={<Link to="/admin/areas/new" className="a-btn a-btn-primary">{p.firstArea}</Link>} />
        ) : visible.length === 0 ? (
          <EmptyState title={w.noMatch} action={filtered ? <button type="button" className="a-btn min-h-[44px]" onClick={() => (setQ(""), saved.clear())}>{w.clearFilters}</button> : undefined} />
        ) : (
          <ul aria-label={w.nav.areas} className="a-box m-0 list-none overflow-hidden p-0">
            {visible.map(rowFor)}
          </ul>
        )}

        <SelectionBar selection={selection} actions={actions} />
      </div>

      <FilterSheet open={sheet} onClose={() => setSheet(false)} defs={defs} value={filters} onApply={(next) => (setFilters(next), setSheet(false))} />
      <UndoToast undoable={undoable} />
    </AdminShell>
  );
}
