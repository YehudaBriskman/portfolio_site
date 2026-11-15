import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon, type IconProps } from "@/components/ui/Icon";
import { ICON } from "@/components/ui/icons";
import { RecordRow, type RecordRowProps } from "@/components/ui/RecordRow";
import { SelectionBar, type SelectionAction } from "@/components/ui/SelectionBar";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Selection, SelectionId } from "@/components/ui/useSelection";
import { usePhone } from "@/hooks/usePhone";
import styles from "@/components/ui/DataTable.module.css";

/*
 * The one desktop table (A11 to A18), and its phone twin.
 *
 *  - Wide: a real table (`role=grid`) whose header sticks, with a quiet shadow
 *    once it is stuck. First column is the human identifier (`primary`: wraps to
 *    two lines, never cut mid-word); numeric columns are right-aligned and
 *    tabular with the unit in the header; the rest end in an ellipsis with the
 *    full text on `title`. `hideBelow` drops a column as the table narrows
 *    (container width, not the viewport).
 *  - Narrow (under 600px, `usePhone`): never a table. One `RecordRow` per record
 *    from `phoneRow`, and the phone select bar for bulk actions.
 *  - Sorting: click a sortable header (ascending, descending, off). `aria-sort`
 *    sits on that column only. Pass `onSortChange` to sort on the server (the
 *    order is then the caller's); without it, a column's `sort` comparator sorts
 *    in place.
 *  - Keyboard (APG data grid, rows as the stops): one tab stop; Up/Down, Home/End,
 *    PageUp/PageDown move between rows; Enter opens (or toggles in select mode);
 *    Space toggles in select mode; the inline-end arrow steps into the row's
 *    controls and the inline-start arrow steps back (both mirror in RTL).
 *  - Select mode (`selection` from `useSelection`): checkboxes appear, a bar
 *    carries the count (live region), the first action as primary, the rest in
 *    More, Cancel last. Row actions are inert meanwhile (A12).
 *  - `groupBy` + `groupLabel` say a shared fact once as a group header instead of
 *    on every row (A6; rows whose `groupBy` is null sit first, under no header): a "Draft" header beats a Draft pill on each draft.
 *  - Four states: rows, loading (a Skeleton with these columns), empty (the
 *    caller's EmptyState), error (what failed, Retry, the rows kept).
 *
 * Words are the caller's. Paging (20 to 50 rows, "Load more by cursor") and
 * virtualisation above 50 DOM rows are the caller's job (A17).
 */

type LucideIcon = IconProps["icon"];
export type Align = "start" | "end" | "num";
export type HideBelow = "sm" | "md" | "lg";
export interface SortState {
  id: string;
  dir: "asc" | "desc";
}

export interface Column<T> {
  id: string;
  /** Visible header. Put the unit of a numeric column here, not in every cell. */
  header: string;
  cell: (row: T) => ReactNode;
  /** "num": counts, durations, money (right, tabular). "start": text and nominal numbers (ids, phones). */
  align?: Align;
  /** A comparator makes the header sortable. */
  sort?: (a: T, b: T) => number;
  /** Drop this column when the table is narrower than sm 36rem, md 48rem or lg 64rem. */
  hideBelow?: HideBelow;
  /** A CSS width ("8rem"); the identifier column takes the rest. */
  width?: string;
  /** The identifier: wraps to two lines instead of one clipped line. Exactly one per table. */
  primary?: boolean;
}

export interface DataTableWords {
  selectAll: string;
  selectRow: (label: string) => string;
  /** Name of the (visually hidden) row-actions column. */
  actions: string;
  loading: string;
  bulkLabel: string;
  /** "3 selected". */
  count: (n: number) => string;
  cancel: string;
  more: string;
}

export interface BulkAction<K extends SelectionId = string> {
  id: string;
  label: string;
  icon?: LucideIcon;
  onRun: (ids: K[]) => void | Promise<void>;
  /** Never the first action. On a phone it opens the confirm sheet. */
  tone?: "neutral" | "danger";
  /** Phone confirm wording: "Delete 3 posts". */
  confirm?: (count: number) => string;
}

export interface DataTableProps<T, K extends SelectionId = string> {
  /** Names the table: "Posts". */
  label: string;
  rows: readonly T[];
  columns: Column<T>[];
  rowKey: (row: T) => K;
  /** The record's own name, for "Select Launch notes". */
  rowLabel: (row: T) => string;
  words: DataTableWords;
  onOpen?: (row: T) => void;
  /** The row's actions, normally a <RowActions/>; made inert in select mode. */
  rowActions?: (row: T) => ReactNode;
  sort?: SortState | null;
  onSortChange?: (next: SortState | null) => void;
  density?: "compact" | "comfortable";
  selection?: Selection<K>;
  bulkActions?: BulkAction<K>[];
  groupBy?: (row: T) => string | null;
  groupLabel?: (key: string, rows: T[]) => ReactNode;
  loading?: boolean;
  /** Shown in place of the rows when there are none: an <EmptyState/>. */
  empty?: ReactNode;
  error?: { title: string; retry: string; onRetry: () => void } | null;
  /** The phone row for a record (title, at most two facts, a status glyph). */
  phoneRow?: (row: T) => Omit<RecordRowProps, "onOpen" | "selectable" | "selected" | "onLongPress" | "as">;
  /** How many skeleton rows to draw while loading. Default 6. */
  skeletonRows?: number;
  className?: string;
}

const cx = (...p: Array<string | false | undefined>) => p.filter(Boolean).join(" ");
const INTERACTIVE = 'a[href],button,input,select,textarea,[role="menuitem"],[role="checkbox"]';
const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select,textarea';

function nextSort(cur: SortState | null | undefined, id: string): SortState | null {
  if (!cur || cur.id !== id) return { id, dir: "asc" };
  return cur.dir === "asc" ? { id, dir: "desc" } : null;
}

export function DataTable<T, K extends SelectionId = string>(props: DataTableProps<T, K>) {
  const {
    label, rows, columns, rowKey, words, onOpen, sort, onSortChange, density, selection, bulkActions,
    groupBy, groupLabel, loading = false, empty, error, phoneRow, skeletonRows = 6, className,
  } = props;
  const phone = usePhone();
  const selecting = Boolean(selection?.on);

  /* Sorting: the caller's when it listens (server sort), else here. */
  const [localSort, setLocalSort] = useState<SortState | null>(null);
  const active = sort !== undefined ? sort : localSort;
  const sorted = useMemo(() => {
    if (onSortChange || !active) return rows;
    const col = columns.find((c) => c.id === active.id);
    if (!col?.sort) return rows;
    const cmp = col.sort;
    const sign = active.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => sign * cmp(a, b));
  }, [rows, columns, active, onSortChange]);
  const changeSort = (id: string) => {
    const next = nextSort(active, id);
    setLocalSort(next);
    onSortChange?.(next);
  };

  /* Groups, in first-seen order. */
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, T[]>();
    for (const r of sorted) {
      const k = groupBy(r) ?? "";
      const list = map.get(k);
      if (list) list.push(r);
      else map.set(k, [r]);
    }
    const all = [...map.entries()];
    return [...all.filter(([k]) => k === ""), ...all.filter(([k]) => k !== "")];
  }, [sorted, groupBy]);

  const toggle = (row: T) => selection?.toggle(rowKey(row));
  const open = (row: T) => (selecting ? toggle(row) : onOpen?.(row));

  const errorBlock = error ? (
    <div role="alert" className={styles.error}>
      <span className={styles.errorText}>{error.title}</span>
      <button type="button" className={styles.errorBtn} onClick={error.onRetry}>
        {error.retry}
      </button>
    </div>
  ) : null;

  const showSkeleton = loading && rows.length === 0;
  const showEmpty = !loading && rows.length === 0 && !error;

  /* ---------- phone: a list of rows, never a table ---------- */
  if (phone && phoneRow) {
    const item = (row: T) => (
      <RecordRow
        key={String(rowKey(row))}
        as="li"
        {...phoneRow(row)}
        selectable={selecting}
        selected={selection?.has(rowKey(row))}
        onOpen={() => open(row)}
        onLongPress={selection ? () => selection.enter(rowKey(row)) : undefined}
      />
    );
    const phoneActions: SelectionAction<K>[] = (bulkActions ?? []).map((a) => ({
      id: a.id,
      icon: a.icon ?? ICON.select,
      label: a.label,
      run: a.onRun,
      destructive: a.tone === "danger",
      confirm: a.confirm,
    }));
    return (
      <div className={cx(styles.phone, className)} aria-busy={loading || undefined}>
        {errorBlock}
        {showSkeleton ? (
          <Skeleton variant="cards" rows={skeletonRows} label={words.loading} />
        ) : showEmpty ? (
          empty
        ) : (
          <ul aria-label={label} className={styles.list}>
            {groups
              ? groups.map(([key, list]) => (
                  <Fragment key={key}>
                    {key !== "" && (
                      <li role="presentation" className={styles.groupPhone}>
                        <span role="heading" aria-level={3}>
                          {groupLabel?.(key, list) ?? key}
                        </span>
                      </li>
                    )}
                    {list.map(item)}
                  </Fragment>
                ))
              : sorted.map(item)}
          </ul>
        )}
        {selection && phoneActions.length > 0 && <SelectionBar selection={selection} actions={phoneActions} />}
      </div>
    );
  }

  return (
    <Grid
      {...props}
      sorted={sorted}
      groups={groups}
      active={active}
      changeSort={changeSort}
      selecting={selecting}
      open={open}
      toggle={toggle}
      errorBlock={errorBlock}
      showSkeleton={showSkeleton}
      showEmpty={showEmpty}
      density={density}
      skeletonRows={skeletonRows}
    />
  );
}

interface GridProps<T, K extends SelectionId> extends DataTableProps<T, K> {
  sorted: readonly T[];
  groups: [string, T[]][] | null;
  active: SortState | null | undefined;
  changeSort: (id: string) => void;
  selecting: boolean;
  open: (row: T) => void;
  toggle: (row: T) => void;
  errorBlock: ReactNode;
  showSkeleton: boolean;
  showEmpty: boolean;
}

function Grid<T, K extends SelectionId>({
  label, columns, rowKey, rowLabel, words, rowActions, density, selection, bulkActions, groupLabel, loading, empty, className,
  sorted, groups, active, changeSort, selecting, open, toggle, errorBlock, showSkeleton, showEmpty, skeletonRows,
}: GridProps<T, K>) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const allRef = useRef<HTMLInputElement>(null);
  const [stuck, setStuck] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  /* The header is stuck once the marker above the table has scrolled past the top. A passive scroll read, not an observer. */
  useEffect(() => {
    const check = () => {
      const el = sentinelRef.current;
      if (!el) return;
      const top = parseFloat(getComputedStyle(el).getPropertyValue("--a-sticky-top")) || 0;
      setStuck(el.getBoundingClientRect().top < top);
    };
    check();
    window.addEventListener("scroll", check, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", check, { capture: true });
  }, []);

  const keys = sorted.map((r) => String(rowKey(r)));
  const stop = current !== null && keys.includes(current) ? current : keys[0];

  /* One tab stop per table: the controls inside rows are reached with the arrows. */
  useLayoutEffect(() => {
    bodyRef.current?.querySelectorAll<HTMLElement>("tr[data-row]").forEach((tr) => {
      tr.querySelectorAll<HTMLElement>(`${FOCUSABLE},[tabindex]`).forEach((el) => {
        if (el !== tr) el.tabIndex = -1;
      });
    });
  });

  useEffect(() => {
    if (allRef.current && selection) allRef.current.indeterminate = selection.count > 0 && !selection.allSelected;
  });

  const rowEls = () => Array.from(bodyRef.current?.querySelectorAll<HTMLElement>("tr[data-row]") ?? []);
  const goto = (el: HTMLElement | undefined) => {
    if (!el) return;
    setCurrent(el.dataset.key ?? null);
    el.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    const target = e.target as HTMLElement;
    const row = target.closest<HTMLElement>("tr[data-row]");
    if (!row || e.altKey || e.ctrlKey || e.metaKey) return;
    const onRow = target === row;
    const all = rowEls();
    const at = all.indexOf(row);
    const rtl = row.closest("[dir]")?.getAttribute("dir") === "rtl";
    const intoRow = rtl ? "ArrowLeft" : "ArrowRight";
    const outOfRow = rtl ? "ArrowRight" : "ArrowLeft";
    const controls = () => Array.from(row.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest("[inert]"));

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      goto(all[Math.min(all.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))]);
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      goto(all[Math.min(all.length - 1, Math.max(0, at + (e.key === "PageDown" ? 10 : -10)))]);
    } else if ((e.key === "Home" || e.key === "End") && onRow) {
      e.preventDefault();
      goto(e.key === "Home" ? all[0] : all[all.length - 1]);
    } else if (e.key === intoRow) {
      const list = controls();
      const next = onRow ? list[0] : list[list.indexOf(target) + 1];
      if (next) {
        e.preventDefault();
        next.focus();
      }
    } else if (e.key === outOfRow && !onRow) {
      const list = controls();
      const i = list.indexOf(target);
      if (i >= 0) {
        e.preventDefault();
        if (i === 0) row.focus();
        else list[i - 1]?.focus();
      }
    } else if (onRow && e.key === "Enter") {
      e.preventDefault();
      row.click();
    } else if (onRow && e.key === " " && selecting) {
      e.preventDefault();
      row.click();
    }
  };

  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, row: T) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    open(row);
  };

  const span = columns.length + (selection ? 1 : 0) + (rowActions ? 1 : 0);
  const Row = (row: T) => {
    const key = String(rowKey(row));
    const chosen = selection?.has(rowKey(row)) ?? false;
    return (
      <tr
        key={key}
        role="row"
        data-row=""
        data-key={key}
        data-selected={selecting ? String(chosen) : undefined}
        aria-selected={selecting ? chosen : undefined}
        tabIndex={key === stop ? 0 : -1}
        className={styles.row}
        onClick={(e) => onRowClick(e, row)}
        onFocus={() => setCurrent(key)}
      >
        {selection && (
          <td role="gridcell" className={cx(styles.check, !selecting && styles.checkOff)}>
            {selecting && (
              <input type="checkbox" className={styles.box} aria-label={words.selectRow(rowLabel(row))} checked={chosen} onChange={() => toggle(row)} />
            )}
          </td>
        )}
        {columns.map((c) => {
          const v = c.cell(row);
          return (
            <td key={c.id} role="gridcell" data-align={c.align ?? "start"} data-hide={c.hideBelow}>
              {c.primary ? (
                <span className={styles.title} dir="auto">
                  {v}
                </span>
              ) : c.align === "num" ? (
                v
              ) : (
                <span className={styles.clip} title={typeof v === "string" || typeof v === "number" ? String(v) : undefined}>
                  {v}
                </span>
              )}
            </td>
          );
        })}
        {rowActions && (
          <td role="gridcell" className={styles.actions}>
            <span inert={selecting || undefined}>{rowActions(row)}</span>
          </td>
        )}
      </tr>
    );
  };

  const bar = selection?.on && bulkActions && bulkActions.length > 0 ? <BulkBar selection={selection} actions={bulkActions} words={words} /> : null;

  return (
    <div className={cx(styles.wrap, className)} data-density={density} data-stuck={stuck || undefined}>
      {bar}
      {errorBlock}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      <table role="grid" aria-label={label} aria-busy={loading || undefined} className={cx("a-table", styles.table)}>
        <thead>
          <tr role="row">
            {selection && (
              <th role="columnheader" scope="col" className={cx(styles.check, !selecting && styles.checkOff)}>
                {selecting && (
                  <input ref={allRef} type="checkbox" className={styles.box} aria-label={words.selectAll} checked={selection.allSelected} onChange={() => (selection.allSelected ? selection.none() : selection.all())} />
                )}
              </th>
            )}
            {columns.map((c) => {
              const dir = active?.id === c.id ? active.dir : null;
              return (
                <th
                  key={c.id}
                  role="columnheader"
                  scope="col"
                  data-align={c.align ?? "start"}
                  data-hide={c.hideBelow}
                  style={c.width ? { inlineSize: c.width } : undefined}
                  aria-sort={dir ? (dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {c.sort ? (
                    <button type="button" className={styles.sortBtn} onClick={() => changeSort(c.id)}>
                      {c.header}
                      <span className={styles.arrow} data-dir={dir ?? "none"} aria-hidden="true" />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
            {rowActions && (
              <th role="columnheader" scope="col" className={styles.actions}>
                <span className={styles.sr}>{words.actions}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody ref={bodyRef} onKeyDown={onKeyDown}>
          {showSkeleton ? (
            <tr role="row">
              <td colSpan={span} role="gridcell" className={styles.fill}>
                <Skeleton
                  columns={[
                    ...(selection ? [{ id: "_sel", width: "1.5rem" }] : []),
                    ...columns.map((c) => ({ id: c.id, width: c.width ?? (c.primary ? "minmax(0, 2fr)" : "minmax(0, 1fr)"), align: c.align })),
                    ...(rowActions ? [{ id: "_act", width: "5rem" }] : []),
                  ]}
                  rows={skeletonRows}
                  height={density === "compact" ? "2.25rem" : "3rem"}
                  label={words.loading}
                />
              </td>
            </tr>
          ) : showEmpty ? (
            <tr role="row">
              <td colSpan={span} role="gridcell" className={styles.fill}>
                {empty}
              </td>
            </tr>
          ) : groups ? (
            groups.map(([key, list]) => (
              <Fragment key={key}>
                {key !== "" && (
                  <tr role="row" className={styles.group}>
                    <th role="rowheader" scope="rowgroup" colSpan={span}>
                      {groupLabel?.(key, list) ?? key}
                    </th>
                  </tr>
                )}
                {list.map(Row)}
              </Fragment>
            ))
          ) : (
            sorted.map(Row)
          )}
        </tbody>
      </table>
    </div>
  );
}

function BulkBar<K extends SelectionId>({ selection, actions, words }: { selection: Selection<K>; actions: BulkAction<K>[]; words: DataTableWords }) {
  const [primary, ...rest] = actions;
  const menu = [...rest.filter((a) => a.tone !== "danger"), ...rest.filter((a) => a.tone === "danger")];
  const run = async (a: BulkAction<K>) => {
    await a.onRun(selection.ids);
    selection.exit();
  };
  const none = selection.count === 0;
  return (
    <div role="toolbar" aria-label={words.bulkLabel} className={styles.bulk}>
      <span role="status" aria-live="polite" className={styles.bulkCount}>
        {words.count(selection.count)}
      </span>
      <button type="button" className={cx(styles.bulkBtn, styles.bulkPrimary)} disabled={none} onClick={() => void run(primary)}>
        {primary.icon && <Icon icon={primary.icon} size={16} />}
        {primary.label}
      </button>
      {menu.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={styles.bulkBtn} disabled={none}>
              <Icon icon={ICON.more} size={16} />
              {words.more}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menu.map((a) => (
              <DropdownMenuItem key={a.id} onSelect={() => void run(a)}>
                {a.icon && <Icon icon={a.icon} size={16} className={styles.menuIcon} />}
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <button type="button" className={styles.bulkBtn} onClick={selection.exit}>
        {words.cancel}
      </button>
    </div>
  );
}
