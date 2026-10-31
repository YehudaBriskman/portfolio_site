import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { focusForNavigation } from "@/lib/scrollToAnchor";
import { HOME_TITLE, pageIdentityFor } from "@/lib/pageTitle";

/*
 * The one thing that happens when the route changes.
 *
 * What was measured before this existed
 * -------------------------------------
 * `/` → `/projects` through a link in the bar left `document.activeElement` on
 * `<body>`, `scrollY` at 0, `document.title` unchanged, and nothing announced.
 * Through the index, "Icaros" left focus on `<body>` and "Text Encrypting" left
 * it on the link that had just been clicked and then unmounted. Four routes —
 * `/`, `/projects`, `/blog` and the 404 — carried one byte-identical title.
 *
 * That is the standard single-page-app failure and it has three halves, all of
 * them here because all three are the same event: the page has to say what it
 * now is (`document.title`), say it out loud once (the live region), and put
 * the keyboard somewhere on it (focus).
 *
 * Why it is one component above `<Routes>` and not a hook in each page
 * -------------------------------------------------------------------
 * Two reasons, and the second is the one that decides it.
 *
 * The live region has to be in the DOM from the first paint. A region created
 * in the same commit as its first content is a region nobody has subscribed to
 * yet, and it loses the announcement in exactly the case it was written for —
 * the same finding that shaped the two regions in `Contact.tsx`, where it is
 * written up at length. A region rendered inside the page being navigated to is
 * created at the moment of every navigation, which is the broken version with
 * extra steps. This one is mounted once, outside `<Routes>`, and only its text
 * changes.
 *
 * And `pageIdentityFor` answers for addresses that have no component at all —
 * the catch-all 404, and the four redirect routes that render a `<Navigate>`
 * and nothing else. A per-page hook cannot be called from a page that does not
 * exist, and "landed nowhere" is the route the audit called out by name.
 *
 * What this deliberately does not do
 * ----------------------------------
 * It does not scroll. It focuses, and on an ordinary route change it lets that
 * focus bring the heading into view, which is the same thing arrived at for the
 * right reason — the reader is put *on* the new page's heading rather than at a
 * scroll offset that happens to show it. Scroll restoration proper is a
 * separate concern with its own failure modes; see the `preventScroll` note
 * below for the two cases where something else already owns the position.
 *
 * It also fires on the first render for the title only, never for focus.
 * Moving focus on initial page load is its own accessibility bug: nobody asked
 * to go anywhere, and it skips past everything above the heading — including
 * the skip link, which is the one control that exists for readers who would
 * have wanted it.
 */

/**
 * How long to keep looking for the new page's heading, in milliseconds.
 *
 * A budget and not a frame count, which the first version of this got wrong by
 * copying `JUMP_FRAMES` out of Nav.tsx. That loop waits for an element React
 * is about to commit, so thirty frames is generous. This one waits for a
 * `React.lazy` chunk: every route except `/` and the 404 is code-split in
 * App.tsx and renders behind `<Suspense fallback={null}>`, so the heading this
 * is looking for does not exist until a network request has finished. Thirty
 * frames is half a second on a fast machine and nothing at all on a throttled
 * one, so the budget is stated in the unit the wait is actually measured in.
 *
 * Two seconds, then it gives up rather than spinning: a route whose heading
 * never arrives is a bug, and a loop that waits forever hides it.
 */
const HEADING_BUDGET_MS = 2000;

/**
 * How long a heading that has not changed is given to change, in milliseconds.
 *
 * This number is the whole of a bug that cost an hour, and it is worth stating
 * what was measured because the obvious implementation is wrong in a way that
 * tests in jsdom cannot see.
 *
 * On a navigation into a chunk that is not loaded yet, React does not clear the
 * screen. `useLocation()` reports the new pathname — so this effect runs — but
 * the committed DOM is still the *outgoing* page's, and it stays that way until
 * the chunk arrives. Measured in Chrome against the built site: one frame after
 * the effect for `/blog` ran, `document.querySelector("main h1")` still read
 * "What I'm building", which is the heading of `/projects`. A loop that focuses
 * the first heading it finds therefore focuses the page the reader just left —
 * and then React commits the real page, removes that element, and focus falls
 * back to `<body>`. Which is precisely the measured failure this component was
 * written to fix, reintroduced by its own fix. It is also why `/` → `/projects`
 * passed and `/projects` → `/blog` did not: the first navigation of a session
 * crosses no Suspense boundary that is already mounted.
 *
 * So a heading is only trusted when it is not the one that was already there.
 * That cannot be the only rule, because one legitimate case has the same
 * heading element before and after: `/projects/icaros` → `/projects/text-
 * encrypting` keeps `<Project>` mounted, so React updates the text inside the
 * same `<h1>` and no new element ever appears. This is the grace period that
 * tells the two apart — if the heading has not been replaced by now, it is
 * because it was reconciled rather than because the page has not arrived.
 *
 * 180ms, which is between the two things it has to separate: a chunk that is
 * already in memory commits within a frame or two, and a reader cannot perceive
 * a sixth of a second as a delay. It is not a guess about the network, because
 * nothing depends on being right about the network — a slow chunk that commits
 * after the grace period is corrected by the watch below rather than missed.
 */
const STALE_SETTLE_MS = 180;

/**
 * Where the keyboard lands on a new page.
 *
 * The heading first, because that is the thing that names the page and the
 * announcement has just said its name — focus and live region agreeing is what
 * makes the pair read as one event rather than two. `<main>` is the fallback
 * for a page with no `h1`; every page on this site has one in every state,
 * including Project's `sr-only` "Loading project", and that is a promise worth
 * keeping rather than a condition worth coding around — but a fallback that
 * cannot be wrong costs one line.
 */
function headingTarget(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("main h1") ??
    document.querySelector<HTMLElement>("h1") ??
    document.querySelector<HTMLElement>("main")
  );
}

export default function RouteAnnouncer() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const [announcement, setAnnouncement] = useState("");

  /*
   * The last pathname this has acted on. `null` until the first render has
   * been handled, which is how "first load" is told from "navigation" without
   * a second ref — and a ref rather than state because nothing renders
   * differently for having been announced.
   *
   * It also absorbs the case the dependency list cannot: `hash` and
   * `navigationType` are read here, so they are dependencies, so a hash-only
   * change re-runs this effect. A fragment change is not a new page — it must
   * not re-announce and must not steal focus from whatever `scrollToAnchor`
   * has just put it on — and comparing the pathname is the whole guard.
   */
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (announced.current === pathname) return;
    const first = announced.current === null;
    announced.current = pathname;

    const { name, title } = pageIdentityFor(pathname);

    /*
     * On a navigation the title is always ours. On the first render it is only
     * ours if nobody better has already written it.
     *
     * `backend/src/services/seo.ts` rewrites the whole head per URL before the
     * HTML is served, because crawlers do not run JavaScript — so on a cold
     * load of `/blog/why-ci-must-fail` the title in the tab is already the
     * post's real one, which is strictly better than anything derivable from
     * the path. Overwriting it with "Why ci must fail · Yehuda Briskman" for
     * the few hundred milliseconds until the page's own fetch lands would be a
     * regression caused by the fix.
     *
     * The test for "nobody better has written it" is that the title is still
     * the shell's own, character for character. It is a comparison and not a
     * flag because there is nothing to read a flag off: the rewrite happens in
     * another process, and the only evidence of it in the document is the
     * result. Served statically — `vite preview`, the dev server, the 404 —
     * the title *is* the shell's, and this corrects it.
     */
    if (!first || document.title === HOME_TITLE) document.title = title;

    if (first) return;

    /*
     * The announcement, by name and exactly once.
     *
     * `/projects` used to carry its own `sr-only role="status"` reading
     * "6 projects", which is the page answering a question nobody asked: a
     * count is not a name, it was the only route with any announcement at all,
     * and the three facts in that page's own header already state the counts in
     * text a screen reader reaches by reading. It has been removed rather than
     * left beside this one — two live regions on one page announcing one
     * navigation is the thing a reader cannot switch off.
     *
     * Writing the same string twice is deliberately *not* a second
     * announcement: React leaves the text node alone, so a redirect route
     * resolving to its destination's name (see `canonicalSegments`) passes
     * through silently instead of announcing twice.
     */
    setAnnouncement(name);

    /*
     * `preventScroll` is true exactly when something else already owns the
     * scroll position.
     *
     *   A hash in the URL. The fragment is the reader's stated destination and
     *   `scrollToAnchor` is on its way to it; focusing the heading at all
     *   would be taking it off them, so this skips the focus move outright
     *   rather than merely not scrolling.
     *
     *   A history traversal. Back and Forward restore where the reader was,
     *   and yanking them to the top of a page they are returning to mid-read
     *   is the same bug as focusing on first load. They still get the heading
     *   focused — "nothing lands on `<body>`" has to hold for Back too — but
     *   the viewport stays where the browser put it.
     *
     * Anything else is a link the reader just activated, where bringing the
     * new page's heading into view is precisely what they asked for.
     */
    if (hash) return;
    const preventScroll = navigationType === "POP";

    /*
     * The heading that was on screen when this navigation was announced — the
     * outgoing page's, whenever React has not committed the incoming one yet.
     * See `STALE_SETTLE_MS` for what that costs and why it cannot be ignored.
     */
    const stale = headingTarget();
    /** The element this put focus on, so it can tell its own work from the
     *  reader's. Once the reader has moved focus themselves, this stops. */
    let ours: HTMLElement | null = null;
    let raf = 0;
    const started = performance.now();

    const take = (target: HTMLElement) => {
      focusForNavigation(target, preventScroll);
      ours = target;
    };

    const land = () => {
      const elapsed = performance.now() - started;
      const target = headingTarget();

      if (target) {
        if (target !== stale) {
          /*
           * A heading that was not there a moment ago: this is the new page.
           * Taken whenever it appears, including after the grace period has
           * already handed focus to the reconciled heading — a chunk slow
           * enough to commit after 180ms would otherwise leave focus on an
           * element React is about to remove, which is the original bug.
           */
          if (!ours || document.activeElement === ours || document.activeElement === document.body) {
            take(target);
          }
          /* Done either way: the page has arrived, and if the reader has taken
             focus somewhere themselves in the meantime it is not ours to move. */
          return;
        }
        /* Still the same element after the grace period, so it was reconciled
           in place rather than left over — focus it, and keep watching in case
           this was a slow chunk after all. */
        if (!ours && elapsed > STALE_SETTLE_MS && target.isConnected) take(target);
      }

      /* Out of budget. Focus is left wherever it is rather than put somewhere
         arbitrary: a page with no heading after two seconds is a bug to find,
         not a thing to paper over. */
      if (elapsed > HEADING_BUDGET_MS) return;
      raf = requestAnimationFrame(land);
    };
    raf = requestAnimationFrame(land);
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash, navigationType]);

  /*
   * Polite, atomic, and empty until it is not.
   *
   * `role="status"` carries an implicit `aria-live="polite"`; both are written
   * out because the pair is what several screen readers actually look for, and
   * because a reader of this file should not have to know the implicit mapping
   * to see what this element is. `aria-atomic` so the name is read as one
   * string rather than as a diff against the name before it.
   *
   * Not `role="alert"`: a route change is something the reader asked for, and
   * an assertive region interrupts whatever the page is in the middle of
   * saying — which on a fresh page is the page. The split is the same one
   * `Contact.tsx` makes between its receipt and its failure.
   */
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </p>
  );
}
