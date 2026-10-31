/*
 * One id per object in the collection.
 *
 * The chrome is an index of the objects on the page (see `nav/navIndex.ts`),
 * and an index is only an index if the names in it point at something. That
 * needs a convention both ends can agree on without importing each other: the
 * plate that renders an object stamps this id on itself, and the bar jumps to
 * it. Neither side may spell it out by hand — a hardcoded `#object-windom` in
 * the chrome and an `id="windom"` on the plate is exactly the drift this
 * function exists to make impossible.
 *
 * Why it lives in `lib` rather than in the nav
 * --------------------------------------------
 * Same reason `scrollToAnchor` does. The content owns the plates and the
 * chrome owns the index; if the convention lived in `components/nav` every
 * gallery component would be importing from the chrome in order to label
 * itself, which is the dependency pointing the wrong way. `lib` is the place
 * both can read from.
 *
 * The prefix is not decoration. Slugs come from the collections database and
 * could collide with an id a page already uses — `work`, `notes`, `contact`
 * are all section ids on the home page and all plausible slugs — and two
 * elements with one id is a jump that lands wherever the parser happened to
 * stop.
 */
export function objectAnchorId(slug: string): string {
  return `object-${slug}`;
}
