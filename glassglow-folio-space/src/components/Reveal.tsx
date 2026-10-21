import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Scroll reveal. Transform gets the house curve, opacity arrives linear —
 * the rule the reference sites all follow, and the reason their motion reads
 * settled rather than springy.
 *
 * Reveals once and then disconnects: re-animating on every pass is the thing
 * that makes a page feel restless.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 18,
  from = "below",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  /* Which way the content arrives from. Sections alternate it so the page does
     not lift every block off the same edge on the way down. */
  from?: "below" | "left" | "right";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );
    io.observe(el);
    // If it is already past the viewport on load, show it without waiting.
    if (el.getBoundingClientRect().top < window.innerHeight) setShown(true);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown
          ? "none"
          : from === "left"
            ? `translate3d(${-y}px, 0, 0)`
            : from === "right"
              ? `translate3d(${y}px, 0, 0)`
              : `translate3d(0, ${y}px, 0)`,
        transition: `opacity var(--dur-fast) linear ${delay}ms, transform var(--dur-settle) var(--ease-settle) ${delay}ms`,
        willChange: shown ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
