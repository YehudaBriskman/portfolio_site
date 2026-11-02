/*
 * The three rooms the site keeps, which are now the whole of what the bar
 * takes you to.
 *
 * What this file used to be
 * -------------------------
 * `navIndex.ts`, and most of it was an index generated from `data/projects.ts`
 * — every project, the notes shelf and the inquiry plate, eight items with the
 * one you were standing on marked. That reasoning is written up where it was
 * reversed (see the head of `Nav.tsx`); what matters here is that the
 * generation is gone, so the chrome no longer imports the collection at all.
 * A bar that lists three fixed rooms has no table to drift from, which is why
 * a hand-written array is the right shape now and was the wrong one then.
 *
 * Why the labels say "All"
 * ------------------------
 * The first reason for "All notes" was that the index also carried an item
 * called Notes, pointing at the shelf, and two links a hundred pixels apart
 * with one label and two destinations is the kind of thing that makes a reader
 * stop trusting a nav. That particular collision has gone with the index.
 *
 * The labels stay anyway, because the collision was never only with the bar's
 * own item: the home page sets `<h2>Work</h2>` over four of however many
 * projects exist, and `<h2>Notes</h2>` over a shelf of four. A reader who has
 * just passed those headings and then follows a bar link labelled "Notes"
 * arrives at a room of all of them and has no way to know whether it is the
 * same thing one scroll higher. "All" is the word that separates the room from
 * the section — one scroll apart rather than a hundred pixels, which is worse
 * rather than better, because the two are never on screen together to be
 * compared.
 *
 * "Home" is a word rather than a monogram. "Y.B." rendered above a first
 * screen that sets the full name in display type was a second, worse answer to
 * a question the page had already answered, and a monogram is the one thing in
 * a chrome that cannot say where it goes.
 *
 * "The story" is the fourth room (#46), and it sits after "All work" because
 * it is the same work along the other axis — the collection says what exists,
 * the story says how it got there — so the two are read as a pair. It is not
 * "About" and not "CV": the page is a chaptered account of the work, it names
 * no employer, and a label promising a résumé would be a label for a page
 * that does not exist.
 */
export type NavRoute = { to: string; label: string };

export const NAV_ROUTES: readonly NavRoute[] = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "All work" },
  { to: "/story", label: "The story" },
  { to: "/blog", label: "All notes" },
];
