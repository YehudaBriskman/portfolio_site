import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./Nav.module.css";

/*
 * Section anchors, in the order the sections appear on the home page. They are
 * only meaningful there: from /projects, "Approach" was a link back out to a
 * different page's scroll position, which is not navigation, it is a trapdoor.
 */
const items = [
  { id: "work", label: "Work" },
  { id: "approach", label: "Approach" },
  { id: "stack", label: "Stack" },
  { id: "contact", label: "Contact" },
];

/*
 * The real destinations. These are the whole nav once you leave the home page.
 *
 * "Notes", not "Blog". The same place was called Blog here, Notes in the
 * footer and Writing on its own heading, which is three names for one
 * destination — and a nav item should name what it contains rather than what
 * kind of thing it is. The path stays /blog; the label is what people read.
 */
const ROUTES = [
  { to: "/projects", label: "Projects" },
  { to: "/blog", label: "Notes" },
];

/*
 * Smooth scrolling, per click, instead of `scroll-behavior: smooth` on <html>.
 *
 * The global rule animated every anchor on the site, including the skip link,
 * and the page is thousands of pixels tall — Blink caps a programmatic smooth
 * scroll at roughly 700ms, so one click on "Contact" fast-forwarded the entire
 * descent in under a second. Deciding per click means a short hop can ease and
 * a long one can simply arrive, which is also what a reader expects of a
 * table of contents.
 */
const SMOOTH_LIMIT_PX = 2600;

function scrollToAnchor(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const far = Math.abs(el.getBoundingClientRect().top) > SMOOTH_LIMIT_PX;
  el.scrollIntoView({ behavior: reduced || far ? "auto" : "smooth", block: "start" });
  return true;
}

/*
 * A floating glass island rather than a full-width bar.
 *
 * The reasoning for the shape — and the measurement that makes the glass
 * affordable at this size and ruinous at full width — is in Nav.module.css,
 * next to the rules it governs. Read that before widening anything.
 *
 * What is gone from the old bar, and why
 * --------------------------------------
 * The `solid` state, and the scroll listener that drove it. It existed
 * because a transparent full-width strip let scrolled body text render
 * through it and collide with the wordmark, so the bar had to acquire a
 * ground the moment the page moved. An island carries its own ground at all
 * times and has edges you can see, so there is no second state to switch to —
 * and the site is one passive scroll listener lighter for it.
 *
 * Everything else the bar got right is still here: the observer that tracks
 * the section you are in, the disclosure that keeps all six destinations
 * reachable on a phone, Escape closing it and handing focus back to the
 * control that opened it, the scroll lock while it is open, closing on a
 * route change, 44px targets throughout, and the per-click scroll above.
 */
export default function Nav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === "/";
  const [active, setActive] = useState("hero");
  const [open, setOpen] = useState(false);
  const panelId = "nav-menu";
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.isIntersecting && setActive(e.target.id));
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    ["hero", ...items.map((i) => i.id)].forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  /* A menu that survives a route change as an invisible open panel is a trap. */
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
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

  const close = () => setOpen(false);

  /*
   * `aria-current` is both the accessible answer and the styling hook: the
   * island has exactly one rule for "you are here" and it is keyed off the
   * attribute, so the two can never disagree. The section links never carried
   * it at all before, which left a screen reader with no way to know which of
   * the four was lit.
   */
  const sectionCurrent = (id: string) => (active === id ? ("true" as const) : undefined);
  const routeCurrent = (to: string) => (pathname.startsWith(to) ? ("page" as const) : undefined);

  const onAnchorClick = (e: React.MouseEvent, id: string) => {
    close();
    if (scrollToAnchor(id)) e.preventDefault();
  };

  return (
    <header className={styles.dock}>
      <nav className={styles.island} aria-label="Primary">
        <a
          href={onHome ? "#hero" : "/"}
          onClick={(e) => {
            close();
            // Off the home page this is a route change, not an anchor.
            if (!onHome) {
              e.preventDefault();
              navigate("/");
            }
          }}
          className={styles.wordmark}
        >
          Y.B<span className={styles.stop}>.</span>
        </a>

        {/* The whole map, laid out, from `sm` up. */}
        <ul className={styles.links}>
          {!onHome && (
            <li>
              <Link to="/" className={styles.link}>
                Home
              </Link>
            </li>
          )}
          {onHome &&
            items.map((i) => (
              <li key={i.id}>
                <a
                  href={`#${i.id}`}
                  aria-current={sectionCurrent(i.id)}
                  onClick={(e) => onAnchorClick(e, i.id)}
                  className={styles.link}
                >
                  {i.label}
                </a>
              </li>
            ))}
          {ROUTES.map((r) => (
            <li key={r.to}>
              <Link to={r.to} aria-current={routeCurrent(r.to)} className={styles.link}>
                {r.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Below `sm` the island opens into a sheet instead. Dropping the links
            without putting them anywhere is what left a phone with two of the
            six destinations and no way to reach the rest. */}
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

      <div id={panelId} hidden={!open} className={styles.sheet}>
        <ul className={styles.sheetList}>
          {onHome &&
            items.map((i) => (
              <li key={i.id}>
                <a
                  href={`#${i.id}`}
                  aria-current={sectionCurrent(i.id)}
                  onClick={(e) => onAnchorClick(e, i.id)}
                  className={styles.sheetLink}
                >
                  {i.label}
                </a>
              </li>
            ))}
          {onHome && <li className={styles.sheetSplit} aria-hidden="true" />}
          {!onHome && (
            <li>
              <Link to="/" onClick={close} className={styles.sheetLink}>
                Home
              </Link>
            </li>
          )}
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
      </div>
    </header>
  );
}
