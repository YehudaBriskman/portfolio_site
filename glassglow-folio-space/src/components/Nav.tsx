import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

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

/* The real destinations. These are the whole nav once you leave the home page. */
const ROUTES = [
  { to: "/projects", label: "Projects" },
  { to: "/blog", label: "Blog" },
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

export default function Nav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === "/";
  const [active, setActive] = useState("hero");
  const [solid, setSolid] = useState(false);
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
    // Solid almost immediately: a transparent fixed bar let scrolled body
    // text render through it and collide with the wordmark.
    const onScroll = () => setSolid(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
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
    // The page behind a full-height menu must not scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    /*
     * Solid, not blurred. A fixed bar with backdrop-filter has to re-sample and
     * re-blur everything passing underneath it on every single frame, which on
     * a phone is enough to make the whole page feel like it is catching up with
     * your thumb. On a background this dark the blur was buying almost nothing.
     */
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid || open ? "border-b border-edge bg-bitumen/95" : ""
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
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
          className="mono -my-3 inline-flex min-h-11 items-center py-3 text-xs uppercase tracking-[0.22em] text-bone"
        >
          Y.B<span className="text-sodium">.</span>
        </a>

        {/* Desktop: the whole map, laid out. */}
        <ul className="hidden items-center gap-8 sm:flex">
          {!onHome && (
            <li>
              <Link
                to="/"
                className="mono -my-3 block py-3 text-[0.6875rem] uppercase tracking-[0.18em] text-clay transition-colors hover:text-bone"
              >
                Home
              </Link>
            </li>
          )}
          {onHome &&
            items.map((i) => (
              <li key={i.id}>
                <a
                  href={`#${i.id}`}
                  onClick={(e) => { if (scrollToAnchor(i.id)) e.preventDefault(); }}
                  className={`mono -my-3 block py-3 text-[0.6875rem] uppercase tracking-[0.18em] transition-colors ${
                    active === i.id ? "text-sodium" : "text-clay hover:text-bone"
                  }`}
                >
                  {i.label}
                </a>
              </li>
            ))}
          {ROUTES.map((r) => (
            <li key={r.to}>
              <Link
                to={r.to}
                aria-current={pathname.startsWith(r.to) ? "page" : undefined}
                className={`mono -my-3 block py-3 text-[0.6875rem] uppercase tracking-[0.18em] transition-colors ${
                  pathname.startsWith(r.to) ? "text-sodium" : "text-clay hover:text-bone"
                }`}
              >
                {r.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile: a real disclosure. Dropping the links below `sm` left the
            phone with two of the six destinations and no way to reach the rest. */}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-[--r-sm] text-bone transition-colors hover:text-sodium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sodium sm:hidden"
        >
          {/* Two bars that cross into an X, so the control reads as a state
              rather than as two different icons swapping places. */}
          <span className="relative block h-4 w-6" aria-hidden="true">
            <span
              className={`absolute left-0 block h-px w-6 bg-current transition-transform [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-settle)] ${
                open ? "top-1/2 rotate-45" : "top-1"
              }`}
            />
            <span
              className={`absolute left-0 block h-px w-6 bg-current transition-transform [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-settle)] ${
                open ? "top-1/2 -rotate-45" : "top-[11px]"
              }`}
            />
          </span>
        </button>
      </nav>

      <div
        id={panelId}
        hidden={!open}
        className="border-t border-edge bg-bitumen sm:hidden"
      >
        <ul className="mx-auto max-w-6xl px-6 py-2">
          {onHome &&
            items.map((i) => (
              <li key={i.id} className="border-b border-edge/60">
                <a
                  href={`#${i.id}`}
                  onClick={(e) => { close(); if (scrollToAnchor(i.id)) e.preventDefault(); }}
                  className={`mono flex min-h-[3.25rem] items-center text-sm uppercase tracking-[0.18em] transition-colors ${
                    active === i.id ? "text-sodium" : "text-clay hover:text-bone"
                  }`}
                >
                  {i.label}
                </a>
              </li>
            ))}
          {ROUTES.map((r) => (
            <li key={r.to} className="border-b border-edge/60 last:border-0">
              <Link
                to={r.to}
                onClick={close}
                aria-current={pathname.startsWith(r.to) ? "page" : undefined}
                className={`mono flex min-h-[3.25rem] items-center text-sm uppercase tracking-[0.18em] transition-colors ${
                  pathname.startsWith(r.to) ? "text-sodium" : "text-bone hover:text-sodium"
                }`}
              >
                {r.label}
              </Link>
            </li>
          ))}
          {!onHome && (
            <li className="border-b border-edge/60 last:border-0">
              <Link
                to="/"
                onClick={close}
                className="mono flex min-h-[3.25rem] items-center text-sm uppercase tracking-[0.18em] text-clay transition-colors hover:text-sodium"
              >
                Home
              </Link>
            </li>
          )}
        </ul>
      </div>
    </header>
  );
}
