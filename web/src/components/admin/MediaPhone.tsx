import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { FilterChips, FiltersRestoredNote } from "@/components/ui/FilterChips";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { ICON } from "@/components/ui/icons";
import { SelectionBar, SelectionHeader, type SelectionAction } from "@/components/ui/SelectionBar";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { ListPresence } from "@/components/ui/ListPresence";
import { UndoToast, useUndoable } from "@/components/ui/UndoToast";
import { useSavedFilters } from "@/components/ui/useSavedFilters";
import { useSelection } from "@/components/ui/useSelection";
import { tidy, type FilterDef, type Filters } from "@/components/ui/filters";
import { filterMedia, MEDIA_KINDS, media, type MediaItem, type MediaKind } from "@/services/media";
import { useMediaPhoneWords } from "./mediaPhoneWords";
import styles from "./Media.phone.module.css";

/*
 * The library below 600px. A tile answers "which picture is this, does it need
 * me?": the thumbnail, one glyph (no alt text, or in use) and, for an icon or a
 * video, its kind. It is ONE button; its name carries the alt text and every
 * state the glyphs draw, so no state is a badge alone. Everything else is one
 * tap away in the sheet.
 *
 * Bulk select is for unused items only: an item something uses is never listed
 * in select mode and is filtered out again before the server is asked.
 */

/** Used by something; `undefined` means the list did not say, which is never treated as unused. */
const uses = (m: MediaItem) => m.usedBy?.length ?? null;
const isUnused = (m: MediaItem) => m.usedBy !== undefined && m.usedBy.length === 0;
const hasAlt = (m: MediaItem) => m.alt.trim() !== "";

const KIND_ICON = { video: ICON.video, icon: ICON.iconAsset } as const;

export default function MediaPhone({
  items,
  q,
  onQ,
  onOpen,
  onDeleted,
}: {
  items: MediaItem[];
  q: string;
  onQ: (q: string) => void;
  onOpen: (id: string) => void;
  /** The server has deleted these: drop them from the page's list. */
  onDeleted: (gone: MediaItem[]) => void;
}) {
  const p = useMediaPhoneWords();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [note, setNote] = useState("");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const undoable = useUndoable();

  const defs = useMemo<FilterDef[]>(
    () => [
      { id: "kind", kind: "segmented", label: p.kindFilter, options: MEDIA_KINDS.map((k) => ({ value: k, label: p.kinds[k] })) },
      {
        id: "only", kind: "multi", label: p.onlyFilter,
        options: [{ value: "unused", label: p.unused }, { value: "noalt", label: p.noAlt }],
      },
    ],
    [p],
  );
  const [filters, setFilters, saved] = useSavedFilters("media", defs);

  const matches = (f: Filters) => {
    const kind = typeof f.kind === "string" && (MEDIA_KINDS as readonly string[]).includes(f.kind) ? (f.kind as MediaKind) : null;
    const only = Array.isArray(f.only) ? f.only : [];
    return filterMedia(items, q, kind ? [kind] : null).filter(
      (m) => !hidden.has(m.id) && (!only.includes("unused") || isUnused(m)) && (!only.includes("noalt") || !hasAlt(m)),
    );
  };
  const visible = matches(filters);

  const unusedVisible = visible.filter(isUnused);
  const selection = useSelection(unusedVisible.map((m) => m.id));
  const shown = selection.on ? unusedVisible : visible;

  const erase = (ids: string[]) => {
    /* Asked again of the data, not of the selection: an item in use is never sent to the server. */
    const chosen = items.filter((m) => ids.includes(m.id) && isUnused(m));
    const names = new Set(chosen.map((m) => m.id));
    setHidden((h) => new Set([...h, ...names]));
    const show = () => setHidden((h) => new Set([...h].filter((x) => !names.has(x))));
    undoable.schedule({
      message: p.deleting(chosen.length),
      onUndo: show,
      commit: async () => {
        const results = await Promise.allSettled(chosen.map((m) => media.remove(m)));
        const gone = chosen.filter((_, i) => results[i].status === "fulfilled");
        onDeleted(gone);
        show();
        setNote(gone.length === chosen.length ? p.deletedMany(gone.length) : p.deleteFailed(chosen.length - gone.length));
      },
    });
  };

  const actions: SelectionAction<string>[] = [
    { id: "delete", icon: ICON.delete, label: p.bulkDelete, destructive: true, confirm: p.bulkDeleteConfirm, run: erase },
  ];

  const nameOf = (m: MediaItem) => {
    const n = uses(m);
    return [
      hasAlt(m) ? m.alt : m.name,
      p.tileKind[m.kind],
      hasAlt(m) ? "" : p.noAlt,
      n === null ? "" : n === 0 ? p.tileNotUsed : p.tileUsed(n),
    ]
      .filter(Boolean)
      .join(", ");
  };

  const KindIcon = (k: MediaKind) => (k === "video" || k === "icon" ? KIND_ICON[k] : null);

  return (
    <div className={styles.wrap} data-testid="media-phone">
      <div className={styles.bar}>
        <input
          type="search"
          className={`a-input min-h-[44px] text-base ${styles.search}`}
          dir="auto"
          aria-label={p.searchLabel}
          placeholder={p.searchPlaceholder}
          value={q}
          onChange={(e) => onQ(e.target.value)}
        />
      </div>
      <div className={styles.toolbar}>
        <div className={styles.chips}>
          <FilterChips defs={defs} value={filters} onChange={setFilters} common={["kind", "only"]} onOpenSheet={() => setFiltersOpen(true)} resultCount={visible.length} />
        </div>
        <SelectionHeader selection={selection} total={unusedVisible.length} />
      </div>
      <FiltersRestoredNote restored={saved.restored} onUndo={saved.undoRestore} onDismiss={saved.dismissRestored} />
      {selection.on && <p className="a-hint !mt-0">{p.selectNote}</p>}
      <p role="status" className={`a-hint ${styles.note}`}>{note}</p>

      {shown.length === 0 ? (
        <p className="a-hint" data-testid="no-match">{q.trim() ? p.noMatchQuery(q.trim()) : p.noMatch}</p>
      ) : (
        <ListPresence as="ul" variant="tiles" items={shown} itemKey={(m) => m.id} className={`${styles.grid} a-settle`} data-media-grid="" aria-label={p.gridLabel(shown.length)}>
          {(m) => {
            const KIcon = KindIcon(m.kind);
            const picked = selection.has(m.id);
            const glyph = !hasAlt(m) ? (
              <StatusGlyph kind="attention" label={p.noAlt} size={16} />
            ) : (uses(m) ?? 0) > 0 ? (
              <StatusGlyph kind="used" size={16} />
            ) : null;
            return (
              <>
                <button
                  type="button"
                  className={styles.tile}
                  data-media-tile=""
                  data-unused={isUnused(m) ? "true" : undefined}
                  role={selection.on ? "checkbox" : undefined}
                  aria-checked={selection.on ? picked : undefined}
                  aria-label={nameOf(m)}
                  onClick={() => (selection.on ? selection.toggle(m.id) : onOpen(m.id))}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {m.preview ? (
                    <img src={m.preview} alt="" className={styles.thumb} data-thumb={m.kind} loading="lazy" decoding="async" width={200} height={200} />
                  ) : (
                    <span className={styles.thumb} aria-hidden="true" />
                  )}
                  {glyph && <span className={`${styles.corner} ${styles.status}`}>{glyph}</span>}
                  {KIcon && (
                    <span className={`${styles.corner} ${styles.kind}`} data-media-kind={m.kind} aria-hidden="true">
                      <KIcon size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />
                    </span>
                  )}
                  {selection.on && picked && (
                    <span className={`${styles.corner} ${styles.check}`} aria-hidden="true">
                      <Check size={16} strokeWidth={2.5} aria-hidden="true" focusable="false" />
                    </span>
                  )}
                </button>
              </>
            );
          }}
        </ListPresence>
      )}

      <SelectionBar selection={selection} actions={actions} />

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        defs={defs}
        value={filters}
        onApply={setFilters}
        resultCount={(draft) => matches(tidy(defs, draft)).length}
      />

      <UndoToast undoable={undoable} />
    </div>
  );
}
