import { useEffect, useState } from "react";
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
 * The progress readout is free: useScrollProgress already publishes --pr from
 * the single scroll listener the whole site shares, so this adds no measuring of
 * its own. It carries no transition on purpose — easing a position readout makes
 * it lie about where you are.
 */
export default function ReadingBar({ title }: { title: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Sets the same boolean on most frames; React bails out of an identical
    // value, so this is a comparison per event rather than a render per event.
    const onScroll = () => setShown(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      {/* Desktop: a hairline under the nav, its leading end the sun from the
          hero, travelling the width of the page as you read it. */}
      <div className="progress-rail hidden sm:block" aria-hidden="true" />

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-bitumen/95 pb-[env(safe-area-inset-bottom)] sm:hidden"
        style={{
          transform: shown ? "none" : "translateY(100%)",
          transition: "transform var(--dur-fast) var(--ease-settle)",
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[2px] origin-left bg-sodium"
          style={{ transform: "scaleX(var(--pr, 0))" }}
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
