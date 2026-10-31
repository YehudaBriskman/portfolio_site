import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "@/components/motion/Rise.module.css";

/**
 * The same reveal, for a group that is already on screen when the page loads.
 *
 * The title plate is the first thing in the document, so there is nothing to
 * observe: it is in view before an observer could be constructed. Handing the
 * caller the two class names lets it animate on load without this component,
 * which keeps the first screen free of any JavaScript at all — an
 * IntersectionObserver is cheap, but the hero's budget is zero and this is a
 * class attribute.
 *
 * It is the same stylesheet, so the plate and the wall text arrive with
 * identical numbers. Two hand-written copies of 14px and 620ms would have
 * drifted the first time one of them was touched.
 */
export const riseOnLoad = `${styles.group} ${styles.shown}`;

export type RiseProps = {
  /**
   * The group. Each *direct* child is one step of the stagger, in document
   * order, so the caller decides the grain by deciding what a child is — a
   * heading and its paragraph wrapped together arrive as one thing, and that
   * is almost always what is wanted.
   */
  children: ReactNode;
  className?: string;
};

/*
 * A group of things that rise into place once, when the reader reaches them.
 *
 * What this is not
 * ----------------
 * `Reveal` used to wrap every section on the home page and was deleted for
 * three reasons, all of which this component has to answer to rather than
 * repeat — the full account is in the header of `pages/Index.tsx`.
 *
 * It translated horizontally. Two of its call sites pushed a full-width
 * section 26px past the right edge of the document until they fired, so the
 * page reported horizontal overflow for as long as the reader had not scrolled
 * that far, with `overflow-x: clip` on the body hiding the scrollbar and not
 * the bug. Nothing here moves sideways: the keyframe is `translateY` and only
 * `translateY`, and 14px of vertical travel on an element that is already
 * inside the viewport cannot reach the edge of anything.
 *
 * It was the wrong grain. Animating five hundred pixels of heading, copy and
 * three cards as one opaque block is a statement about the browser rather than
 * about the content. This stays at the grain of the thing being read — one
 * principle at a time, in the order they are read in.
 *
 * It was on every section. This is on one: the quiet beat before the peak, and
 * the one place on the page where a reveal is the entire device. A reveal used
 * at every boundary is not an emphasis, it is a template.
 *
 * Why an observer at all, when the rest of the page uses view timelines
 * ---------------------------------------------------------------------
 * A view timeline ties progress to scroll position, which means scrolling back
 * up runs it backwards. That is exactly right for ink arriving on a card, and
 * exactly wrong here: content that re-hides itself when the reader looks away
 * is a defect dressed as an effect. This has to fire once and stay fired, and
 * "once" is not something a scroll timeline can express.
 *
 * The margin is the other half of it. `-12%` on the bottom edge means the
 * group has to be properly inside the viewport before anything happens, rather
 * than firing the moment its first pixel clears the fold — which is the
 * difference between a reveal the reader watches and one that has already
 * finished somewhere below their eyeline.
 *
 * The numbers this is built from — 14px, 620ms, 60ms, 12% — are the measured
 * reveal in `docs/motion-contract.md`, along with the device ledger that says
 * which beats are allowed to be one.
 */
export default function Rise({ children, className = "" }: RiseProps) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * Starts hidden, and the stylesheet is what hides it.
   *
   * The alternative — render visible, then hide in an effect — flashes the
   * finished state on every mount. The cost of this direction is that the
   * content depends on JavaScript to appear, which on a client-rendered SPA is
   * a condition the page has already failed by the time it matters: if React
   * did not run, there is no page to reveal.
   */
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /* jsdom has no observer unless a test installs one, and neither does a
       browser old enough to matter here. Either way the answer is the finished
       page, not a blank one. */
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    /*
     * And a seatbelt for the observer that exists but never speaks.
     *
     * The guard above covers an engine with no IntersectionObserver. It does
     * not cover one that constructs fine and then never invokes the callback
     * — a bug in a polyfill, an extension, a container that confuses the
     * intersection root. An audit measured that case and found the whole of
     * the wall text and the whole contact form sitting at `opacity: 0` while
     * they were on screen, because the hidden state is a CSS floor this
     * component is the only thing that lifts.
     *
     * SpecPlate avoids the same class of bug structurally, by making the
     * resting CSS value the true one. Rise cannot: a reveal has to start
     * hidden or there is nothing to reveal. So it gets a deadline instead.
     * Two seconds is far longer than any real observer takes and far shorter
     * than a reader will stare at a blank section; the worst case is content
     * arriving without its rise, which is the right way to fail.
     */
    const seatbelt = window.setTimeout(() => setShown(true), 2000);

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        window.clearTimeout(seatbelt);
        setShown(true);
        /* Disconnected here rather than on unmount alone: this is the whole of
           "fires once". A reader who scrolls back up has to find the page as
           they left it, and an observer still watching is one state change
           away from taking that away from them. */
        io.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" }
    );

    io.observe(el);
    return () => {
      window.clearTimeout(seatbelt);
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`${styles.group} ${shown ? styles.shown : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
