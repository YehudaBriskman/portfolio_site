import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { takeLangScroll } from "@/i18n/routing";
import { findAnchor, focusForNavigation, scrollToAnchor } from "@/lib/scrollToAnchor";

/*
 * Where the reader lands after a link (#196). The one owner of the window's
 * scroll position across navigations.
 *
 * What was measured before this existed
 * -------------------------------------
 * Nothing on the site scrolled on a route change. `<BrowserRouter>` is the
 * declarative router, and react-router's `<ScrollRestoration>` only works
 * under a data router, so the window simply kept whatever position the
 * outgoing page had. Pages *looked* as if they started at the top because
 * `RouteAnnouncer` focused the new page's heading and focus scrolled it into
 * view — which lands at the top only when the heading is the first thing on
 * the page. The 404's "Home" left the home page at scrollY 28. And no hash
 * crossing a route landed at all: `/#contact` from /accessibility left the
 * reader at scrollY 1154 with the contact plate 10,000px below, and a cold
 * load of `/story#now` or `/projects/bothy#decisions-heading` stayed at 0,
 * because the browser looks for a fragment once, at parse time, and on a
 * single-page app the element is not in the document yet.
 *
 * Why this rather than migrating to a data router for `<ScrollRestoration>`
 * -------------------------------------------------------------------------
 * The migration rewrites App.tsx's whole route table and still would not do
 * the hard half. `<ScrollRestoration>` restores in the commit that renders the
 * new location, and scrolls to a hash only if the element exists in that same
 * commit. Every route here but `/` and the 404 is a lazy chunk, and the hash
 * targets that matter — the contact plate, a project in the run, a heading on
 * a project page — sit below content that arrives with a fetch. So the wait
 * has to be written either way, and once it is, the rest is twenty lines.
 *
 * The rules, in the order they are tried
 * --------------------------------------
 *   Back or Forward to an entry this tab has a position for: that position,
 *   once the page is tall enough to hold it.
 *   A hash: the element it names, when it exists, aligned by the browser's own
 *   `scrollIntoView` so the document's `scroll-padding-top` (the bar, in
 *   Nav.module.css) and the target's `scroll-margin-top` both count.
 *   The same path with a new query — a filter on /projects or /blog: where the
 *   reader was. The filter links ask for that with `preventScrollReset`, which
 *   only a data router reads, so the rule is stated here instead.
 *   Anything else: the first pixel.
 *
 * Waits are observers with a budget, never a fixed delay: a MutationObserver
 * for the target to exist, a ResizeObserver for the page to grow tall enough
 * or for content above the target to finish arriving. Any input from the
 * reader — wheel, touch, a key, a press — ends every wait, because a page that
 * moves after the reader has started moving it is the worst version of this.
 */

/** How long to wait for a hash's target, or for a page to be tall enough to
 *  restore into. A lazy chunk and a fetch, on a slow phone. */
const WAIT_BUDGET_MS = 6000;

/** How long layout has to be still before a landing is final. Content above
 *  the target — an image, a fetched list, a pinned section measuring itself —
 *  moves it, and each move restarts this. */
const QUIET_MS = 700;

const STORE = "scroll-positions";
const INPUT = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

function readStore(): Map<string, number> {
  try {
    const raw = sessionStorage.getItem(STORE);
    return new Map(raw ? (JSON.parse(raw) as [string, number][]) : []);
  } catch {
    return new Map();
  }
}

function writeStore(positions: Map<string, number>): void {
  try {
    /* The last fifty entries are plenty for one tab's Back stack. */
    sessionStorage.setItem(STORE, JSON.stringify([...positions].slice(-50)));
  } catch {
    /* Private mode or a full quota: positions are kept for this page only. */
  }
}

/*
 * Which entry a position belongs to.
 *
 * react-router keys every entry it pushes, but the entry a tab *arrived* on
 * has no key of its own — it reads "default" on every cold load, whatever the
 * address. So the address goes into that one's name, or a position saved on
 * /projects would be restored onto a later cold load of /story.
 */
function entryName(key: string, pathname: string, search: string): string {
  return key === "default" ? `default:${pathname}${search}` : key;
}

/*
 * Whether the document itself was reloaded or reached by Back/Forward, the two
 * cases where a saved position is the reader's and not left over from an
 * earlier visit in the same tab. A typed address or a link from elsewhere is
 * a new arrival, and lands where its hash says, or at the top.
 */
function returning(): boolean {
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload" || nav?.type === "back_forward";
}

function jump(top: number): void {
  window.scrollTo({ top, left: 0, behavior: "instant" });
}

/**
 * Runs `step` now and again whenever the DOM or the page's size changes, until
 * it returns true, the budget runs out, or the reader takes over. Returns the
 * cancel.
 */
function watch(step: () => boolean, budget = WAIT_BUDGET_MS): () => void {
  let done = false;
  const mo = new MutationObserver(() => run());
  const ro = new ResizeObserver(() => run());
  const stop = () => {
    if (done) return;
    done = true;
    mo.disconnect();
    ro.disconnect();
    window.clearTimeout(cap);
    for (const type of INPUT) window.removeEventListener(type, stop, true);
  };
  function run() {
    if (done) return;
    if (step()) stop();
  }
  const cap = window.setTimeout(stop, budget);
  for (const type of INPUT) window.addEventListener(type, stop, { capture: true, passive: true });
  mo.observe(document.body, { childList: true, subtree: true });
  ro.observe(document.body);
  run();
  return stop;
}

/**
 * Keeps an element at its landing place while the layout above it settles,
 * then lets go. Ends after `QUIET_MS` with no resize, at the budget, or on
 * the reader's first input.
 */
function hold(el: HTMLElement, budget = WAIT_BUDGET_MS): () => void {
  let done = false;
  let quiet = 0;
  const ro = new ResizeObserver(() => {
    if (done) return;
    if (el.isConnected) el.scrollIntoView({ block: "start", behavior: "instant" });
    window.clearTimeout(quiet);
    quiet = window.setTimeout(stop, QUIET_MS);
  });
  function stop() {
    if (done) return;
    done = true;
    ro.disconnect();
    window.clearTimeout(cap);
    window.clearTimeout(quiet);
    for (const type of INPUT) window.removeEventListener(type, stop, true);
  }
  const cap = window.setTimeout(stop, budget);
  quiet = window.setTimeout(stop, QUIET_MS);
  for (const type of INPUT) window.addEventListener(type, stop, { capture: true, passive: true });
  ro.observe(document.body);
  return stop;
}

/** A location as this remembers it, and the one it was reached from. */
type Place = { pathname: string; search: string };
type Entry = Place & { key: string; before: Place | null };

export default function ScrollManager() {
  const { key, pathname, search, hash } = useLocation();
  const navigationType = useNavigationType();

  /* Positions by history entry, kept across a reload of the tab. */
  const positions = useRef<Map<string, number> | null>(null);
  /* The entry the window's scroll position currently belongs to. */
  const current = useRef<string | null>(null);
  const previous = useRef<Entry | null>(null);
  /* The language switch's hand-over, taken once per mount and tied to the
     entry it was for, so a repeated effect run (StrictMode) sees the same
     answer and a later navigation in this mount never does. */
  const langTaken = useRef(false);
  const langKept = useRef<{ key: string; y: number | null } | null>(null);

  useEffect(() => {
    const prior = history.scrollRestoration;
    /* The browser restores at popstate, before the page it is restoring has
       rendered — into the outgoing page's height. This does it later. */
    history.scrollRestoration = "manual";
    const map = (positions.current ??= readStore());
    const onScroll = () => {
      if (current.current !== null) map.set(current.current, Math.round(window.scrollY));
    };
    const onHide = () => {
      onScroll();
      writeStore(map);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onHide);
      history.scrollRestoration = prior;
    };
  }, []);

  /*
   * A layout effect, so the scroll to the top lands in the same frame as the
   * new page rather than one painted frame after it. It runs in the commit
   * that renders the new location — the router updates its state in a
   * transition, so a lazy page's old DOM stays up until the chunk is in and
   * nothing has clamped the outgoing position by then.
   */
  useLayoutEffect(() => {
    const map = (positions.current ??= readStore());
    if (current.current !== null) map.set(current.current, Math.round(window.scrollY));
    const name = entryName(key, pathname, search);
    /* A second run for the same entry — StrictMode, or a dependency React
       re-checks — is the same arrival, so it keeps the same origin. */
    const last = previous.current;
    const before: Place | null =
      last === null ? null : last.key === key ? last.before : { pathname: last.pathname, search: last.search };
    const first = before === null;
    current.current = name;
    previous.current = { key, pathname, search, before };

    /* A language switch: stay where the reader was (see `takeLangScroll`),
       unless the address names an anchor, which is handled below. */
    if (!langTaken.current) {
      langTaken.current = true;
      langKept.current = { key, y: takeLangScroll() };
    }
    const kept = langKept.current?.key === key ? langKept.current.y : null;
    if (kept !== null && hash.length <= 1) {
      return watch(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        jump(Math.min(kept, Math.max(0, max)));
        return max >= kept;
      });
    }

    const saved = navigationType === "POP" && (!first || returning()) ? map.get(name) : undefined;
    if (saved !== undefined) {
      return watch(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        jump(Math.min(saved, Math.max(0, max)));
        return max >= saved;
      });
    }

    if (hash.length > 1) {
      let id = hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        /* A malformed escape: look for the id as written. */
      }
      /* A hop within the page the reader is on eases and moves focus, the
         way the in-page links do. Arriving from another page or from outside
         is an arrival, not a hop: it lands at once. */
      const hop = !first && before?.pathname === pathname;
      let release: (() => void) | null = null;
      const stopWaiting = watch(() => {
        const el = findAnchor(id);
        if (!el) return false;
        if (hop && scrollToAnchor(el.id || id)) return true;
        el.scrollIntoView({ block: "start", behavior: "instant" });
        /* Focus follows a link the reader activated, so the next Tab starts
           from the target. Not on a cold load: nobody asked to go anywhere
           yet, and focus there would skip the skip link. */
        if (!first) focusForNavigation(el, true);
        release = hold(el);
        return true;
      });
      return () => {
        stopWaiting();
        release?.();
      };
    }

    if (first) return;
    if (before?.pathname === pathname && before.search !== search) return;
    jump(0);
  }, [key, pathname, search, hash, navigationType]);

  return null;
}
