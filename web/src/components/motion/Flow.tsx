import { useLayoutEffect, useRef, type ReactNode } from "react";

export type FlowProps = {
  /**
   * The items. Each *direct* child is one item, in document order, and the
   * caller's stylesheet decides what arriving means for each of them — this
   * component only ever says *when*.
   */
  children: ReactNode;
  className?: string;
};

/*
 * The `flow` device: each item arrives as the reader reaches it, and the
 * stylesheet says how.
 *
 * What it is, against the one it sits next to
 * ------------------------------------------
 * `Rise` is the `reveal` device — one group, one trigger, one cumulative
 * stagger, and the whole block arrives together. The ledger in
 * `docs/motion-contract.md` spends `reveal` on the two bookends (the title
 * plate and the inquiry plate) and names this beat `flow`, and until now the
 * wall text used `Rise` anyway: the same family twice, in adjacent beats, with
 * the ledger describing a build that did not exist. This is the beat getting
 * its own device rather than borrowing the bookends'.
 *
 * The difference is not decoration. `reveal` fires once for a whole group, so
 * everything in it shares one clock and one gesture; `flow` observes every
 * item separately, so an item arrives when *it* is 12% inside the viewport and
 * carries whatever treatment its own meaning asks for. That is the entire
 * reason this file exists: three claims that are about three different things
 * can then be *about* those things on the way in, which one group animation
 * cannot express.
 *
 * Why there is no stylesheet beside this file
 * -------------------------------------------
 * There is nothing visual here at all. The component writes one attribute per
 * item — `data-flow="wait"` when it is armed, `data-flow="in"` when it has
 * crossed — and the caller's own module owns every keyframe. That is on
 * purpose: the per-item treatments are an argument about the *prose*, and the
 * reasoning for them belongs next to the prose rather than in a shared
 * component that would have to carry one section's meaning for everybody. The
 * attribute is the starting gun and nothing else, which is also how
 * `SpecPlate` drives its count.
 *
 * Why an observer rather than a view timeline
 * ------------------------------------------
 * The same reason `Rise` has one, and it is §5 of the contract: a view
 * timeline ties progress to scroll position, so scrolling back up runs it
 * backwards, and body copy that re-hides itself when the reader looks away is
 * a defect dressed as an effect. "Once" is not something a scroll timeline can
 * express. The contract's gate pattern — a one-step scroll animation flipping
 * a property a time-driven animation reads — does not help either: the gate
 * flips back on the way up, which replays the arrival, which is the same bug
 * with more machinery.
 *
 * One observer for every item, not one per item, and it stops watching each
 * target in the callback that released it. When the last one has gone the
 * observer has nothing left to watch and costs nothing per frame, which is the
 * budget §7 sets for this tree.
 */
export default function Flow({ children, className = "" }: FlowProps) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * A layout effect, and that is the whole of why nothing flashes.
   *
   * The resting state of every item is the *finished* state — see the note on
   * the floor in `Approach.module.css` — so an item that is never armed is
   * simply readable prose. The cost of that direction is that the hidden state
   * has to be switched on by JavaScript, and in a plain `useEffect` that
   * happens after the first paint: one frame of finished text, then the
   * arrival starting from nothing. `useLayoutEffect` runs before the browser
   * paints, so the armed state is the first thing drawn and the frame never
   * exists.
   *
   * It is the right direction even so. `Rise` holds its children at
   * `opacity: 0` from a stylesheet floor and needs a two-second deadline to
   * survive an observer that never speaks, because the floor is a thing only
   * JavaScript can lift. Here the floor is a thing only JavaScript can *put
   * down*, so every way this component can fail — no React, no observer, a
   * silent observer, an exception before the effect runs — lands on the same
   * place: the section, readable, with no motion in it.
   */
  useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;

    /*
     * jsdom has no observer unless a test installs one, and neither does an
     * engine old enough to matter. Nothing is armed in that case, which means
     * nothing is hidden and nothing needs to be un-hidden later.
     */
    if (typeof IntersectionObserver !== "function") return;

    const items = Array.from(group.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement
    );
    if (items.length === 0) return;

    for (const item of items) item.dataset.flow = "wait";

    /*
     * The seatbelt, and it is a different shape from the one in `Rise`.
     *
     * A plain deadline cannot work here. `Rise` can say "show everything after
     * two seconds" because its group has a single trigger; this gate holds
     * items the reader has not scrolled to yet, and a deadline would un-arm
     * the third principle while it is still three screens below the fold —
     * taking the arrival away from the one reader who was going to see it.
     *
     * What the deadline actually guards is an observer that constructs and
     * then says nothing about a target it was given: a broken polyfill, an
     * extension, a container that confuses the intersection root. A working
     * observer reports on *every* target shortly after `observe()`, whether it
     * intersects or not — so "has this item been mentioned at all" is the
     * question that separates a broken observation from a patient one, and it
     * answers it per item rather than for the group. An observer that reports
     * four items and loses the fifth leaves four arrivals intact and un-arms
     * the one that was dropped.
     *
     * Nothing already reported is touched, which matters in the other
     * direction too: removing the attribute from an item mid-flight would
     * cancel its animation and snap a half-arrived paragraph to arrived, and
     * §4 is about not doing the reverse of that by accident.
     */
    const unheard = new Set<Element>(items);
    const seatbelt = window.setTimeout(() => {
      for (const item of unheard) {
        io.unobserve(item);
        item.removeAttribute("data-flow");
      }
      unheard.clear();
    }, 2000);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          unheard.delete(entry.target);
          if (!entry.isIntersecting) continue;
          if (entry.target instanceof HTMLElement) {
            entry.target.dataset.flow = "in";
          }
          /* Released, and never watched again. This is the whole of "once":
             an item still being observed is one state change away from
             arriving a second time, and the second arrival of a paragraph the
             reader has already read is the bug the retired `Reveal` shipped. */
          io.unobserve(entry.target);
        }
      },
      /* Not `0px`. 12% inside the viewport is the measured trigger in §5: at
         the fold the arrival has already finished somewhere below the
         reader's eyeline, which is the same as not having one. */
      { rootMargin: "0px 0px -12% 0px" }
    );

    for (const item of items) io.observe(item);

    return () => {
      window.clearTimeout(seatbelt);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
