import { useState } from "react";
import { Outlet } from "react-router-dom";
import { scrollToAnchor } from "@/lib/scrollToAnchor";
import Nav from "@/components/Nav";
import AmbientOrbs from "@/components/ground/AmbientOrbs";
import { PageCommitContext } from "@/components/nav/pageCommit";
import LocalBrowseProvider from "@/components/nav/LocalBrowseProvider";
import { useChromeWords } from "@/i18n/chrome";

/*
 * The public chrome, mounted once for the visit rather than once per page.
 *
 * This is a layout route: App.tsx nests every reader-facing route under it, so
 * React Router renders this element at the same position in the tree for all
 * of them and swaps only the `<Outlet />`. The skip link and the bar are
 * therefore the *same* elements on `/`, on `/blog/some-post` and on the 404 —
 * re-rendered with a new pathname, never torn down.
 *
 * Why the chrome moved here (#63)
 * -------------------------------
 * It used to be rendered by the page shells, one `<Nav />` in `Index.tsx` and
 * another in `PageShell.tsx`. `<Routes>` swaps element types on navigation,
 * and those two were different positions in the tree, so every route change
 * unmounted one bar and mounted another: anything the chrome held in a ref or
 * in local state was thrown away on every link. #50 was exactly that — a
 * pending in-page jump, stored so it could be applied after the destination
 * painted, discarded before it could be.
 *
 * The issue named two fixes. The cheaper one was a module-level store that
 * whichever `Nav` mounted next would read. It was declined, and for reasons:
 *
 *   It fixes one remembered thing per store, by convention. The next feature
 *   that wants the chrome to remember something has to know to put it in a
 *   module rather than in `useState`, and the failure for not knowing is
 *   silent — "the thing I stored vanished". Hoisting removes the class of bug
 *   rather than documenting a workaround for it.
 *
 *   It cannot hold what is not data. Focus inside the bar, a CSS transition in
 *   flight, an open Radix menu, the scroll position of the sheet: all of it is
 *   DOM state, and an unmount loses it however carefully the data is kept.
 *
 *   It leaks between tests and between mounts. Module state outlives the tree
 *   that wrote it, so every test that touches it has to reset it, and a stale
 *   value from one visit can be read by the next mount.
 *
 *   And it leaves the one visible symptom in place. Every route but `/` and
 *   the 404 is a `React.lazy` chunk behind `<Suspense fallback={null}>`, and
 *   while the bar lived inside the page it lived inside the suspended tree
 *   too: on a cold navigation the whole chrome blinked out until the chunk
 *   arrived. Here it is outside every Suspense boundary and stays put.
 *
 * What the hoist cost, and how each cost is paid
 * ----------------------------------------------
 * The issue was right that this is a real change rather than a move, because
 * the chrome was quietly relying on mounting with its page.
 *
 *   The dark-chrome observer looked for the page's dark panels on mount, and
 *   on mount the page was always there. Now the pathname can change before a
 *   lazy page exists. The page shells announce their own arrival through
 *   `nav/pageCommit.ts`, provided here, and the observer rebuilds on that.
 *
 *   The sheet closed on navigation because it was destroyed. `Nav.tsx` already
 *   had the effect that closes it on a pathname change; it has gone from
 *   belt-and-braces to the thing actually doing the work.
 *
 *   The skip link has to come before the bar in the tab order, so it moved up
 *   with it — it was identical in both shells anyway, and is now written once.
 *   It targets `#content`, which each shell still renders as its own `<main>`
 *   because the two shells disagree about nav clearance (see PageShell).
 *
 * The admin routes are deliberately not under this. They have their own shell
 * and their own chrome (`admin/AdminShell.tsx`), and the public bar never
 * appeared on them.
 */
export default function SiteChrome() {
  /* One EventTarget for the life of the chrome. `useState` with an
     initialiser, not `useMemo`, because React is allowed to throw a memo away
     and a new target would silently drop the chrome's listener. */
  const [commits] = useState(() => new EventTarget());
  const w = useChromeWords();

  return (
    <PageCommitContext.Provider value={commits}>
      {/* #content, not the first section. Pointing it at the home page's
          first section scrolled the reader past the page's own h1 and intro —
          it skipped the content rather than skipping to it. */}
      <a
        href="#content"
        onClick={(e) => { if (scrollToAnchor("content")) e.preventDefault(); }}
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[70] focus:bg-bone focus:px-4 focus:py-2 focus:text-bitumen"
      >
        {w.skip}
      </a>
      <AmbientOrbs />
      {/* The page's own Browse goes into the phone menu (#780). */}
      <LocalBrowseProvider>
        <Nav />
        <Outlet />
      </LocalBrowseProvider>
    </PageCommitContext.Provider>
  );
}
