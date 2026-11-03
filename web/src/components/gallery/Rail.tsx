import { useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "@/components/gallery/Rail.module.css";
import { useFilterWords } from "@/i18n/pages";

/*
 * The side rail (#193), shared by /projects and /blog: a column at the
 * inline start of the gallery — left in English, right in Hebrew, because it
 * is placed by the grid's column order and nothing physical — that holds the
 * filter control and, for the notes, an index of what is on the wall.
 *
 * WIDE: a sticky column. The filter card never scrolls inside the rail, so
 * its popovers can hang out of it; the index under it scrolls on its own
 * when it is taller than what is left of the window.
 *
 * NARROW (under 64rem, where a 16rem column would leave the wall two thin
 * columns): the rail is a button above the wall that opens it as a sheet.
 * The sheet is a native modal `<dialog>`, which is what gives it a focus
 * trap, Escape, an inert page behind it and a top layer, without a line of
 * script for any of them; on close, focus goes back to the button. The
 * active filters stay beside the button as tokens (`bar`), so a filter that
 * is on is never hidden behind it.
 *
 * Which of the two is drawn is one `matchMedia` read through
 * `useSyncExternalStore`, rather than both drawn and one hidden by CSS: the
 * rail's ids and live region exist once, never twice.
 */

const WIDE = "(min-width: 64rem)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const readWide = () => (typeof window.matchMedia === "function" ? window.matchMedia(WIDE).matches : true);
const readOnServer = () => true;

function useWideRail() {
  return useSyncExternalStore(subscribe, readWide, readOnServer);
}

export default function RailLayout({
  label,
  rail,
  bar,
  count,
  done,
  children,
}: {
  /** The rail's landmark name, e.g. "Filter and browse notes". */
  label: string;
  rail: ReactNode;
  /** On a narrow screen, shown beside the button: the active filters. */
  bar?: ReactNode;
  /** How many filters are on, for the button. */
  count: number;
  /** The sheet's closing button, which says what the reader goes back to: "Show 6 notes". */
  done: string;
  children: ReactNode;
}) {
  const wide = useWideRail();
  const sheet = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const w = useFilterWords();

  if (wide) {
    return (
      <div className={styles.layout}>
        <aside className={styles.rail} aria-label={label}>
          {rail}
        </aside>
        <div className={styles.main}>{children}</div>
      </div>
    );
  }

  const close = () => sheet.current?.close();

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.bar} data-filter-scope="">
          <button
            ref={opener}
            type="button"
            className={styles.open}
            aria-haspopup="dialog"
            aria-label={count > 0 ? w.filterOn(count) : undefined}
            onClick={() => sheet.current?.showModal?.()}
          >
            <span className={styles.openIcon} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {w.filter}
            {count > 0 && (
              <span className={styles.badge} aria-hidden="true">
                {count}
              </span>
            )}
          </button>
          {bar}
        </div>
        {children}
      </div>

      <dialog
        ref={sheet}
        className={styles.sheet}
        aria-labelledby={titleId}
        onClose={() => opener.current?.focus()}
        /* A press on the backdrop is a press on the dialog itself. */
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className={styles.sheetHead}>
          <h2 id={titleId} className={styles.sheetTitle}>
            {label}
          </h2>
          <button type="button" className={styles.x} onClick={close} aria-label={w.close}>
            <span aria-hidden="true" />
          </button>
        </div>
        <div className={styles.sheetBody} data-place="sheet">
          {rail}
        </div>
        <div className={styles.sheetFoot}>
          <button type="button" className={styles.done} onClick={close}>
            {done}
          </button>
        </div>
      </dialog>
    </div>
  );
}

export type IndexGroup = { label: string; items: { key: string; href: string; label: string }[] };

/**
 * The notes' table of contents, docs-style: what is on the wall now, grouped
 * (by year), each a link to the note. It follows the filters, so it is also
 * the fastest way to read what a filter left.
 */
export function RailIndex({ title, groups }: { title: string; groups: IndexGroup[] }) {
  const id = useId();
  if (groups.length === 0) return null;
  return (
    <nav className={styles.index} aria-labelledby={id}>
      <h2 id={id} className={styles.indexTitle}>
        {title}
      </h2>
      <div className={styles.indexScroll}>
        {groups.map((g) => (
          <section key={g.label} className={styles.group}>
            <h3 className={styles.groupLabel}>{g.label}</h3>
            <ul className={styles.entries}>
              {g.items.map((it) => (
                <li key={it.key}>
                  <Link to={it.href} className={styles.entry}>
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
