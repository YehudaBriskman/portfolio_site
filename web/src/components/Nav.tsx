import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { scrollToAnchor } from "@/lib/scrollToAnchor";
import Controls, { type NavControls } from "./nav/Controls";
import { DisplayPanel } from "./nav/DisplayMenu";
import ElsewhereMarks from "./nav/ElsewhereMarks";
import { NAV_ROUTES } from "./nav/navRoutes";
import { useDarkChrome } from "./nav/useDarkChrome";
import { useTuckedBar } from "./nav/useTuckedBar";
import { useLocale } from "./nav/locale";
import { useElsewhere } from "./nav/social";
import { usePauseSwitch } from "./nav/usePauseSwitch";
import { useChromeWords } from "@/i18n/chrome";
import styles from "./Nav.module.css";

/*
 * The chrome carries the rooms, the marks and the two switches. Nothing else.
 *
 * What this was, and why the index is gone
 * ---------------------------------------
 * An index of objects. The bar generated an item per project out of
 * `data/projects.ts`, plus the notes shelf and the inquiry plate — eight
 * names across the centre of the bar, each jumping to its plate if that plate
 * was in the document and routing to the object's own room if it was not,
 * with the one the reader was standing on filled solid. The argument was that
 * in a gallery the chrome's job is to say what is in the room and take you to
 * it, and a bar of three route links is a site map for a site that is really a
 * collection.
 *
 * That argument was sound and it is not what settled this. The owner has seen
 * it running and wants a quieter chrome, which is a judgement about the thing
 * itself rather than about the reasoning for it. Two measurements are worth
 * keeping as the record of what "full" meant: at 1440 the eight names alone
 * set 819px, and the first window that held the whole bar without the strip
 * scrolling was 1336px — so on every laptop the site is actually read on, the
 * chrome was a scroll container.
 *
 * What went with it: `navIndex.ts` (now `navRoutes.ts`, routes only),
 * `useCollectionIndex.ts` and `IndexLinks.tsx`. The chrome no longer reads the
 * collection, observes the page's plates, or holds a pending cross-route jump.
 *
 * The wayfinding that goes with it, and the decision taken about it
 * ----------------------------------------------------------------
 * The index was also the only thing on the site telling a reader who is not
 * looking at the screen *which object they were currently on* —
 * `aria-current="location"` tracked through the pile by a point probe under
 * the bar. Deleting the index deletes that, and deleting it and replacing it
 * with nothing would be a regression for exactly one reader. Three options
 * were open; this is the first of them, and the other two are declined for
 * reasons rather than by omission.
 *
 *   Accept it, which is what this does. Two things carried the weight and both
 *   survive. The page's heading outline *is* the in-page index: `h1` on the
 *   hero, `h2` per section, and an `h3` per object inside the pile (see
 *   `projects/ProjectRun.tsx`). Read off the home page it is
 *   `h1` Yehuda Briskman, `h2` Work over an `h3` each for WindoM, Bothy,
 *   Programming with Yehuda and Icaros, then `h2` How I work, Notes, Specs
 *   and Get in touch — which is every in-page destination the index had, in
 *   the order the page reads, in context, and jumpable. The index's eight
 *   items were those six plus two that were route changes to projects not on
 *   this page at all (#45 measured them as the undifferentiated items five and
 *   six); those are now reached through "Work", which is what a link to a
 *   room is for. So the outline is not a reduced index — it is the same set
 *   with the two liars taken out of it.
 *
 *   And "where am I" is a different question for this reader than for
 *   a sighted one: their position is the virtual cursor, which is already in
 *   the content and already announces each heading as it passes. The strip's
 *   marked pill answered a question about *scroll offset*, which is the
 *   sighted reader's question — and that reader is the one the owner is making
 *   the bar quieter for. The skip link to `#content` and the per-route title,
 *   announcement and focus move in `RouteAnnouncer.tsx` are untouched.
 *
 *   A one-item current-section indicator in the bar is declined twice over. It
 *   fails the brief — a word in the chrome that rewrites itself as the reader
 *   scrolls is the loudest thing in a bar whose whole point is now to be quiet
 *   — and it would keep the entire observer apparatus (a point probe, eleven
 *   thresholds, a late re-read, a resize re-pick) alive to feed one span.
 *
 *   Moving the index into the page, at the head of the work section, is the
 *   better design and is not refused on its merits: in context, next to the
 *   objects it names, is where a table of contents belongs, and it is the one
 *   option that gives something back rather than relying on what is already
 *   there. It is not done here because it is a change to the work section,
 *   which is being rebuilt in another branch as this is written, and because
 *   an index of plates belongs to whoever owns the plates. If the owner wants
 *   it, that is where it goes, and the heading outline is the floor it would
 *   be improving on rather than a gap it would be filling.
 *
 * `aria-current` therefore has one meaning again, "page", which is the meaning
 * it had before #45 gave it two. The room you are in is marked in the bar and
 * in the sheet. On a phone the collapsed control used to name it as well, and
 * no longer does — the note on the toggle below says why (#161).
 *
 * What is kept, because it was right
 * ----------------------------------
 * The disclosure that keeps everything reachable on a phone, Escape closing it
 * and handing focus back to the control that opened it, the tab trap and the
 * scroll lock while it is open, closing on a route change and on a widening
 * viewport, 44px targets throughout, no wordmark, and the dark material over
 * the one act that inverts the ground. The grid that centres the middle track
 * and the material that inverts are in Nav.module.css, next to the rules they
 * govern.
 */

/*
 * The collapse, in JavaScript, agreeing with the one in Nav.module.css.
 *
 * Below this the bar holds a single control and the sheet holds everything
 * else. The stylesheet hides the sheet above this width, which is what makes
 * the agreement load-bearing rather than tidy: without this query someone who
 * opened the sheet on a phone and then rotated it, or dragged a desktop window
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

export default function Nav() {
  const elsewhere = useElsewhere();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const panelId = "nav-menu";
  const toggleRef = useRef<HTMLButtonElement>(null);

  /* Whether a panel that inverts the ground is under the bar right now. */
  const dark = useDarkChrome(pathname, BAR_H);

  /* Whether the bar is out of the way above the window, because the reader is
     scrolling forward (#161). Never while the panel is open: the control that
     closes it is in the bar. `useDarkChrome` keeps watching the strip while
     the bar is away, so it comes back already in the right material. */
  const [tucked, reveal] = useTuckedBar(pathname, BAR_H, open);

  /*
   * The controls are stateful and appear twice — once in the bar, once in the
   * sheet — so the state is held here, above both, rather than inside the
   * components. Two copies of "is motion paused" would be two answers to a
   * question the reader has already answered once, and only one of them would
   * match the class actually set on <body>.
   */
  const [locale, onSelectLocale] = useLocale();
  const w = useChromeWords();
  const [motionPaused, onToggleMotion] = usePauseSwitch();
  const controls: NavControls = { locale, onSelectLocale, motionPaused, onToggleMotion };

  /* A sheet that survives a route change as an invisible open panel is a
     trap. Until #63 this was belt-and-braces: the bar was rendered by the page
     shell and unmounted on every navigation, which closed the sheet by
     destroying it. The bar now lives in `SiteChrome.tsx` above the routes and
     is never destroyed, so this is the only thing that closes it. Adjusted
     during render rather than in an effect, so the closed sheet lands in the
     same commit as the new route instead of one render after it. */
  const [sheetPath, setSheetPath] = useState(pathname);
  if (sheetPath !== pathname) {
    setSheetPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const onChange = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /*
   * Escape, and the scroll lock, which moved off `body` for a measured reason.
   *
   * It used to be `document.body.style.overflow = "hidden"`, and in Chromium
   * at 390x844 against the dev build that did neither of the two things it was
   * for. It did not lock — a wheel over the page moved it from scrollY 391 to
   * 891 with the panel open — and it cost width: `#root` and the section under
   * it went from 375.17px to 360.17px the instant the panel opened, 15.01px of
   * page gone sideways. That is the fifteen-pixel strip `nav/DisplayMenu.tsx`
   * documents, arriving by its own route rather than Radix's: `body` already
   * carries `scrollbar-gutter: stable` (index.css), so making it a scroll
   * container reserves a gutter the page did not have before. And `body` is
   * not the scrollport here in any case — `html` is, which is the whole
   * subject of the `scroll-padding-top` note at the top of Nav.module.css.
   *
   * So the lock is on `html`, and the gutter goes with it in the same
   * assignment. `overflow: hidden` alone takes the scrollbar away and the page
   * widens into the space it leaves; `scrollbar-gutter: stable` holds that
   * space open for as long as the panel is up. Measured, same viewport, with
   * the panel opening: `#root` 375.17px before and 375.17px after, the
   * document's client width 375px either side, and the page stays where it
   * was under a wheel, a drag and a PageDown.
   *
   * What the gutter costs, since it is not nothing: for as long as the panel
   * is open the 15px the scrollbar had is painted by the canvas rather than by
   * Chromium's track, which measured #2C2C2C before and #ECE8DC after. Against
   * the paper panel that is the same cream and invisible; against the panel
   * over the dark act, which measured #0C0C0E, it is a cream strip down the
   * edge of a desktop window narrower than 768px. The alternative is the page
   * itself moving 15px sideways, which is the thing this is here to stop.
   *
   * The scrim carries a second, narrower lock of its own — see `.scrim` in
   * Nav.module.css for what each of the two was measured to stop.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /*
       * One Escape, one layer.
       *
       * The language menu can be opened from inside the panel, and Radix
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
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousGutter = root.style.getPropertyValue("scrollbar-gutter");
    root.style.overflow = "hidden";
    root.style.setProperty("scrollbar-gutter", "stable");
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = previousOverflow;
      if (previousGutter) root.style.setProperty("scrollbar-gutter", previousGutter);
      else root.style.removeProperty("scrollbar-gutter");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /*
   * Keep Tab inside the open sheet.
   *
   * The page behind it is scroll-locked, so without this the last Tab walked
   * out of the sheet and into content the reader could no longer scroll to —
   * they were typing into a contact form they could not see. A dialog that
   * covers the page has to own the tab order while it is open; the scroll lock
   * on its own only makes the escape worse.
   *
   * The sheet is shorter than it was — three groups rather than four — and
   * that changes nothing here, because this walks whatever is focusable inside
   * it rather than a count of rows.
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

  /* A tap on the scrim has to put focus back as well, for the reason Escape
     does: the reader may have tabbed into the panel first, and everything in
     there is about to be `hidden`. A link in the panel does not need this —
     the route change moves focus itself, in RouteAnnouncer. */
  const dismiss = () => {
    close();
    toggleRef.current?.focus();
  };

  /*
   * `aria-current` for the routes, which is the only kind of current left.
   *
   * Home is matched exactly. `startsWith("/")` is true of every path on the
   * site, so the prefix test that is right for /projects and /blog would have
   * marked Home as current on all three. The prefix is also what marks the
   * room from inside it: on /projects/icaros and on a post, "All work" and
   * "All notes" are still where the reader is.
   */
  const routeCurrent = (to: string) =>
    (to === "/" ? pathname === "/" : pathname.startsWith(to)) ? ("page" as const) : undefined;

  /* Home on the home page is the shortest trip in the chrome and the one that
     most wants easing: it is a hop back to the title plate rather than a route
     change, and the router would otherwise treat it as navigating to the page
     you are already on, which does nothing. */
  const onRoute = (to: string, e: MouseEvent<HTMLAnchorElement>) => {
    close();
    if (to === "/" && pathname === "/" && scrollToAnchor("hero")) e.preventDefault();
  };

  return (
    /* `onFocus` is React's bubbling focus — `focusin` — so focus arriving on
       anything inside the bar un-tucks it, and it stays back after focus moves
       on. The stylesheet holds it on screen *while* keyboard focus is inside;
       this is what keeps it there afterwards. */
    <header
      className={styles.dock}
      data-material={dark ? "dark" : "paper"}
      data-tucked={tucked ? "" : undefined}
      onFocus={reveal}
    >
      <div className={styles.bar}>
        {/* Leading edge: the rooms. Folds into the sheet below `WIDE`. */}
        <div className={styles.lead}>
          <nav aria-label={w.pages}>
            <ul className={styles.routeRow}>
              {NAV_ROUTES.map((r) => (
                <li key={r.to}>
                  <Link
                    to={r.to}
                    onClick={(e) => onRoute(r.to, e)}
                    aria-current={routeCurrent(r.to)}
                    className={styles.route}
                  >
                    {r.label[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/*
          The collapsed menu, below `WIDE`, in the centre track. One word and
          the bars, on one line.

          It used to be two lines — MENU over the name of the room you were in
          — and #161 drops the second. Not because naming the room was wrong
          but because, on a phone, it was the third place saying it and the
          worst-placed of the three:

            The page says it first. Every room opens on its own title, set as
            the page's `h1` near the top — "What I'm building", "The long way
            round" — which says where the reader is in the page's own words
            rather than the menu's, and on a phone it is on the first screen.

            The menu says it best. Open it and the room you are in is the one
            row filled solid ink — the loudest mark in the chrome, at the one
            moment the reader is choosing where to go.

            And the bar now tucks away while the reader moves down a page, so
            the label was on screen in exactly two places: at the top of the
            page, under which the `h1` already says it, and on the way back up,
            when the reader is reaching for the menu rather than reading it.

          What it cost to keep it was the pill itself: an 11px field label over
          a 15px value inside a 44px control is two type sizes stacked in a
          space sized for one, and that cramped stack is what read badly.

          No `aria-label`: the visible text is "Menu", and that text has to *be*
          the accessible name — WCAG 2.5.3, Label in Name. `aria-expanded`
          carries the open state, which is the only thing a label would have
          had left to say.
        */}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className={styles.toggle}
        >
          <span>{w.menu}</span>
          <span className={styles.bars} aria-hidden="true" />
        </button>

        {/* Trailing edge: elsewhere, then the switches. Folds into the sheet
            below `WIDE`. */}
        <div className={styles.trail}>
          <nav aria-label={w.elsewhere}>
            <ElsewhereMarks />
          </nav>
          <span className={styles.split} aria-hidden="true" />
          <Controls controls={controls} />
        </div>
      </div>

      {/*
        The dim, and the second way out.

        A tap beside an open panel is how every reader already closes one, so
        the scrim is the affordance as much as it is the dim — and it carries
        one half of the scroll lock, which is why it covers the whole window
        rather than only the page below the bar. Pointer-only and `aria-hidden`: a keyboard
        has Escape and the toggle, and a second focus stop that does the same
        thing as both would only lengthen the ring the trap below walks.
      */}
      <div className={styles.scrim} hidden={!open} onClick={dismiss} aria-hidden="true" />

      {/*
        One panel, three groups, rooms first.

        The same set the bar carries and in the same order it reads in: where
        you can go on this site, where I am off it, and how this page behaves.
        It was four groups with the objects at the head of it; the panel drops
        to the bar's set rather than keeping an index a phone would be the only
        place left to find. Each group keeps the landmark it has in the bar.
        Above `WIDE` the bar's own copies are on screen and the panel is
        `display: none`, so no landmark is ever announced twice.

        Not `role="dialog"`. It behaves like one now — it is modal, it holds
        the tab order and Escape closes it — but the thing it holds is three
        landmarks, and a dialog is a single named region that would swallow
        them. The toggle's `aria-expanded`/`aria-controls` already say what
        this is and whether it is open.
      */}
      <div ref={sheetRef} id={panelId} hidden={!open} className={styles.sheet}>
        <nav aria-label={w.pages}>
          <p className={styles.sheetHead}>{w.pages}</p>
          <ul className={styles.sheetList}>
            {NAV_ROUTES.map((r) => (
              <li key={r.to}>
                <Link
                  to={r.to}
                  onClick={(e) => onRoute(r.to, e)}
                  aria-current={routeCurrent(r.to)}
                  className={styles.sheetLink}
                >
                  {r.label[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sheetSplit} aria-hidden="true" />

        <nav aria-label={w.elsewhere}>
          <p className={styles.sheetHead}>{w.elsewhere}</p>
          <ul className={styles.sheetList}>
            {elsewhere.map(({ key, href, label, Icon, external }) => (
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

        <div role="group" aria-label={w.siteControls}>
          <p className={styles.sheetHead}>{w.controls}</p>
          {/* The same panel the bar's popover holds, laid out in place: a
              popover on top of a sheet would be a popup on a popup. It is
              stateless (theme, size and contrast live in their own stores;
              language and motion come from the one `controls` object), so the
              two copies cannot disagree. */}
          <DisplayPanel controls={controls} inline />
        </div>
      </div>
    </header>
  );
}
