import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ICON } from "@/components/ui/icons";
import { Icon } from "@/components/ui/Icon";
import { pushRecent, rankItems, readRecent, type PaletteItem } from "@/components/ui/paletteItems";
import styles from "@/components/ui/CommandPalette.module.css";

export type { PaletteItem } from "@/components/ui/paletteItems";

/*
 * Ctrl or Cmd + K (A32): go to any admin page or start anything, by keyboard.
 *
 * A native modal <dialog> (top layer, inert page, focus kept inside) holding
 * the WAI-ARIA combobox: the input keeps focus, the options are never tabbed
 * to, `aria-activedescendant` names the active one. Up and Down move (and wrap),
 * Home and End jump, Enter runs, Escape closes. Enter during an IME composition
 * only confirms the composition. Nothing typed: Recent (the last five run, each
 * shown once and not repeated below), Create, Go to. Typing: one flat list, a
 * label that starts with the query first, every word of the query must match
 * the label or where it lives. The dialog enters on the admin's one dialog
 * transition (index.css) and leaves at once: a search that opens many times a
 * day does not wait to close, and it owns no motion of its own (M4, M5).
 * Focus returns to whatever had it. The words and the items are the caller's.
 */

export interface PaletteWords {
  /** The dialog's and the field's accessible name. */
  title: string;
  placeholder: string;
  recent: string;
  create: string;
  go: string;
  empty: string;
  results: (n: number) => string;
  close: string;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PaletteItem[];
  words: PaletteWords;
}

type Section = { key: string; heading: string; items: PaletteItem[] };

function sectionsFor(items: PaletteItem[], query: string, recent: string[], words: PaletteWords): Section[] {
  if (query.trim()) return [{ key: "hits", heading: "", items: rankItems(items, query) }];
  const byId = new Map(items.map((i) => [i.id, i]));
  const seen = recent.map((id) => byId.get(id)).filter((i): i is PaletteItem => !!i);
  const taken = new Set(seen.map((i) => i.id));
  const rest = (g: PaletteItem["group"]) => items.filter((i) => i.group === g && !taken.has(i.id));
  return [
    { key: "recent", heading: words.recent, items: seen },
    { key: "create", heading: words.create, items: rest("create") },
    { key: "go", heading: words.go, items: rest("go") },
  ].filter((s) => s.items.length);
}

export function CommandPalette({ open, onOpenChange, items, words }: CommandPaletteProps) {
  const id = useId();
  const listId = `${id}-list`;
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
      setRecent(readRecent());
    }
  }

  const sections = sectionsFor(items, query, recent, words);
  const flat = sections.flatMap((s) => s.items);
  const at = flat.length ? Math.min(active, flat.length - 1) : -1;
  const optionId = (i: number) => `${id}-o${i}`;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    input.current?.focus();
    return () => {
      const back = opener.current;
      if (back?.isConnected && !back.closest("[inert]")) back.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && at >= 0) document.getElementById(optionId(at))?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, at]);

  if (!open) return null;

  const choose = (item: PaletteItem) => {
    pushRecent(item.id);
    onOpenChange(false);
    item.run();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = flat.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (n) setActive((at + 1) % n);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (n) setActive((at - 1 + n) % n);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(Math.max(0, n - 1));
        break;
      case "Enter":
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        if (at >= 0) choose(flat[at]);
        break;
    }
  };

  const row = (item: PaletteItem): ReactNode => {
    const i = flat.indexOf(item);
    return (
      <div
        key={item.id}
        id={optionId(i)}
        role="option"
        aria-selected={i === at}
        data-active={i === at ? "" : undefined}
        className={styles.option}
        onPointerMove={() => i !== at && setActive(i)}
        onClick={() => choose(item)}
      >
        <span className={styles.glyph} aria-hidden="true">
          {item.icon && <item.icon aria-hidden="true" />}
        </span>
        <span className={styles.label} data-label="" dir="auto">
          {item.label}
        </span>
        {item.hint && (
          <span className={styles.hint} dir="auto">
            {item.hint}
          </span>
        )}
      </div>
    );
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label={words.title}
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div className={styles.box}>
        <div className={styles.search}>
          <Icon icon={ICON.searchSettings} className={styles.searchGlyph} />
          <input
            ref={input}
            className={styles.input}
            type="text"
            role="combobox"
            aria-label={words.title}
            aria-expanded={flat.length > 0}
            aria-controls={flat.length ? listId : undefined}
            aria-activedescendant={at >= 0 ? optionId(at) : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={words.placeholder}
            value={query}
            dir="auto"
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <button type="button" className={styles.close} aria-label={words.close} onClick={() => onOpenChange(false)}>
            <Icon icon={ICON.close} />
          </button>
        </div>
        <p role="status" className={flat.length ? styles.sr : styles.empty}>
          {flat.length ? words.results(flat.length) : words.empty}
        </p>
        {flat.length > 0 && (
          <div id={listId} role="listbox" aria-label={words.title} className={styles.list}>
            {sections.map((s) =>
              s.heading ? (
                <div key={s.key} role="group" aria-labelledby={`${id}-h-${s.key}`} className={styles.group}>
                  <div id={`${id}-h-${s.key}`} data-heading="" className={styles.heading}>
                    {s.heading}
                  </div>
                  {s.items.map(row)}
                </div>
              ) : (
                s.items.map(row)
              ),
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
