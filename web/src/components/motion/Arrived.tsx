import { useEffect, useRef, useState, type ReactNode } from "react";

export type ArrivedProps = {
  /** Whatever wants to know it has been reached. Nothing here is hidden, moved
   *  or clipped — see the note below on why that is the whole design. */
  children: ReactNode;
  className?: string;
  /**
   * The observer's root margin, because 12% is not a universal number.
   *
   * `Rise`'s `-12%` is measured for a *reveal*: the group has to be properly
   * inside the viewport before it starts arriving, or the arrival finishes
   * below the reader's eyeline. A gate on a tall subject has the opposite
   * problem — a four-hundred-pixel form whose top edge is 12% inside the
   * viewport is almost entirely below the fold, so an effect keyed off that
   * moment plays where nobody is looking. The default matches `Rise` so the
   * two agree when the subject is short; a tall subject passes its own.
   */
  rootMargin?: string;
};

/*
 * A gate, not a gesture: "this has been reached, once", as an attribute.
 *
 * What this is for
 * ----------------
 * Some of the motion on this page is time-driven and has to stay that way. A
 * view timeline runs backwards when the reader scrolls back up, which is right
 * for ink arriving on a card and wrong for anything drawn on a *control*: the
 * rules under the contact fields are those controls' own boundaries, and a
 * boundary that un-draws itself because the reader scrolled is a worse defect
 * than no animation at all. So the clock has to be a clock.
 *
 * But a time-driven animation starts when its element is painted, which for a
 * section at the foot of the page is long before the reader gets there. This
 * supplies the missing half: an `IntersectionObserver` that fires once and
 * publishes `data-arrived="true"`, which any stylesheet can hang an
 * `animation-delay` sequence off.
 *
 * Why this is not a second copy of Rise
 * -------------------------------------
 * `Rise` owns the measured reveal — 14px, 620ms, 60ms apart — and the rule
 * about those numbers is that they exist in exactly one place. This file
 * contains none of them, and cannot: it has no stylesheet, no keyframes and no
 * opinion about what happens when it fires. What the two share is the trigger,
 * and the trigger is not the gesture. Pulling the observer out of `Rise` to
 * share it would have meant touching the one component the page's whole entry
 * motion is defined in, to save fifteen lines.
 *
 * The off-switches are not here either, for the same reason: nothing in this
 * file animates, so there is nothing in it to switch off. The three exits in
 * `docs/motion-contract.md` §4 belong to whichever stylesheet reads the
 * attribute, and the consumer's own `prefers-reduced-motion` and
 * `body.motion-paused` blocks have to land on the finished state exactly as if
 * the gate had fired.
 *
 * Why nothing is hidden
 * ---------------------
 * `Rise` starts its children at `opacity: 0` and an audit found that if its
 * observer constructs but never speaks — a polyfill bug, an extension, a
 * confused root — the content stays invisible. It carries a two-second
 * seatbelt for that case. This component sidesteps the whole class of bug: the
 * resting CSS is the true state and the attribute only ever *adds* an effect,
 * so an observer that never fires costs a flourish and nothing else. The
 * seatbelt below is therefore belt-and-braces rather than load-bearing, and it
 * is here because a flourish that never plays on a slightly odd browser is
 * still a flourish somebody wrote and nobody sees.
 */
export default function Arrived({
  children,
  className = "",
  rootMargin = "0px 0px -12% 0px",
}: ArrivedProps) {
  const ref = useRef<HTMLDivElement>(null);
  /* jsdom has no observer unless a test installs one, and neither does an
     engine old enough to matter. Either way the answer is the arrived page. */
  const [arrived, setArrived] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const seatbelt = window.setTimeout(() => setArrived(true), 2000);

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        window.clearTimeout(seatbelt);
        setArrived(true);
        /* This is the whole of "once". An observer still watching is one state
           change away from replaying a gesture the reader has already seen. */
        io.disconnect();
      },
      { rootMargin }
    );

    io.observe(el);
    return () => {
      window.clearTimeout(seatbelt);
      io.disconnect();
    };
  }, [rootMargin]);

  return (
    <div
      ref={ref}
      className={className}
      /* Absent rather than `"false"` while it waits, so a stylesheet reads it
         as one condition — `[data-arrived]` — instead of having to spell out
         which of two string values means yes. */
      data-arrived={arrived ? "true" : undefined}
    >
      {children}
    </div>
  );
}
