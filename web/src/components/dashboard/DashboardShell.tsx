import { useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import styles from "@/components/dashboard/Dashboard.module.css";
import { useWords } from "@/components/dashboard/i18n";

/*
 * The dashboard shell (#224), shared by Blogs, an area (#225), the channel
 * log (#226) and Work (#227): GitHub's dashboard layout in the site's own
 * material.
 *
 *   ┌──────────┬──────────────────────────────┬────────────┐
 *   │ rail     │ main                         │ aside      │
 *   │ who,     │ the page's own content       │ what is    │
 *   │ views,   │                              │ happening  │
 *   │ areas,   │                              │ elsewhere  │
 *   │ filters  │                              │            │
 *   └──────────┴──────────────────────────────┴────────────┘
 *
 * THE GROUND is the theme's (#247). This shell was the note cards' dark
 * (`notes/DarkCard.module.css`, #185) edge to edge, hard-coded with
 * `.on-panel` and `data-chrome="dark"`, which is how the site came to have a
 * light theme on some pages and a dark one on others. That dark is now the
 * Dark theme's ground for every page, and the shell paints `--canvas` and
 * `--ink` like any other page: paper under Light, the warm dark under Dark.
 * No `data-chrome` either, because the bar already wears the theme's
 * material; it only needs telling when it passes over an act. It is not an
 * act: no seams, no drift, no crest.
 *
 * THREE WIDTHS, by what fits rather than by device:
 *
 *   ≥ 80rem  three columns. The rail is GitHub's 18rem, the aside 20rem.
 *   ≥ 64rem  two: the aside drops under the main column, which is the order
 *            a reader wants it in once it cannot sit beside it.
 *   below    one: the rail becomes a sheet behind a button above the main
 *            column, and the aside follows the main column.
 *
 * Which one is drawn is a `matchMedia` read through `useSyncExternalStore`
 * (the rail's reasoning in `gallery/Rail.tsx`): the rail is mounted once, so
 * its ids and its live regions exist once.
 *
 * The sheet is a native modal `<dialog>`: focus trap, Escape, an inert page
 * and the top layer for nothing, and focus back on the button when it
 * closes. It appears without a transition (`docs/motion-contract.md`).
 *
 * RTL: the grid is in logical order, so the rail is on the right in Hebrew
 * and nothing here names a side.
 */

const THREE = "(min-width: 80rem)";
const TWO = "(min-width: 64rem)";

type Mode = "three" | "two" | "one";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const qs = [window.matchMedia(THREE), window.matchMedia(TWO)];
  qs.forEach((q) => q.addEventListener("change", onChange));
  return () => qs.forEach((q) => q.removeEventListener("change", onChange));
}
function readMode(): Mode {
  if (typeof window.matchMedia !== "function") return "three";
  if (window.matchMedia(THREE).matches) return "three";
  return window.matchMedia(TWO).matches ? "two" : "one";
}

function useDashboardMode(): Mode {
  return useSyncExternalStore(subscribe, readMode, () => "three" as Mode);
}

type Props = {
  /** The rail's landmark name. */
  railLabel: string;
  rail: ReactNode;
  /** The aside's landmark name. */
  asideLabel: string;
  aside: ReactNode;
  /** On a phone, beside the button that opens the rail: the active filters. */
  bar?: ReactNode;
  /** How many filters are on, for the button's badge. */
  count?: number;
  /**
   * The top of the main column, ahead of everything else in it: a page's
   * title. Only matters with `asideFirst`, which would otherwise put the
   * aside above the title.
   */
  head?: ReactNode;
  /**
   * When the aside cannot sit beside the main column, put it under `head`
   * and above the rest rather than at the end. An area's page (#225) uses
   * it: its aside is the way to the project, the feed and the docs, which a
   * phone reader wants before a long history.
   */
  asideFirst?: boolean;
  children: ReactNode;
};

export default function DashboardShell({
  railLabel,
  rail,
  asideLabel,
  aside,
  bar,
  count = 0,
  head,
  asideFirst = false,
  children,
}: Props) {
  const mode = useDashboardMode();
  const [t] = useWords();
  const sheet = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const close = () => sheet.current?.close();

  const asideNode = (
    <aside className={styles.aside} aria-label={asideLabel}>
      {aside}
    </aside>
  );

  return (
    <div className={styles.ground} data-mode={mode}>
      <div className={styles.frame}>
        {mode !== "one" && (
          <aside className={styles.rail} aria-label={railLabel}>
            <div className={styles.railInner}>{rail}</div>
          </aside>
        )}

        <div className={styles.main}>
          {mode === "one" && (
            <div className={styles.sheetBar} data-filter-scope="">
              <button
                ref={opener}
                type="button"
                className={styles.sheetOpen}
                aria-haspopup="dialog"
                onClick={() => sheet.current?.showModal?.()}
              >
                <span className={styles.burger} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                {t.browse}
                {/* The name is the content, not an aria-label: a label that
                    reworded "Browse" and the badge failed SC 2.5.3 (label in
                    name) once a filter was on. Read as "Browse 2 filter". */}
                {count > 0 && (
                  <>
                    {" "}
                    <span className={styles.badge}>{count}</span>{" "}
                    <span className="sr-only">{t.filter.toLowerCase()}</span>
                  </>
                )}
              </button>
              {bar}
            </div>
          )}
          {head}
          {mode !== "three" && asideFirst && asideNode}
          {children}
          {mode !== "three" && !asideFirst && asideNode}
        </div>

        {mode === "three" && asideNode}
      </div>

      {mode === "one" && (
        <dialog
          ref={sheet}
          className={styles.sheet}
          aria-labelledby={titleId}
          onClose={() => opener.current?.focus()}
          onClick={(e) => {
            /* A press on the backdrop is a press on the dialog itself. */
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className={styles.sheetHead}>
            <h2 id={titleId} className={styles.sheetTitle}>
              {railLabel}
            </h2>
            <button type="button" className={styles.sheetClose} onClick={close} aria-label={t.close}>
              <span aria-hidden="true" />
            </button>
          </div>
          {/* A link inside the sheet goes somewhere on this page or another,
              and either way the sheet has done its job. */}
          <div
            className={styles.sheetBody}
            onClick={(e) => {
              const a = (e.target as HTMLElement).closest("a[href]");
              if (a && !a.closest("[data-filter-scope]")) close();
            }}
          >
            {rail}
          </div>
        </dialog>
      )}
    </div>
  );
}
