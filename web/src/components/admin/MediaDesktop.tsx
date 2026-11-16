import { useMemo, useState, type MutableRefObject } from "react";
import { useSearchParams } from "react-router-dom";
import { Empty } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type BulkAction, type Column, type DataTableWords } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar, useFilterBar } from "@/components/ui/FilterBar";
import { FiltersRestoredNote } from "@/components/ui/FilterChips";
import type { FilterDef } from "@/components/ui/filters";
import { Skeleton } from "@/components/ui/Skeleton";
import { SelectionHeader } from "@/components/ui/SelectionBar";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { useSelection } from "@/components/ui/useSelection";
import { useLang } from "@/components/dashboard/i18n";
import { useAdminWords } from "@/i18n/admin";
import { useFiltersWords } from "@/i18n/filters";
import { toast } from "@/lib/toast";
import { formatWhen } from "@/lib/safeTime";
import { isDraft, filterMedia, formatBytes, media, MEDIA_KINDS, type MediaItem, type MediaKind } from "@/services/media";
import { MediaGrid } from "./MediaGrid";
import { useMediaPhoneWords } from "./mediaPhoneWords";
import { useMediaUploadWords } from "./mediaUploadWords";
import styles from "./Media.module.css";

/*
 * The library on a desktop (S7): one filter bar (search and the kind chips),
 * a view toggle (grid or list, in the address), Select for a bulk delete, and
 * the item itself in a side panel the page owns. Unused items only are ever
 * listed in select mode, and an item in use is dropped again before the server
 * is asked, exactly as on a phone.
 */

const uses = (m: MediaItem) => m.usedBy?.length ?? null;
const isUnused = (m: MediaItem) => m.usedBy !== undefined && m.usedBy.length === 0;
const hasAlt = (m: MediaItem) => m.alt.trim() !== "";

export default function MediaDesktop({
  items,
  openId,
  onOpen,
  onDeleted,
  pick,
}: {
  /** null while the library loads. */
  items: MediaItem[] | null;
  openId: string | null;
  onOpen: (id: string) => void;
  /** The server has deleted these: drop them from the page's list. */
  onDeleted: (gone: MediaItem[]) => void;
  /** The header's Upload opens the chooser through this. */
  pick: MutableRefObject<(() => void) | null>;
}) {
  const p = useMediaPhoneWords();
  const up = useMediaUploadWords();
  const f = useFiltersWords();
  const w = useAdminWords();
  const lang = useLang();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "list" ? "list" : "grid";
  const setView = (v: "grid" | "list") =>
    setParams(
      (cur) => {
        const n = new URLSearchParams(cur);
        if (v === "grid") n.delete("view");
        else n.set("view", v);
        return n;
      },
      { replace: true },
    );

  const defs = useMemo<FilterDef[]>(
    () => [
      { id: "kind", kind: "segmented", label: p.kindFilter, options: MEDIA_KINDS.map((k) => ({ value: k, label: p.kinds[k] })) },
      { id: "only", kind: "multi", label: p.onlyFilter, options: [{ value: "unused", label: p.unused }, { value: "drafts", label: p.drafts }, { value: "noalt", label: p.noAlt }] },
    ],
    [p],
  );
  const bar = useFilterBar("media", defs);
  const kind = typeof bar.filters.kind === "string" && (MEDIA_KINDS as readonly string[]).includes(bar.filters.kind) ? (bar.filters.kind as MediaKind) : null;
  const onlyValue = bar.filters.only;
  const only = useMemo(() => (Array.isArray(onlyValue) ? onlyValue : []), [onlyValue]);

  const visible = useMemo(
    () =>
      filterMedia(items ?? [], bar.query, kind ? [kind] : null).filter(
        (m) => (!only.includes("unused") || isUnused(m)) && (!only.includes("drafts") || isDraft(m)) && (!only.includes("noalt") || !hasAlt(m)),
      ),
    [items, bar.query, kind, only],
  );
  const unused = visible.filter(isUnused);
  const selection = useSelection(unused.map((m) => m.id));
  const shown = selection.on ? unused : visible;

  const [asking, setAsking] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = (items ?? []).filter((m) => asking?.includes(m.id) && isUnused(m));

  async function erase() {
    setBusy(true);
    const results = await Promise.allSettled(chosen.map((m) => media.remove(m)));
    const gone = chosen.filter((_, i) => results[i].status === "fulfilled");
    onDeleted(gone);
    if (gone.length === chosen.length) toast.success(p.deletedMany(gone.length));
    else toast.error(p.deleteFailed(chosen.length - gone.length));
    setBusy(false);
    setAsking(null);
    selection.exit();
  }

  const label = (m: MediaItem) => (hasAlt(m) ? m.alt : m.name);
  const table: DataTableWords = {
    selectAll: f.selectAll,
    selectRow: (l) => l,
    actions: w.colActions,
    loading: p.loading,
    bulkLabel: p.selectedBar,
    count: p.selectedCount,
    cancel: p.cancel,
    more: w.moreActions,
  };
  const columns: Column<MediaItem>[] = [
    {
      id: "item",
      header: p.colItem,
      primary: true,
      cell: (m) => (
        <span className={styles.rowItem}>
          {m.preview ? <img src={m.preview} alt="" className={styles.rowThumb} data-kind={m.kind} loading="lazy" decoding="async" width={40} height={40} /> : <span className={styles.rowThumb} aria-hidden="true" />}
          <span className="a-clamp-2 min-w-0">{label(m)}</span>
          {!hasAlt(m) && <StatusGlyph kind="attention" label={p.noAlt} size={16} />}
          {isDraft(m) && <StatusGlyph kind="draft" withWord size={16} />}
        </span>
      ),
    },
    { id: "kind", header: p.kind, hideBelow: "sm", width: "6rem", cell: (m) => p.kindOne[m.kind] },
    { id: "size", header: p.size, hideBelow: "md", width: "6rem", align: "num", cell: (m) => formatBytes(m.bytes), sort: (a, b) => a.bytes - b.bytes },
    { id: "uses", header: p.colUses, hideBelow: "sm", width: "5rem", align: "num", cell: (m) => ((uses(m) ?? 0) > 0 ? uses(m) : <Empty />) },
    {
      id: "added",
      header: p.added,
      hideBelow: "lg",
      width: "8rem",
      cell: (m) => formatWhen(m.createdAt, lang, { day: "numeric", month: "short", year: "numeric" }),
    },
  ];
  const bulk: BulkAction[] = [{ id: "delete", label: p.bulkDelete, tone: "danger", confirm: p.bulkDeleteConfirm, onRun: (ids) => setAsking(ids) }];

  const first = items !== null && items.length === 0;
  const filtered = bar.query.trim() !== "" || kind !== null || only.length > 0;

  return (
    <div className={styles.page}>
      {!first && (
        <div className={styles.toolbar}>
          <FilterBar
            className={styles.filters}
            defs={defs}
            value={bar.filters}
            onChange={bar.setFilters}
            common={["kind", "only"]}
            query={bar.query}
            onQueryChange={bar.setQuery}
            resultCount={visible.length}
            words={{ search: p.searchLabel, clearSearch: p.clearSearch, results: f.results, clearAll: f.clearAll }}
          />
          <div className={styles.tools}>
            <div role="group" aria-label={p.viewLabel} className={styles.views}>
              <button type="button" className={styles.view} aria-pressed={view === "grid"} onClick={() => setView("grid")}>
                {p.viewGrid}
              </button>
              <button type="button" className={styles.view} aria-pressed={view === "list"} onClick={() => setView("list")}>
                {p.viewList}
              </button>
            </div>
            <SelectionHeader selection={selection} total={unused.length} />
          </div>
        </div>
      )}
      <FiltersRestoredNote restored={bar.saved.restored} onUndo={bar.saved.undoRestore} onDismiss={bar.saved.dismissRestored} />
      {selection.on && <p className="a-hint !mt-0">{p.selectNote}</p>}

      <p className="sr-only" role="status">
        {items === null ? p.loading : p.count(shown.length, items.length)}
      </p>

      {items === null ? (
        <Skeleton variant={view === "list" ? "rows" : "cards"} rows={view === "list" ? 6 : 8} label={p.loading} />
      ) : first ? (
        <EmptyState variant="first-use" title={p.empty} description={p.emptyHint} action={{ label: up.upload, onClick: () => pick.current?.() }} />
      ) : view === "list" ? (
        <DataTable<MediaItem>
          label={p.title}
          rows={shown}
          columns={columns}
          rowKey={(m) => m.id}
          rowLabel={label}
          words={table}
          density="comfortable"
          selection={selection}
          bulkActions={bulk}
          onOpen={(m) => onOpen(m.id)}
          empty={<NoMatch q={bar.query} filtered={filtered} onClear={bar.clearAll} />}
        />
      ) : shown.length === 0 ? (
        <NoMatch q={bar.query} filtered={filtered} onClear={bar.clearAll} />
      ) : (
        <MediaGrid
          items={shown}
          selected={selection.on ? undefined : openId}
          check={selection.on ? { has: selection.has } : undefined}
          onSelect={(m) => (selection.on ? selection.toggle(m.id) : onOpen(m.id))}
          label={p.gridLabel(shown.length)}
        />
      )}

      {selection.on && view === "grid" && (
        <div role="toolbar" aria-label={p.selectedBar} className={styles.bulk}>
          <span role="status" aria-live="polite" className={styles.bulkCount}>
            {p.selectedCount(selection.count)}
          </span>
          <button type="button" className="a-btn a-btn-danger" disabled={selection.count === 0} onClick={() => setAsking(selection.ids)}>
            {p.bulkDelete}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={asking !== null}
        title={p.bulkDeleteTitle(chosen.length)}
        confirm={p.bulkDeleteConfirm(chosen.length)}
        cancel={p.keep}
        busy={busy}
        onConfirm={() => void erase()}
        onCancel={() => setAsking(null)}
      >
        {p.bulkDeleteBody}
      </ConfirmDialog>
    </div>
  );
}

function NoMatch({ q, filtered, onClear }: { q: string; filtered: boolean; onClear: () => void }) {
  const p = useMediaPhoneWords();
  const f = useFiltersWords();
  return <EmptyState variant="no-results" title={q.trim() ? p.noMatchQuery(q.trim()) : p.noMatch} clear={filtered ? { label: f.clearAll, onClick: onClear } : undefined} />;
}
