import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  hrefCleared,
  hrefToggled,
  type FacetOption,
  type Selection,
} from "@/components/gallery/facets";
import styles from "@/components/gallery/Filter.module.css";
import { useFilterWords } from "@/i18n/pages";

/*
 * The filter control (#193), one for both galleries: a card holding a
 * popover multi-select per facet, the active choices as removable tokens,
 * and a way to clear them all.
 *
 * It replaced #175's rows of chips, which grew a line per facet and a chip
 * per value and, at forty projects, would have been a page of chips above
 * the page of projects. A popover costs one row per facet however many
 * values there are.
 *
 * WHY A LISTBOX, AND HOW IT BEHAVES (WAI-ARIA APG)
 * ------------------------------------------------
 * The trigger is a button (`aria-haspopup="listbox"`, `aria-expanded`); the
 * popover is a multi-selectable listbox whose options carry `aria-selected`.
 * A menu of checkboxes was the other candidate; a listbox is the pattern for
 * "choose any of these values", and it is what a screen reader announces as
 * "2 of 5 selected".
 *
 *   trigger   Enter, Space or Down opens on the first chosen value (or the
 *             first); Up opens on the last.
 *   options   Up and Down move, Home and End jump, a letter jumps to the next
 *             value that starts with it; Space or Enter toggles and the list
 *             stays open, because it is a multi-select; Escape closes it and
 *             puts focus back on the trigger; Tab closes it and moves on.
 *   pointer   a press outside closes it.
 *
 * Focus moves with a roving `tabindex` onto the option itself rather than
 * `aria-activedescendant`, so `:focus-visible` draws the ring and nothing
 * has to scroll an active row into view by hand.
 *
 * Every choice is a URL (`gallery/facets.ts`): toggling navigates with
 * `preventScrollReset` (the reader stays where they are) and a view
 * transition (the wall glides to its new arrangement; the stylesheet cuts it
 * under the off-switches). The tokens and "Clear all" are plain links, so they
 * can be opened in a new tab like any other filtered view.
 *
 * RTL: everything is laid out in logical properties, and the popover opens
 * from the trigger's inline start, so it hangs from the right edge in Hebrew.
 * Up and Down are the only arrow keys the list answers to, which have no
 * direction to mirror.
 */

export type FacetSpec = {
  key: string;
  label: string;
  options: FacetOption[];
  /** The words for a value, where the URL holds an id (a collection slug). */
  labelOf?: (value: string) => string;
  /** Library and language names, which a translator should leave alone. */
  noTranslate?: boolean;
};

function useToggle(path: string) {
  const navigate = useNavigate();
  const location = useLocation();
  return (facet: string, value: string) =>
    navigate(hrefToggled(path, location.search, facet, value), { preventScrollReset: true, viewTransition: true });
}

/* ─────────────────────────────────────────────────────────────────────── */

function MultiSelect({
  facet,
  selected,
  onToggle,
}: {
  facet: FacetSpec;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const name = facet.labelOf ?? ((v: string) => v);
  const { options } = facet;
  const w = useFilterWords();
  const at = Math.max(0, Math.min(active, options.length - 1));

  /* Focus follows the active option while the list is open. */
  useLayoutEffect(() => {
    if (!open) return;
    list.current?.querySelectorAll<HTMLElement>("[role='option']")[at]?.focus();
  }, [open, at]);

  /* A press anywhere else closes it. Listened only while open. */
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const show = (index: number) => {
    setActive(index);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const firstChosen = Math.max(
    0,
    options.findIndex((o) => selected.includes(o.value))
  );

  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      show(firstChosen);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      show(options.length - 1);
    }
  };

  const onOptionKey = (e: KeyboardEvent, i: number) => {
    const last = options.length - 1;
    const go = (n: number) => {
      e.preventDefault();
      setActive(n);
    };
    if (e.key === "ArrowDown") go(Math.min(last, i + 1));
    else if (e.key === "ArrowUp") go(Math.max(0, i - 1));
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(last);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle(options[i].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase();
      const order = [...options.slice(i + 1), ...options.slice(0, i + 1)];
      const hit = order.find((o) => name(o.value).toLowerCase().startsWith(k));
      if (hit) go(options.indexOf(hit));
    }
  };

  const summary =
    selected.length === 0 ? w.any : selected.length === 1 ? name(selected[0]) : w.chosen(selected.length);

  return (
    <div
      ref={root}
      className={styles.select}
      onBlur={(e) => {
        if (open && !root.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        id={`${id}-trigger`}
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        data-on={selected.length > 0 || undefined}
        onClick={() => (open ? setOpen(false) : show(firstChosen))}
        onKeyDown={onTriggerKey}
      >
        <span id={`${id}-label`} className={styles.facet}>
          {facet.label}
        </span>
        <span className={styles.summary} dir="auto" translate={facet.noTranslate && selected.length ? "no" : undefined}>
          {summary}
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.popover}>
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={`${id}-label`}
            className={styles.options}
            translate={facet.noTranslate ? "no" : undefined}
          >
            {options.map((o, i) => {
              const on = selected.includes(o.value);
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={on}
                  tabIndex={i === at ? 0 : -1}
                  className={styles.option}
                  data-empty={o.count === 0 || undefined}
                  onClick={() => {
                    setActive(i);
                    onToggle(o.value);
                  }}
                  onKeyDown={(e) => onOptionKey(e, i)}
                >
                  <span className={styles.box} aria-hidden="true" />
                  <span className={styles.value}>{name(o.value)}</span>
                  <span className={styles.count}>
                    {o.count}
                    <span className="sr-only">{o.count === 1 ? " match" : " matches"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

/**
 * The active choices, each a link that takes itself off, and "Clear all".
 * Used inside the card, and on a phone beside the button that opens the
 * sheet, so a filter that is on is never out of sight.
 */
export function FilterTokens({
  facets,
  selection,
  path,
}: {
  facets: FacetSpec[];
  selection: Selection;
  path: string;
}) {
  const location = useLocation();
  const w = useFilterWords();
  const box = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);

  /* A removed token takes its focus with it. Put it on the token that took
     its place, or the one before, or — when none are left — the control
     that opens the filters: the first trigger in the card, or the button
     that opens the sheet (`data-filter-scope` marks where to look). */
  useLayoutEffect(() => {
    const i = pending.current;
    if (i === null) return;
    pending.current = null;
    const tokens = box.current?.querySelectorAll<HTMLElement>("[data-token]") ?? [];
    const next = tokens[Math.min(i, tokens.length - 1)];
    const scope = box.current?.closest("[data-filter-scope]");
    (next ?? scope?.querySelector<HTMLElement>("[aria-haspopup]"))?.focus();
  });

  const tokens = facets.flatMap((f) =>
    (selection[f.key] ?? []).map((value) => ({ facet: f, value }))
  );
  return (
    <div ref={box} className={styles.tokens} hidden={tokens.length === 0}>
      <ul className={styles.tokenList} aria-label={w.active}>
        {tokens.map(({ facet, value }, i) => {
          const words = facet.labelOf?.(value) ?? value;
          return (
            <li key={`${facet.key}:${value}`}>
              <Link
                data-token=""
                to={hrefToggled(path, location.search, facet.key, value)}
                preventScrollReset
                viewTransition
                className={styles.token}
                onClick={() => {
                  pending.current = i;
                }}
              >
                <span className={styles.tokenFacet}>{facet.label}</span>
                <span translate={facet.noTranslate ? "no" : undefined}>{words}</span>
                <span className="sr-only">{w.remove}</span>
                <span className={styles.cross} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        to={hrefCleared(path, location.search, facets.map((f) => f.key))}
        preventScrollReset
        viewTransition
        className={styles.clear}
        onClick={() => {
          pending.current = 0;
        }}
      >
        {w.clearAll}
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

export default function FilterControl({
  title,
  facets,
  selection,
  path,
  shown,
  total,
  noun,
  search,
}: {
  /** The card's heading, e.g. "Filter projects". */
  title: string;
  facets: FacetSpec[];
  selection: Selection;
  path: string;
  shown: number;
  total: number;
  /** Plural, for the count: "projects", "notes". */
  noun: string;
  /** A search field, above the facets, when the page has enough items to need one. */
  search?: ReactNode;
}) {
  const toggle = useToggle(path);
  const w = useFilterWords();
  const headingId = useId();
  const offered = facets.filter((f) => f.options.length > 0);

  return (
    <section className={styles.card} aria-labelledby={headingId} data-filter-scope="">
      <div className={styles.cardHead}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {/* Always in the tree, so the count is announced when a filter
            changes it: a live region inserted already holding its text
            says nothing. */}
        <p className={styles.tally} aria-live="polite">
          {shown === total ? (
            <>
              <b>{total}</b> {noun}
            </>
          ) : (
            <>
              <b>{shown}</b> {w.of} {total} {noun}
            </>
          )}
        </p>
      </div>

      {/* The choices already made come first, so an open popover never
          covers them. Mounted with or without tokens, so taking off the last
          one can still hand focus on. */}
      <FilterTokens facets={facets} selection={selection} path={path} />

      {search}

      <div className={styles.selects}>
        {offered.map((f) => (
          <MultiSelect
            key={f.key}
            facet={f}
            selected={selection[f.key] ?? []}
            onToggle={(v) => toggle(f.key, v)}
          />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

/**
 * A search box whose words are the URL's `q`, replaced (not pushed) per
 * keystroke, so Back leaves the page rather than un-typing a letter.
 */
export function SearchField({
  label,
  path,
  placeholder,
}: {
  label: string;
  path: string;
  placeholder?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const id = useId();
  const value = new URLSearchParams(location.search).get("q") ?? "";

  return (
    <div className={styles.search} role="search">
      <label htmlFor={id} className={styles.searchLabel}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        name="q"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        dir="auto"
        className={styles.searchInput}
        onChange={(e) => {
          const params = new URLSearchParams(location.search);
          if (e.target.value) params.set("q", e.target.value);
          else params.delete("q");
          const q = params.toString();
          navigate(q ? `${path}?${q}` : path, { replace: true, preventScrollReset: true });
        }}
      />
    </div>
  );
}
