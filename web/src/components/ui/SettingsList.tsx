import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { SettingsSearch } from "@/components/ui/SettingsSearch";
import { groupSurface, matchItems, type SettingsItem } from "@/components/ui/settingsKit";
import { EXIT_KEEP_MS, usePhoneMotion } from "@/hooks/usePhoneMotion";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/SettingsList.module.css";

/*
 * Settings as an inset grouped list: one row per group (icon, name, ONE live
 * summary line, chevron) instead of every control and its help on the page.
 * A group opens as a half BottomSheet when it is small (4 switches or fewer,
 * no text field) and as a full sub-page otherwise; from 840px the list and the
 * open group sit side by side. Which group is open is the caller's state
 * (`openId`, `onOpenChange`), so it can live in the URL and Back can close it.
 * Summaries are plain functions of the document, so they follow the switches.
 *
 * A page is a layer over the list, not a replacement for it: the list stays
 * mounted (inert and covered), the page pushes in from the inline-end edge and
 * pops back, mirrored in RTL (SettingsList.module.css, phones only). `data-open`
 * is the state and flips on the tap; the last page's content is kept for the
 * length of the exit and dropped by a timer that never decides open or closed.
 * The sheet group stays mounted the same way so the sheet can leave.
 */

export type SettingsGroupDef<T> = {
  id: string;
  icon: LucideIcon;
  title: string;
  /** How many controls the group holds; with `hasText` this picks sheet or page. */
  controls: number;
  hasText?: boolean;
  /** What search looks through: each setting's label and help. */
  items?: SettingsItem[];
  /** ONE line, live: "Email on, 2 alerts". */
  summary: (doc: T) => string;
  /** Shown on the row only when something is wrong. */
  warning?: (doc: T) => string | null;
  /** The group's content: SettingsRow and fields. */
  render: (doc: T) => ReactNode;
};

export interface SettingsListProps<T> {
  groups: SettingsGroupDef<T>[];
  value: T;
  openId: string | null;
  /** `surface` says how the group opens, so an owner that keeps it in the address can push a page and only rewrite for a sheet. */
  onOpenChange: (id: string | null, surface?: "page" | "sheet") => void;
  className?: string;
}

function useWide(): boolean {
  const q = "(min-width: 840px)";
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(q);
      mq.addEventListener?.("change", cb);
      return () => mq.removeEventListener?.("change", cb);
    },
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches,
    () => false,
  );
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

export function SettingsList<T>({ groups, value, openId, onOpenChange, className }: SettingsListProps<T>) {
  const w = useMobileWords().settings;
  const wide = useWide();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<{ group: string; item: string } | null>(null);

  const open = groups.find((g) => g.id === openId) ?? null;
  const motion = usePhoneMotion();
  const pageGroup = !wide && open && groupSurface(open) === "page" ? open : null;
  const sheetGroup = !wide && open && groupSurface(open) !== "page" ? open : null;
  /* The last page, kept to leave with. */
  const [lastPage, setLastPage] = useState<SettingsGroupDef<T> | null>(null);
  if (pageGroup && lastPage !== pageGroup) setLastPage(pageGroup);
  const [leavingPage, setLeavingPage] = useState(false);
  const [hadPage, setHadPage] = useState(false);
  if (Boolean(pageGroup) !== hadPage) {
    setHadPage(Boolean(pageGroup));
    setLeavingPage(!pageGroup && motion);
  }
  useEffect(() => {
    if (!leavingPage) return;
    const t = setTimeout(() => setLeavingPage(false), EXIT_KEEP_MS);
    return () => clearTimeout(t);
  }, [leavingPage]);
  const [sheetUsed, setSheetUsed] = useState(false);
  if (sheetGroup && !sheetUsed) setSheetUsed(true);
  const backRef = useRef<HTMLButtonElement>(null);
  const pageId = pageGroup?.id;
  /* The tapped row goes inert under the page; focus follows to the page. */
  useEffect(() => {
    if (pageId) backRef.current?.focus({ preventScroll: true });
  }, [pageId]);
  /* Side by side, an open group is a pane: nothing to step back out of. */
  const surfaceOf = (g: SettingsGroupDef<T>) => (wide ? "sheet" : groupSurface(g));
  const pageOpen = !wide && open !== null && groupSurface(open) === "page";

  /* A page has no scrim to tap, so Escape is its way out; a dialog or popover above it gets Escape first. */
  useEffect(() => {
    if (!pageOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open], [popover]:popover-open")) return;
      onOpenChange(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pageOpen, onOpenChange]);
  const searching = query.trim() !== "";

  const hits = searching
    ? groups.flatMap((g) => matchItems(g.items ?? [], query).map((item) => ({ group: g, item })))
    : [];

  /* Jump from a search result: once its group is open, land on that row. */
  useEffect(() => {
    if (!target || openId !== target.group) return;
    const row = root.current?.querySelector<HTMLElement>(`[data-setting-id="${CSS.escape(target.item)}"]`);
    const control = row?.querySelector<HTMLElement>("input, textarea, select") ?? row?.querySelector<HTMLElement>("button");
    if (control) {
      /* A setting inside a closed section would be skipped by focus(): open the section first. */
      for (let d = row?.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
      row?.scrollIntoView?.({ block: "center" });
      control.focus();
      setTarget(null);
    }
  }, [target, openId]);

  const card = (g: SettingsGroupDef<T>) => (
    <div className={styles.card} role="group" aria-label={g.title}>
      {g.render(value)}
    </div>
  );

  const list = (
    <div className={styles.listPane} data-covered={pageGroup ? "" : undefined} inert={pageGroup ? true : undefined}>
      <SettingsSearch value={query} onChange={setQuery} count={hits.length} />
      {searching ? (
        <ul className={cx(styles.card, styles.hits)} role="list">
          {hits.map(({ group, item }) => (
            <li key={`${group.id}/${item.id}`} className={styles.hitItem}>
              <button
                type="button"
                className={styles.hit}
                data-search-hit=""
                onClick={() => {
                  setTarget({ group: group.id, item: item.id });
                  setQuery("");
                  onOpenChange(group.id, surfaceOf(group));
                }}
              >
                <span className={styles.hitLabel}>{item.label}</span>
                <span className={styles.hitPath}>
                  <bdi>{group.title}</bdi>
                  <ChevronRight className={styles.sep} size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
                  <bdi>{item.label}</bdi>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={cx(styles.card, styles.groups)} role="list">
          {groups.map((g) => (
            <SettingsRow
              key={g.id}
              as="li"
              kind="link"
              id={g.id}
              icon={g.icon}
              label={g.title}
              summary={g.summary(value)}
              warning={g.warning?.(value) ?? null}
              current={wide && g.id === openId}
              onOpen={() => onOpenChange(g.id, surfaceOf(g))}
            />
          ))}
        </ul>
      )}
    </div>
  );

  if (wide) {
    return (
      <div ref={root} className={cx(styles.root, className)} data-panes="">
        {list}
        <section className={styles.detail} data-surface="pane" aria-label={open?.title}>
          {open && (
            <>
              <h2 className={styles.title}>{open.title}</h2>
              {card(open)}
            </>
          )}
        </section>
      </div>
    );
  }

  const shown = pageGroup ?? (leavingPage ? lastPage : null);
  return (
    <div ref={root} className={cx(styles.root, className)}>
      {list}
      {shown && (
        <section
          className={styles.page}
          data-surface="page"
          data-open={pageGroup ? "true" : undefined}
          inert={pageGroup ? undefined : true}
          aria-hidden={pageGroup ? undefined : true}
        >
          <header className={styles.pageHead}>
            <button ref={backRef} type="button" className={styles.back} onClick={() => onOpenChange(null)}>
              <ChevronLeft className={styles.backIcon} size={20} strokeWidth={2.25} aria-hidden="true" focusable="false" />
              <span>{w.back}</span>
            </button>
            <h2 className={styles.title}>{shown.title}</h2>
          </header>
          {card(shown)}
        </section>
      )}
      {(sheetGroup || sheetUsed) && (
        <BottomSheet open={Boolean(sheetGroup)} onClose={() => onOpenChange(null)} title={sheetGroup?.title ?? ""} snap="half" snaps={["half", "full"]}>
          <div data-surface="sheet" className={styles.sheetBody}>
            {sheetGroup && card(sheetGroup)}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
