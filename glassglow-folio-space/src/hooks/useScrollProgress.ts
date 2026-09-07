import { useEffect } from "react";

/*
 * Publishes two numbers on <html> and nothing else:
 *   --p  0..1 progress through the whole document
 *   --vh 0..n viewports scrolled
 * Every scroll-linked effect on the site reads these, so there is exactly one
 * scroll listener no matter how many things animate. Deliberately not a React
 * state value: this changes every frame and must never trigger a re-render.
 */
export function useScrollProgress() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      const y = window.scrollY;
      root.style.setProperty("--p", (y / max).toFixed(4));
      root.style.setProperty("--vh", (y / Math.max(1, window.innerHeight)).toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
