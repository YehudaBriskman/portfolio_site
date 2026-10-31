import { useEffect } from "react";
import { documentTitleFor } from "@/lib/pageTitle";

/*
 * A page correcting its own title, once it knows it.
 *
 * `lib/pageTitle.ts` answers for every address from the URL alone, which is
 * what the 404 and the redirect routes need and is as far as a URL can go: a
 * note at `/blog/why-ci-must-fail` is titled "Why ci must fail" until the
 * fetch that holds its real title lands. This is the correction.
 *
 * Why this is not the primary mechanism
 * -------------------------------------
 * It was, in the first draft, and it got the two routes the issue names wrong.
 * A hook has to be called from a component, and the 404 is reached by every
 * address that matches nothing while the redirect routes render a `<Navigate>`
 * and no page at all — so a hook-only design titles exactly the pages that
 * already had the least wrong title and leaves "landed nowhere" reading as the
 * home page. The resolver answers first; this refines.
 *
 * Why there is no cleanup
 * -----------------------
 * Restoring the previous title on unmount is the reflex and it is wrong here.
 * A page unmounts because the reader navigated, and `RouteAnnouncer` has
 * already written the new page's title by the time this one's cleanup would
 * run — so restoring would put the *old* page's title on the *new* page, which
 * is a worse version of the bug this all exists to fix. Nothing has to be
 * undone: every route change writes the title unconditionally.
 */

/**
 * Sets `document.title` to `name · Yehuda Briskman` whenever `name` is known.
 *
 * @param name the page's real name, or `null` while it is still unknown —
 *   which is the state a page is in before its fetch resolves and during a
 *   loading or error state. `null` leaves the resolver's answer standing
 *   rather than replacing it with a placeholder of this hook's own: a page
 *   that cannot name itself yet has nothing to add.
 */
export function useDocumentTitle(name: string | null): void {
  useEffect(() => {
    if (!name) return;
    document.title = documentTitleFor(name);
  }, [name]);
}
