/*
 * Smooth scrolling decided per click, instead of `scroll-behavior: smooth` on
 * <html>.
 *
 * The global rule animated every anchor on the site, including the skip link,
 * and the page is thousands of pixels tall — Blink caps a programmatic smooth
 * scroll at roughly 700ms, so one click on a link near the foot of the page
 * fast-forwarded the entire descent in under a second. Deciding per click
 * means a short hop can ease and a long one can simply arrive, which is also
 * what a reader expects of a table of contents.
 *
 * Why this lives in `lib` rather than in the nav
 * ----------------------------------------------
 * It was written for the nav's section links, and those links have moved off
 * the nav entirely — the chrome now carries page destinations only. The
 * behaviour has not stopped being wanted: the hero's "See the work" button and
 * the skip link on every page are plain `#hash` anchors pointed at the same
 * sections, and they are the ones that make the long descent now. Putting the
 * function here keeps it available to them without either importing from the
 * chrome, and the nav's wordmark still calls it for the hop back to #hero.
 */
const SMOOTH_LIMIT_PX = 2600;

/**
 * Scrolls to the element with this id, easing only when the trip is short
 * enough to be worth watching.
 *
 * @returns `true` when the element existed and was scrolled to, so a caller
 * handling a click can `preventDefault()` only in the case it actually
 * handled — a missing id must still fall through to the browser's own
 * fragment navigation rather than becoming a dead link.
 */
export function scrollToAnchor(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const far = Math.abs(el.getBoundingClientRect().top) > SMOOTH_LIMIT_PX;
  el.scrollIntoView({ behavior: reduced || far ? "auto" : "smooth", block: "start" });

  /*
   * Move focus, not just the viewport.
   *
   * An audit caught this doing nothing for a keyboard user: the skip link
   * scrolled the page and left focus on itself, so the very next Tab went
   * straight back into the nav. A skip link that does not move focus skips
   * nothing — it is a scroll shortcut for people who already had one.
   *
   * `tabindex="-1"` is set here rather than in the markup because the
   * targets are ordinary sections that should not be in the tab order; this
   * makes them focusable only for the moment they are jumped to. It is
   * removed again on blur so nothing is left programmatically focusable
   * that a reader could not have reached before.
   */
  const hadTabIndex = el.hasAttribute("tabindex");
  if (!hadTabIndex) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  if (!hadTabIndex) {
    el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true });
  }

  return true;
}
