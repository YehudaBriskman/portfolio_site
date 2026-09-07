import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const items = [
  { id: "work", label: "Work" },
  { id: "approach", label: "Approach" },
  { id: "stack", label: "Stack" },
  { id: "contact", label: "Contact" },
];

const ROUTES = [
  { to: "/projects", label: "Projects" },
  { to: "/blog", label: "Blog" },
];

export default function Nav() {
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const [active, setActive] = useState("hero");
  const [solid, setSolid] = useState(false);

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
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid ? "border-b border-edge bg-bitumen/85 backdrop-blur-md" : ""
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href={onHome ? "#hero" : "/"} className="mono text-xs uppercase tracking-[0.22em] text-bone">
          Y.B<span className="text-sodium">.</span>
        </a>
        <ul className="flex gap-6 sm:gap-8">
          {ROUTES.map((r) => (
            <li key={r.to}>
              <a href={r.to} className="mono text-[0.6875rem] uppercase tracking-[0.18em] text-clay transition-colors hover:text-bone">
                {r.label}
              </a>
            </li>
          ))}
          {items.map((i) => (
            <li key={i.id}>
              <a
                href={onHome ? `#${i.id}` : `/#${i.id}`}
                className={`mono text-[0.6875rem] uppercase tracking-[0.18em] transition-colors ${
                  active === i.id ? "text-sodium" : "text-clay hover:text-bone"
                }`}
              >
                {i.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
