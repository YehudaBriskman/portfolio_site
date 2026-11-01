/*
 * One id per object in the collection.
 *
 * Written for a chrome that was an index of the objects on the page: the plate
 * stamped this id on itself and the bar jumped to it, and neither side was
 * allowed to spell it out by hand, because a hardcoded `#object-windom` in the
 * chrome against an `id="windom"` on the plate is exactly the drift this
 * function exists to make impossible.
 *
 * The chrome no longer carries that index, so nothing inside the app currently
 * jumps to one of these. They stay, and the function stays as the one place
 * the spelling is decided, for two reasons. An id on an object is an address:
 * a link to `/#object-icaros` pasted into a message, or reloaded from a
 * reader's own history, has to land on the object it names, and that promise
 * was made the moment the ids shipped. Checked rather than assumed, because
 * removing the only caller is exactly when a promise like this rots unnoticed:
 * a cold load of `/#object-windom` settles at scrollY 1076 and `/#object-bothy`
 * at 1508, each with its own card on screen. And the elements carrying them
 * are load-bearing in the pile for a second reason entirely — see `.marker` in
 * `projects/ProjectPile.module.css`, where the dwell between arrivals is keyed
 * off them, so deleting the now-uncalled anchors would take 1404px of the
 * peak's scroll budget with them.
 *
 * Why it lives in `lib` rather than in the nav
 * --------------------------------------------
 * Same reason `scrollToAnchor` does, and it is the reason this file did not
 * have to move when the index was removed from the chrome: the content owns
 * the plates, and if the convention lived in `components/nav` every gallery
 * component would be importing from the chrome in order to label itself —
 * the dependency pointing the wrong way, and in this case at a module that no
 * longer exists. `lib` is the place both ends can read from.
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
