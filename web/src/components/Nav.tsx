import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { scrollToAnchor } from "@/lib/scrollToAnchor";
import ControlsIsland, { type NavControls } from "./nav/ControlsIsland";
import LanguageMenu from "./nav/LanguageMenu";
import MotionToggle from "./nav/MotionToggle";
import SocialIsland from "./nav/SocialIsland";
import { useLocale } from "./nav/locale";
import { ELSEWHERE } from "./nav/social";
import { useMotionPaused } from "./nav/useMotionPaused";
import styles from "./Nav.module.css";

/*
 * The destinations, and only the destinations.
 *
 * The nav used to carry the home page's section anchors as well — Work,
 * Approach, Stack, Contact — alongside the routes. The reasoning for that was
 * sound as far as it went: the anchors were shown on the home page only,
 * because from /projects a link labelled "Approach" is not navigation, it is
 * a trapdoor into a different page's scroll position. That rule is still
 * right and it is the reason the anchors are now gone entirely rather than
 * merely conditional.
 *
 * Two things finished the argument. A nav whose contents change when you
 * change page is a nav you have to re-read every time you arrive somewhere,
 * and six items on the home page against three everywhere else is not one
 * object with a state, it is two different navs sharing a shape. And a table
 * of contents for a page belongs to the page: the home page's sections are
 * reachable by scrolling, which is what a reader is already doing, and by the
 * hero's own "See the work" button, which is the one deliberate entry point
 * the first screen has. The chrome's job is the three places the site keeps.
 *
 * "Notes", not "Blog". The same place was called Blog here, Notes in the
 * footer and Writing on its own heading, which is three names for one
 * destination — and a nav item should name what it contains rather than what
 * kind of thing it is. The path stays /blog; the label is what people read.
 */
const ROUTES = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "Projects" },
  { to: "/blog", label: "Notes" },
];

/* Below this the three islands cannot sit side by side without the centre one
   losing its links; see the collapse note on `.dock` in Nav.module.css. The
   same query lives in the stylesheet, and the two have to agree, because this
   one also has to let go of a menu that CSS has just hidden. */
const WIDE = "(min-width: 768px)";

/*
 * Three floating glass islands rather than one bar, or one island.
 *
 * The reasoning for the shape — and the measurement that makes the glass
 * affordable at this size and ruinous at full width — is in Nav.module.css,
 * next to the rules it governs. Read that before widening anything.
 *
 * Why three
 * ---------
 * The single island had the wordmark, six links and a toggle in one pill,
 * which meant the site's map, the places I exist off the site and the
 * controls over how the page behaves were all the same kind of thing set in
 * the same type at the same size. They are not the same kind of thing, and a
 * reader sorts objects by position long before reading any of them. Left is
 * elsewhere, centre is this site, right is this page's behaviour.
 *
 * What is gone from the old bar, and why
 * --------------------------------------
 * The `solid` state, and the scroll listener that drove it. It existed
 * because a transparent full-width strip let scrolled body text render
 * through it and collide with the wordmark, so the bar had to acquire a
 * ground the moment the page moved. An island carries its own ground at all
 * times and has edges you can see, so there is no second state to switch to.
 *
 * The IntersectionObserver that lit the current section went with the section
 * links it was lighting. Nothing in the chrome is keyed to scroll position
 * any more, so the nav now costs one render per route change and nothing per
 * frame.
 *
 * Everything else the bar got right is still here: the disclosure that keeps
 * every destination reachable on a phone, Escape closing it and handing focus
 * back to the control that opened it, the scroll lock while it is open,
 * closing on a route change, 44px targets throughout, and `aria-current` on
 * the destination you are on.
 */
export default function Nav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const panelId = "nav-menu";
  const toggleRef = useRef<HTMLButtonElement>(null);

  /*
   * The controls are stateful and appear twice — once in the right island,
   * once in the sheet — so the state is held here, above both, rather than
   * inside the components. Two copies of "is motion paused" would be two
   * answers to a question the reader has already answered once, and only one
   * of them would match the class actually set on <body>.
   */
  const [locale, onSelectLocale] = useLocale();
  const [motionPaused, onToggleMotion] = useMotionPaused();
  const controls: NavControls = { locale, onSelectLocale, motionPaused, onToggleMotion };

  /* A menu that survives a route change as an invisible open panel is a trap. */
  useEffect(() => setOpen(false), [pathname]);

  /*
   * Widening past the breakpoint closes it too.
   *
   * The stylesheet hides the sheet above `WIDE`, which would otherwise leave
   * someone who opened the menu on a phone and then rotated it, or dragged a
   * desktop window wider, looking at a page whose body is still scroll-locked
   * by a panel they can no longer see or close.
   */
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
    // The page behind an open menu must not scroll under it.
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
   * The page behind it is scroll-locked, so without this the eighth Tab
   * walked out of the sheet and into content the reader could no longer
   * scroll to — they were typing into a contact form they could not see.
   * A dialog that covers the page has to own the tab order while it is
   * open; the scroll lock on its own only makes the escape worse.
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
   * `aria-current` is both the accessible answer and the styling hook: the
   * island has exactly one rule for "you are here" and it is keyed off the
   * attribute, so the two can never disagree.
   *
   * Home is matched exactly. `startsWith("/")` is true of every path on the
   * site, so the prefix test that is right for /projects and /blog would have
   * marked Home as current on all three.
   */
  const routeCurrent = (to: string) =>
    (to === "/" ? pathname === "/" : pathname.startsWith(to)) ? ("page" as const) : undefined;

  /* The wordmark is the one anchor left in the chrome, and it is the shortest
     trip on the page, so it is also the one that most wants easing. */
  const onWordmarkClick = (e: React.MouseEvent) => {
    close();
    if (!onHome) {
      // Off the home page this is a route change, not an anchor.
      e.preventDefault();
      navigate("/");
      return;
    }
    if (scrollToAnchor("hero")) e.preventDefault();
  };

  return (
    <header className={styles.dock}>
      {/* Left. Folds into the sheet below `WIDE`. */}
      <div className={styles.left}>
        <SocialIsland />
      </div>

      <nav className={`${styles.island} ${styles.centre}`} aria-label="Primary">
        <a href={onHome ? "#hero" : "/"} onClick={onWordmarkClick} className={styles.wordmark}>
          Y.B<span className={styles.stop}>.</span>
        </a>

        <ul className={styles.links}>
          {ROUTES.map((r) => (
            <li key={r.to}>
              <Link to={r.to} aria-current={routeCurrent(r.to)} className={styles.link}>
                {r.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Below `WIDE` the centre island is the only one left on screen, and
            this opens it into a sheet holding all three groups. Dropping the
            links without putting them anywhere is what once left a phone with
            two of six destinations and no way to reach the rest. */}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          className={styles.toggle}
        >
          <span className={styles.bars} aria-hidden="true" />
        </button>
      </nav>

      {/* Right. Folds into the sheet below `WIDE`. */}
      <div className={styles.right}>
        <ControlsIsland controls={controls} />
      </div>

      {/*
        One sheet, three groups, in the same order the islands sit in from
        left to right — so the phone layout is the desktop layout rotated
        rather than a second information architecture to learn.

        Each group keeps the landmark its island had. Below `WIDE` the side
        islands are `display: none`, which takes them out of the accessibility
        tree entirely, so without these the "Elsewhere" links and the controls
        would simply not exist for a screen reader on a phone.
      */}
      <div ref={sheetRef} id={panelId} hidden={!open} className={styles.sheet}>
        <nav aria-label="Pages">
          <p className={styles.sheetHead}>Pages</p>
          <ul className={styles.sheetList}>
            {ROUTES.map((r) => (
              <li key={r.to}>
                <Link
                  to={r.to}
                  onClick={close}
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
                  {/* Icon and word together here, where there is room for
                      both. The island drops the word because it has none. */}
                  <Icon className={styles.sheetIcon} aria-hidden="true" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sheetSplit} aria-hidden="true" />

        <div role="group" aria-label="Site controls">
          <p className={styles.sheetHead}>Controls</p>
          {/* The same two components the right island renders, not copies of
              them: the motion toggle owns a stored preference, and two
              implementations of it would be two chances to disagree about
              what the reader asked for. */}
          <div className={styles.sheetControls}>
            <LanguageMenu value={locale} onSelect={onSelectLocale} />
            <MotionToggle paused={motionPaused} onToggle={onToggleMotion} />
          </div>
        </div>
      </div>
    </header>
  );
}
