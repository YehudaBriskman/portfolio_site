import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { scrollToAnchor } from "@/lib/scrollToAnchor";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import Controls, { type NavControls } from "./nav/Controls";
import IndexLinks from "./nav/IndexLinks";
import LanguageMenu from "./nav/LanguageMenu";
import ElsewhereMarks from "./nav/ElsewhereMarks";
import MotionToggle from "./nav/MotionToggle";
import { NAV_INDEX, NAV_ROUTES, type NavIndexItem } from "./nav/navIndex";
import { useCollectionIndex } from "./nav/useCollectionIndex";
import { useDarkChrome } from "./nav/useDarkChrome";
import { useLocale } from "./nav/locale";
import { ELSEWHERE } from "./nav/social";
import { useMotionPaused } from "./nav/useMotionPaused";
import styles from "./Nav.module.css";

/*
 * The chrome is an index of objects, and it jumps.
 *
 * What this was, and why a site map was the wrong object
 * -----------------------------------------------------
 * Three route links — Home, Projects, Notes — in three ruled islands, which
 * was a considered answer to the previous question. The reasoning is worth
 * restating because it is what made the move to an index obvious rather than
 * decorative:
 *
 *   The nav used to carry the home page's section anchors as well. Those were
 *   removed on the grounds that a nav whose contents change when you change
 *   page is a nav you have to re-read every time you arrive somewhere, and
 *   that from /projects a link labelled "Approach" is not navigation but a
 *   trapdoor into another page's scroll position. What was left was "the three
 *   places the site keeps".
 *
 * Both of those observations are still true and neither of them was the
 * problem. The problem is that three route links are a site map, and this site
 * is not a site: it is a collection. In a gallery the chrome's job is to tell
 * you what is in the room and take you to it — so the bar carries the objects,
 * generated from the same table the plates are rendered from
 * (`nav/navIndex.ts`), with the one you are standing on marked.
 *
 * The old objection is answered rather than ignored. The index does not change
 * between pages: it is the same eight items in the same order everywhere,
 * because the collection does not change when you open a note. What changes is
 * only where a given item has to take you — the plate, if it is on this page;
 * the object's own room, if it is not. That is in `IndexLinks.tsx`.
 *
 * What the routes are now
 * -----------------------
 * Still here, and no longer the primary thing in the bar. They sit at the
 * leading edge in the quiet value, labelled "Home", "All work" and "All
 * notes" — see `NAV_ROUTES` for why "All", which is not a flourish but the
 * only thing separating the room called Notes from the object called Notes.
 *
 * What is gone
 * ------------
 * The wordmark. "Y.B." rendered above a first screen that sets the full name
 * in display type was a second, worse answer to a question the page had
 * already answered, and a monogram is the one thing in a chrome that cannot
 * say where it goes. The trip it offered is now a word in the route group.
 *
 * The three islands, which are one bar from edge to edge. The grid that
 * centres the index, the material that inverts over the dark act, and the
 * reason the blur came back are all in Nav.module.css, next to the rules they
 * govern.
 *
 * What is kept, because it was right
 * ----------------------------------
 * The disclosure that keeps everything reachable on a phone, Escape closing it
 * and handing focus back to the control that opened it, the tab trap and the
 * scroll lock while it is open, closing on a route change and on a widening
 * viewport, 44px targets throughout, and `aria-current` on where you are. The
 * last of those has grown a second meaning; see `IndexLinks.tsx`.
 */

/*
 * The collapse, in JavaScript, agreeing with the one in Nav.module.css.
 *
 * Below this the bar holds a single control and the sheet holds everything
 * else. The stylesheet hides the sheet above this width, which is what makes
 * the agreement load-bearing rather than tidy: without this query someone who
 * opened the index on a phone and then rotated it, or dragged a desktop window
 * wider, is looking at a page whose body is still scroll-locked by a panel
 * they can no longer see or close.
 */
const WIDE = "(min-width: 768px)";

/*
 * How far down the viewport the bar's lower edge sits, in px.
 *
 * Matches `--bar-h` in Nav.module.css and is the one number the dark-material
 * observer needs: the band it watches is the viewport's top edge down to here.
 * A `getBoundingClientRect` on the bar would read the same number at the cost
 * of a layout read on every resize, for a value that is a constant in the
 * stylesheet.
 */
const BAR_H = 56;

/*
 * How long to keep trying to land a jump that crossed a route.
 *
 * "Contact" is the one index item with no room of its own, so from a note it
 * is a route change *and* a scroll, and the scroll cannot be done until the
 * home page has rendered the plate. The target exists on the first commit —
 * `useProjects` is seeded — so in practice this lands on the first frame; the
 * budget is for a slow commit, and it gives up rather than retrying forever,
 * because a hash that never resolves is a bug and not something to spin on.
 */
const JUMP_FRAMES = 30;

export default function Nav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const panelId = "nav-index";
  const toggleRef = useRef<HTMLButtonElement>(null);

  /* Which plates are on this page, and which one the reader is on. One
     observer, no scroll listener; see the hook. */
  const indexState = useCollectionIndex(NAV_INDEX, pathname);
  /* Whether a panel that inverts the ground is under the bar right now. */
  const dark = useDarkChrome(pathname, BAR_H);

  /*
   * The controls are stateful and appear twice — once in the bar, once in the
   * sheet — so the state is held here, above both, rather than inside the
   * components. Two copies of "is motion paused" would be two answers to a
   * question the reader has already answered once, and only one of them would
   * match the class actually set on <body>.
   */
  const [locale, onSelectLocale] = useLocale();
  const [motionPaused, onToggleMotion] = useMotionPaused();
  const reduced = usePrefersReducedMotion();
  const controls: NavControls = { locale, onSelectLocale, motionPaused, onToggleMotion };

  /*
   * Whether the chrome is allowed to move.
   *
   * Both off-switches, composed: the OS preference is a standing answer about
   * every site, and Pause is this reader deciding about this page. Only the
   * index strip's own travel is governed by it — the jump itself is left to
   * `scrollToAnchor`, which already eases or arrives by distance and by the OS
   * preference. A smooth scroll that a reader asked for by clicking a link is
   * not the ambient motion either switch was written about.
   */
  const settle = !motionPaused && !reduced;

  /* A sheet that survives a route change as an invisible open panel is a
     trap. */
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const onChange = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /*
       * One Escape, one layer.
       *
       * The language menu can be opened from inside the sheet, and Radix
       * closes it on Escape from its own listener on `document` — which this
       * one on `window` then sees as well, so a single press was dismantling
       * both and dropping the reader back on the page. Escape should undo the
       * last thing that happened, not everything that is open.
       */
      if (document.querySelector('[role="menu"]')) return;
      setOpen(false);
      // Send focus back to the control that opened it, or it lands on <body>
      // and keyboard users lose their place entirely.
      toggleRef.current?.focus();
    };
    // The page behind an open sheet must not scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /*
   * Keep Tab inside the open sheet.
   *
   * The page behind it is scroll-locked, so without this the eighth Tab walked
   * out of the sheet and into content the reader could no longer scroll to —
   * they were typing into a contact form they could not see. A dialog that
   * covers the page has to own the tab order while it is open; the scroll lock
   * on its own only makes the escape worse.
   */
  useEffect(() => {
    if (!open) return;
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusable = [
        ...sheet.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((el) => el.offsetParent !== null);
      /* The toggle lives outside the sheet but belongs to it: it is how the
         reader got here and how they leave. */
      const stops = toggleRef.current ? [toggleRef.current, ...focusable] : focusable;
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onTab);
    return () => window.removeEventListener("keydown", onTab);
  }, [open]);

  const close = () => setOpen(false);

  /*
   * A jump that crossed a route, finished once the new page is on screen.
   *
   * Held in a ref and not in state: nothing renders differently because a jump
   * is pending, and putting it in state would re-render the chrome twice for a
   * value only this effect reads.
   */
  const pendingJump = useRef<string | null>(null);

  useEffect(() => {
    const id = pendingJump.current;
    if (!id) return;
    let frames = 0;
    let raf = 0;
    const land = () => {
      /* `scrollToAnchor` returns false when the id is not in the document yet,
         which is the only reason to try again — and it moves focus as well as
         the viewport, which is the whole point of going through it. */
      if (scrollToAnchor(id) || ++frames > JUMP_FRAMES) {
        pendingJump.current = null;
        return;
      }
      raf = requestAnimationFrame(land);
    };
    raf = requestAnimationFrame(land);
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  /*
   * `aria-current` for the routes.
   *
   * Home is matched exactly. `startsWith("/")` is true of every path on the
   * site, so the prefix test that is right for /projects and /blog would have
   * marked Home as current on all three.
   */
  const routeCurrent = (to: string) =>
    (to === "/" ? pathname === "/" : pathname.startsWith(to)) ? ("page" as const) : undefined;

  /*
   * Activating an index item.
   *
   * Three cases, in the order they are decided:
   *
   *   The plate is on this page. Jump to it — and `scrollToAnchor` moves focus
   *   onto the plate, which is the part that makes this navigation rather than
   *   a scroll shortcut. A link that moves the viewport and leaves focus in the
   *   bar does nothing at all for a keyboard user: their next Tab goes to the
   *   next item in the bar, not into the thing they just asked to see. The same
   *   audit finding retired the skip link that did this.
   *
   *   The object has a room of its own. Let the <Link> navigate; there is
   *   nothing to scroll to and the new page starts at its own top.
   *
   *   The object is a plate on another page — Contact is the only one. Let the
   *   <Link> navigate and remember the id, which the effect above lands once
   *   the page has rendered.
   */
  const onPick = (item: NavIndexItem, e: MouseEvent<HTMLAnchorElement>) => {
    close();
    if (indexState.present.has(item.key)) {
      if (scrollToAnchor(item.anchor)) e.preventDefault();
      return;
    }
    if (item.away.anchor) pendingJump.current = item.away.anchor;
  };

  /* Home on the home page is the shortest trip in the chrome and the one that
     most wants easing: it is a hop back to the title plate rather than a route
     change, and the router would otherwise treat it as navigating to the page
     you are already on, which does nothing. */
  const onRoute = (to: string, e: MouseEvent<HTMLAnchorElement>) => {
    close();
    if (to === "/" && pathname === "/" && scrollToAnchor("hero")) e.preventDefault();
  };

  /* What the collapsed index says it is showing. With nothing marked — at the
     top of the page, before the first plate — it says how many objects are in
     the room, which is the other thing an index is for. */
  const now = NAV_INDEX.find((i) => i.key === indexState.current);
  const nowLabel = now ? now.label : `${NAV_INDEX.length} objects`;

  return (
    <header className={styles.dock} data-material={dark ? "dark" : "paper"}>
      <div className={styles.bar}>
        {/* Leading edge: the rooms. Folds into the sheet below `WIDE`. */}
        <div className={styles.lead}>
          <nav aria-label="Pages">
            <ul className={styles.routeRow}>
              {NAV_ROUTES.map((r) => (
                <li key={r.to}>
                  <Link
                    to={r.to}
                    onClick={(e) => onRoute(r.to, e)}
                    aria-current={routeCurrent(r.to)}
                    className={styles.route}
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* The centre track. Centred by the grid, not by a margin. */}
        <nav className={styles.indexWrap} aria-label="Index">
          <IndexLinks
            items={NAV_INDEX}
            state={indexState}
            variant="bar"
            settle={settle}
            onPick={onPick}
          />
        </nav>

        {/*
          The collapsed index, below `WIDE`, in the same track.

          No `aria-label`: the visible text is "Index" and the name of the
          object the reader is on, and that text has to *be* the accessible
          name — WCAG 2.5.3, Label in Name, which is what made the language
          picker read "EN — change language" rather than "Language: English".
          `aria-expanded` carries the open state, which is the only thing a
          label would have had left to say.
        */}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className={styles.toggle}
        >
          <span className={styles.toggleStack}>
            <span className={styles.toggleHead}>Index</span>
            <span className={styles.toggleNow}>{nowLabel}</span>
          </span>
          <span className={styles.bars} aria-hidden="true" />
        </button>

        {/* Trailing edge: elsewhere, then the switches. Folds into the sheet
            below `WIDE`. */}
        <div className={styles.trail}>
          <nav aria-label="Elsewhere">
            <ElsewhereMarks />
          </nav>
          <span className={styles.split} aria-hidden="true" />
          <Controls controls={controls} />
        </div>
      </div>

      {/*
        One sheet, four groups, index first.

        The order is the bar read from its centre outwards, which is also the
        order of how much the chrome thinks each group matters: the objects in
        the room, the rooms, off the site, and how the page behaves. Each group
        keeps the landmark it has in the bar. Above `WIDE` the bar's own copies
        are on screen and the sheet is `display: none`, so no landmark is ever
        announced twice.
      */}
      <div ref={sheetRef} id={panelId} hidden={!open} className={styles.sheet}>
        <nav aria-label="Index">
          <p className={styles.sheetHead}>In the room</p>
          <IndexLinks
            items={NAV_INDEX}
            state={indexState}
            variant="sheet"
            settle={settle}
            onPick={onPick}
          />
        </nav>

        <div className={styles.sheetSplit} aria-hidden="true" />

        <nav aria-label="Pages">
          <p className={styles.sheetHead}>Pages</p>
          <ul className={styles.sheetList}>
            {NAV_ROUTES.map((r) => (
              <li key={r.to}>
                <Link
                  to={r.to}
                  onClick={(e) => onRoute(r.to, e)}
                  aria-current={routeCurrent(r.to)}
                  className={styles.sheetLink}
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sheetSplit} aria-hidden="true" />

        <nav aria-label="Elsewhere">
          <p className={styles.sheetHead}>Elsewhere</p>
          <ul className={styles.sheetList}>
            {ELSEWHERE.map(({ key, href, label, Icon, external }) => (
              <li key={key}>
                <a
                  href={href}
                  onClick={close}
                  className={styles.sheetLink}
                  {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                >
                  {/* Mark and word together here, where there is room for
                      both — and the address, which the bar leaves out; see the
                      note on `EMAIL` in social.ts. */}
                  <Icon className={styles.sheetGlyph} />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sheetSplit} aria-hidden="true" />

        <div role="group" aria-label="Site controls">
          <p className={styles.sheetHead}>Controls</p>
          {/* The same two components the bar renders, not copies of them: the
              motion toggle owns a stored preference, and two implementations
              of it would be two chances to disagree about what the reader
              asked for. */}
          <div className={styles.sheetControls}>
            <LanguageMenu value={locale} onSelect={onSelectLocale} />
            <MotionToggle paused={motionPaused} onToggle={onToggleMotion} />
          </div>
        </div>
      </div>
    </header>
  );
}
