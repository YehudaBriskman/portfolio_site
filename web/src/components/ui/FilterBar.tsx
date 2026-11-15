import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { ICON } from "@/components/ui/icons";
import { FilterChips } from "@/components/ui/FilterChips";
import { filterCount, tidy, writeFilters, type FilterDef, type Filters } from "@/components/ui/filters";
import { useSavedFilters, type SavedFiltersState } from "@/components/ui/useSavedFilters";
import styles from "@/components/ui/FilterBar.module.css";

/*
 * The row above a table (A15): search first, then the few filters as one-tap
 * chips (FilterChips, the same toolbar the phone uses), then what is on and how
 * many rows that leaves, with one Clear all that clears the search too.
 *
 * The search is a real `type=search` field named for what it searches; it
 * clears with one tap on its X and with Escape. State lives in the address:
 * `useFilterBar` is `useSavedFilters` plus a `q` param, so the same set is
 * shareable, Back-friendly and remembered (with its "restored, Undo" note).
 * Words are the caller's. The phone keeps FilterChips + FilterSheet; this is
 * the desktop twin and wraps to two lines before it ever clips.
 */

export interface FilterBarWords {
  /** Name of the search field ("Search contacts"). */
  search: string;
  clearSearch: string;
  /** "12 results", drawn only while something is on. */
  results: (n: number) => string;
  clearAll: string;
  /** Names the saved-view chips ("Views"). Needed when `views` is given. */
  views?: string;
  /** Names the save-view button ("Save view"). Needed with `onSaveView`. */
  saveView?: string;
}

/** One saved view, drawn as a chip with its count (principle 10). */
export interface SavedView {
  id: string;
  label: string;
  count?: number;
}

export interface FilterBarProps {
  defs: FilterDef[];
  value: Filters;
  onChange: (next: Filters) => void;
  common?: string[];
  onOpenSheet?: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount?: number;
  words: FilterBarWords;
  /** The hook for saved views: chips before the search, one pressed. The caller owns what a view holds. */
  views?: SavedView[];
  activeView?: string;
  onViewChange?: (id: string) => void;
  /** Shows a bookmark button that saves what is on now as a view. */
  onSaveView?: () => void;
  className?: string;
}

export function FilterBar({ defs, value, onChange, common, onOpenSheet, query, onQueryChange, resultCount, words, views, activeView, onViewChange, onSaveView, className }: FilterBarProps) {
  const active = filterCount(defs, value) > 0 || query.trim() !== "";

  const clearAll = () => {
    const keep: Filters = {};
    for (const d of defs) if (d.kind === "sort" && value[d.id] !== undefined) keep[d.id] = value[d.id];
    onChange(tidy(defs, keep));
    onQueryChange("");
  };

  return (
    <div className={[styles.bar, className].filter(Boolean).join(" ")}>
      {views && views.length > 0 && (
        <div role="group" aria-label={words.views} className={styles.views}>
          {views.map((v) => (
            <button key={v.id} type="button" className={styles.view} aria-pressed={activeView === v.id} onClick={() => onViewChange?.(v.id)}>
              {v.label}
              {v.count !== undefined && <span className={styles.viewCount}>{v.count}</span>}
            </button>
          ))}
          {onSaveView && active && (
            <button type="button" className={styles.saveView} aria-label={words.saveView} title={words.saveView} onClick={onSaveView}>
              <Icon icon={ICON.saveView} size={16} />
            </button>
          )}
        </div>
      )}
      <div className={styles.search} data-filled={query !== "" || undefined}>
        <Icon icon={ICON.searchSettings} size={16} className={styles.glyph} />
        <input
          type="search"
          role="searchbox"
          className={styles.input}
          aria-label={words.search}
          placeholder={words.search}
          value={query}
          dir="auto"
          autoComplete="off"
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query !== "") {
              e.preventDefault();
              e.stopPropagation();
              onQueryChange("");
            }
          }}
        />
        {query !== "" && (
          <button type="button" className={styles.clearSearch} aria-label={words.clearSearch} onClick={() => onQueryChange("")}>
            <Icon icon={ICON.close} size={16} />
          </button>
        )}
      </div>
      <div className={styles.chips}>
        <FilterChips defs={defs} value={value} onChange={onChange} common={common} onOpenSheet={onOpenSheet} hideClear />
      </div>
      {active && (
        <div className={styles.state}>
          {resultCount !== undefined && (
            <span role="status" className={styles.count}>
              {words.results(resultCount)}
            </span>
          )}
          <button type="button" className={styles.clearAll} onClick={clearAll}>
            {words.clearAll}
          </button>
        </div>
      )}
    </div>
  );
}

export interface FilterBarState {
  filters: Filters;
  setFilters: (next: Filters) => void;
  query: string;
  setQuery: (q: string) => void;
  clearAll: () => void;
  /** The "filters restored" note state from useSavedFilters. */
  saved: SavedFiltersState;
}

/**
 * The saved view of a list: its filters (remembered per screen, restored with an
 * Undo) and its search, all in the address, so a link reopens the same view.
 */
export function useFilterBar(screen: string, defs: FilterDef[]): FilterBarState {
  const [filters, setFilters, saved] = useSavedFilters(screen, defs);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";

  const setQuery = useCallback(
    (q: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q === "") next.delete("q");
          else next.set("q", q);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const clearAll = useCallback(() => {
    const keep: Filters = {};
    for (const d of defs) if (d.kind === "sort" && filters[d.id] !== undefined) keep[d.id] = filters[d.id];
    setFilters(keep); // also clears the remembered set
    /* One write that holds both changes: two functional updates in a row would each start from the same old address and the second would undo the first. */
    setParams((prev) => {
      const next = writeFilters(defs, prev, keep);
      next.delete("q");
      return next;
    }, { replace: true });
  }, [defs, filters, setFilters, setParams]);

  return { filters, setFilters, query, setQuery, clearAll, saved };
}
