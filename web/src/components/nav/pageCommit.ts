import { createContext, useContext, useEffect } from "react";

/*
 * "The page under the chrome has just mounted" — the one fact the chrome
 * cannot get from the router.
 *
 * Why this exists at all
 * ----------------------
 * Until #63 the chrome was rendered *inside* each page shell, so it mounted in
 * the same commit as the page it sat on, and anything it needed to look at in
 * that page — the `data-chrome="dark"` panels, above all — was already in the
 * document by the time its effects ran. That coupling was free and it was the
 * reason the bar unmounted on every navigation, which is what #63 is about.
 *
 * Hoisting the chrome above `<Routes>` (see `SiteChrome.tsx`) breaks the
 * coupling. The pathname changes the moment a link is followed, but every
 * route except `/` and the 404 is a `React.lazy` chunk behind
 * `<Suspense fallback={null}>`, so on a cold visit to `/projects` the page —
 * and the dark panel it declares — does not exist yet when the chrome's
 * pathname effect runs. The dark-chrome observer would look, find nothing,
 * and only see the panel on its 900ms late read, or never if the chunk took
 * longer than that. A bar left on paper over a black panel is the exact
 * failure `useDarkChrome` exists to prevent.
 *
 * So the page says when it has arrived, rather than the chrome guessing. A
 * page shell calls `usePageCommitted()`; the chrome listens. The signal is an
 * `EventTarget` rather than state for one reason: state held above both would
 * re-render the whole page a second time on every mount just to tell a sibling
 * something the sibling only needs to *react* to. An event costs nothing to
 * anyone who is not listening, and the page never re-renders for having sent
 * it.
 *
 * The one page whose dark is not a section (#179). `/blog` puts its whole
 * `<main>` on the notes room, and the declaration is on `<main>` itself,
 * rendered by `PageShell` — the same component that calls
 * `usePageCommitted()`. So the panel is in the document in the very commit
 * whose effect sends the signal, before the page's own request for the notes
 * has even left; nothing the API does can make the chrome miss it. That is
 * why the dark went on the shell and not on a box inside the page.
 *
 * Why not a MutationObserver, which would also see the panel arrive: the
 * reasoning at `LATE_READ_MS` in `useDarkChrome.ts` still holds — a subtree
 * observer on a page that re-renders on every API response would be woken by
 * every unrelated commit for the life of the session.
 */

/** The event name. One kind of event, so the name is a constant, not a type. */
export const PAGE_COMMIT = "page-commit";

/**
 * `null` outside `SiteChrome` — the chrome rendered alone in a test, or a page
 * rendered without the chrome — where there is nobody to tell and nothing to
 * do. Both ends treat it as "no signal" rather than as an error.
 */
export const PageCommitContext = createContext<EventTarget | null>(null);

/**
 * Called once by a page shell, so the chrome re-reads the page it is lying on.
 *
 * On mount only. A same-shell navigation (`/projects/a` → `/projects/b`)
 * re-renders the page rather than remounting it, and the chrome's own
 * pathname dependency already covers that case; this covers the one the
 * pathname cannot, a page that arrives after its pathname did.
 */
export function usePageCommitted(): void {
  const commits = useContext(PageCommitContext);
  useEffect(() => {
    commits?.dispatchEvent(new Event(PAGE_COMMIT));
  }, [commits]);
}

/** The listening end, for the chrome. */
export function usePageCommits(): EventTarget | null {
  return useContext(PageCommitContext);
}
