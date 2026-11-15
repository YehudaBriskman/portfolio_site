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
  className?: string;
}

export function FilterBar({ defs, value, onChange, common, onOpenSheet, query, onQueryChange, resultCount, words, className }: FilterBarProps) {
  const active = filterCount(defs, value) > 0 || query.trim() !== "";

  const clearAll = () => {
    const keep: Filters = {};
    for (const d of defs) if (d.kind === "sort" && value[d.id] !== undefined) keep[d.id] = value[d.id];
    onChange(tidy(defs, keep));
    onQueryChange("");
  };

  return (
    <div className={[styles.bar, className].filter(Boolean).join(" ")}>
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
