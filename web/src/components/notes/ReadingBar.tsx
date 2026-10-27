import { useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

/*
 * Where you are, and the two things you might want next.
 *
 * A long post is the one page on this site where the reader cannot see how much
 * is left, and — on a phone, three thousand pixels down — has no way back that
 * is not the browser's own chrome. Both are fixed here rather than by adding
 * another header.
 *
 * Why this measures for itself
 * ----------------------------
 * The rail used to track --pr, which useScrollProgress derives from the whole
 * document: scrollY over scrollHeight minus a viewport. A post is not the
 * document. After the last paragraph come the tags, the link list, the
 * prev/next pair and the entire site footer — between 1200 and 1800px of
 * matter nobody is reading — so the rail read about 70% at the moment the
 * article actually ended, and the last line of a post sat under a bar claiming
 * there was a third of it left.
 *
 * So it measures the reading matter itself, start to finish. --pr keeps its
 * old meaning for every other consumer, and nothing in the shared scroll hook
 * had to learn about articles. The cost is one more scroll listener on one
 * route, and it never renders: the fraction is written straight onto the two
 * elements that draw it, because a progress readout that re-rendered React
 * sixty times a second would be a worse trade than the listener.
 *
 * It carries no transition on purpose — easing a position readout makes it lie
 * about where you are. And unlike the shared hook it keeps working under
 * reduced motion, because this is a readout rather than an animation.
 */
export default function ReadingBar({
  title,
  target,
}: {
  title: string;
  /** The reading matter: title through to the last paragraph, nothing after. */
  target: RefObject<HTMLElement | null>;
}) {
  const [shown, setShown] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = -1;

    const measure = () => {
      raf = 0;
      const el = target.current;
      if (!el) return;

      const vh = Math.max(1, window.innerHeight);
      const box = el.getBoundingClientRect();
      /*
       * Progress is zero while the top of the article is still at or below the
       * top of the screen, and one when its last line clears the bottom of the
       * screen. An article shorter than the viewport has no travel at all, so
       * the denominator is floored rather than allowed to go negative and
       * invert the bar.
       */
      const travel = Math.max(1, box.height - vh);
      const value = Math.min(1, Math.max(0, -box.top / travel));

      // Three decimals is below one pixel on any rail this site can draw, and
      // most frames of a slow scroll produce the same number.
      const rounded = Math.round(value * 1000) / 1000;
      if (rounded === last) return;
      last = rounded;
      const transform = `scaleX(${rounded})`;
      /* Written as the --pr-read channel rather than as a transform, so the
         rail keeps taking its shape from .progress-rail and this component
         only supplies the number. An inline transform would have to restate
         the whole rule to change one value in it. */
      if (railRef.current) railRef.current.style.setProperty("--pr-read", String(rounded));
      if (fillRef.current) fillRef.current.style.transform = transform;
    };

    const onScroll = () => {
      setShown(window.scrollY > 240);
      if (!raf) raf = requestAnimationFrame(measure);
    };

    const onResize = () => {
      last = -1;
      onScroll();
    };

    // Measured before the first paint rather than a frame after it, so the
    // rail never starts at zero on a page restored mid-article.
    measure();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    /*
     * The cover and every in-body image are lazy, so the article grows after
     * first paint and a bar measured once would be wrong for the rest of the
     * session. Observing the element costs nothing while it is still.
     */
    const observer =
      typeof ResizeObserver === "function" && target.current
        ? new ResizeObserver(onResize)
        : null;
    if (observer && target.current) observer.observe(target.current);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target]);

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      // A share sheet the reader dismissed rejects exactly like a failure, and
      // reporting a cancellation as an error is worse than saying nothing.
    }
  }

  return (
    <>
      {/* Desktop: a hairline under the nav travelling the width of the page as
          you read it, in bone, like `.progress-rail` it takes its shape from.
          It sets --pr-read, the article-only channel, rather than inheriting
          --pr — the document-wide figure this component exists to stop
          trusting. */}
      <div
        ref={railRef}
        className="progress-rail hidden sm:block"
        style={{ "--pr-read": 0 } as React.CSSProperties}
        aria-hidden="true"
      />

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-bitumen/95 pb-[env(safe-area-inset-bottom)] sm:hidden"
        style={{
          transform: shown ? "none" : "translateY(100%)",
          transition: "transform var(--dur-fast) var(--ease-settle)",
        }}
      >
        <div
          ref={fillRef}
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[2px] origin-left bg-bone"
          style={{ transform: "scaleX(0)" }}
        />
        <div className="flex items-center justify-between px-5">
          <Link to="/blog" className="tap inline-flex min-h-[44px] items-center gap-2 py-3.5 text-[0.9375rem] text-bone">
            <span aria-hidden="true">&larr;</span> Notes
          </Link>
          <button type="button" onClick={share} className="tap inline-flex min-h-[44px] items-center gap-2 py-3.5 text-[0.9375rem] text-clay">
            Share <span aria-hidden="true">&#8599;</span>
          </button>
        </div>
      </div>
    </>
  );
}
