import { useCallback, useRef, type CSSProperties, type KeyboardEvent } from "react";
import Action from "@/components/ui/Action";
import CarouselCard, { type CardHeading } from "@/components/carousel/CarouselCard";
import { cardCycle } from "@/components/cards/cardType";
import type { ProjectEntry } from "@/hooks/useProjects";
import styles from "@/components/carousel/ProjectCarousel.module.css";

/*
 * A shelf of projects, seen at an angle.
 *
 * The semantics, and why they are not a tablist
 * ---------------------------------------------
 * The obvious reading of "carousel" is the ARIA tabbed pattern: a tablist of
 * dots, one visible panel, the rest hidden. That pattern is right when the
 * slides genuinely are alternatives and only one can exist at a time, and it
 * is wrong here for a concrete reason — it would require hiding five of six
 * projects. A reader using a screen reader would be handed one project and a
 * set of controls for revealing the others, in exchange for a perspective
 * effect they will never see. That is paying for the visual with somebody
 * else's content.
 *
 * So this is what it actually is: a list of six projects that happens to be
 * presented in a window narrower than the list. The markup says exactly
 * that — a `<ul>` of six `<li>`, announced as "list, 6 items", every card
 * present, laid out and in the tab order at all times, in document order.
 * The tilt is a presentation layer over a list, which is also why all three
 * of its switch-offs can land on "a flat row" without losing anything.
 *
 * The scroll container around the list carries
 * `role="group" aria-roledescription="carousel"` and a name, because the one
 * thing the list semantics do not convey is that this box is a viewport with
 * more in it than you can see — and `tabindex="0"`, which is the part that
 * matters most. A focusable scroller is how arrow keys, Home/End and
 * Page Up/Down come to work, and it is what `scrollable-region-focusable`
 * exists to check for. Chrome has lately started focusing scrollers on its
 * own; saying so explicitly makes the behaviour the same everywhere.
 *
 * How advancing works
 * -------------------
 * Four ways in, and three of them are the browser's:
 *
 *   Swipe and drag — the native ones, on a real scroll container, with real
 *   momentum and real rubber-banding. No pointer handler is installed on
 *   purpose: a synthetic drag over a box full of links has to guess when a
 *   press was a drag and when it was a click, and it has to suspend
 *   `scroll-snap` while it runs. Both of those are ways to break a working
 *   scroller in order to reimplement it.
 *
 *   Keyboard — left and right on the focused scroller, Home/End and
 *   Page Up/Down left to the browser, and Tab, which walks the six
 *   "The detail" links and makes the browser scroll each one into view as
 *   it goes. Tabbing through the carousel advances the carousel.
 *
 *   The two buttons below, which are the only JavaScript in the component.
 *
 * Nothing here listens to scroll, holds an index in state, or re-renders as
 * the reader moves. The active card is decided by `scroll-snap-align: center`
 * and drawn by a `view(x)` timeline; the position indicator is driven by a
 * named scroll timeline. See ProjectCarousel.module.css for both.
 */

export type ProjectCarouselProps = {
  entries: ProjectEntry[];
  /**
   * The accessible name of the carousel region. Required rather than
   * defaulted: two carousels on one site that both announce themselves as
   * "Projects" is the failure this prop exists to prevent.
   */
  label: string;
  /**
   * What level each card's title is set at. See `CardHeading`: it depends on
   * what heading the page put above the shelf, which only the page knows.
   */
  heading: CardHeading;
  /**
   * The plate number of the first card. Figure numbering runs across a whole
   * page rather than across a component, so the page owns it.
   */
  firstPlate: number;
  /** The first card is above the fold on `/projects`, where it is the LCP. */
  eagerFirst?: boolean;
};

export default function ProjectCarousel({
  entries,
  label,
  heading,
  firstPlate,
  eagerFirst = false,
}: ProjectCarouselProps) {
  const viewport = useRef<HTMLDivElement>(null);

  /*
   * One click, one read of the layout, one call into the browser.
   *
   * Finding the nearest card by measurement rather than tracking an index
   * is what keeps this honest when the reader has already moved the shelf
   * themselves — by thumb, by wheel, by Tab, or by stopping half way
   * between two cards. There is no index that could have been kept in sync
   * with any of those without listening to scroll.
   *
   * `offsetLeft` and `offsetWidth`, and not `getBoundingClientRect`,
   * because the cards are rotated in 3D and a client rect describes the
   * *projected* box. Offsets are untransformed layout, which is the same
   * geometry `scroll-snap` is working in — and that is the whole reason the
   * tilt can be decorative.
   *
   * `scrollIntoView({ inline: "center" })` was the obvious call here and is
   * the wrong one for exactly that reason: it centres the projected box, so
   * every advance landed 30-80px short of a snap point and the carousel
   * drifted further out of true with each press. Computing the scroll
   * offset from the layout lands on the snap point itself.
   *
   * No `behavior` is passed, so the scroller's own computed
   * `scroll-behavior` decides whether the move is animated — which lets
   * `prefers-reduced-motion` and `body.motion-paused` turn it off in the
   * stylesheet, next to everything else they turn off.
   */
  const step = useCallback((delta: -1 | 1) => {
    const box = viewport.current;
    if (!box) return;

    const slides = Array.from(box.querySelectorAll<HTMLElement>("[data-slide]"));
    if (slides.length === 0) return;

    const centre = (slide: HTMLElement) => slide.offsetLeft + slide.offsetWidth / 2;
    const here = box.scrollLeft + box.clientWidth / 2;

    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    slides.forEach((slide, i) => {
      const distance = Math.abs(centre(slide) - here);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });

    const target = slides[Math.min(slides.length - 1, Math.max(0, nearest + delta))];
    /* jsdom implements neither layout nor scrolling, so the guard is what
       lets the buttons be exercised in a test at all. In a browser it is
       always present. */
    if (typeof box.scrollTo === "function") {
      box.scrollTo({ left: centre(target) - box.clientWidth / 2 });
    }
  }, []);

  /*
   * One press, one card — the only thing the browser gets wrong here.
   *
   * An arrow key on a scroll container scrolls it by a fixed 40px, and a
   * mandatory snap container then pulls that back to the nearest snap point.
   * Measured at the desktop measure the two disagree: five presses of
   * ArrowRight moved the shelf 0 → 324 → 353 → 356 → 653 → 701, so a reader
   * got a card, then two presses that went almost nowhere, then another
   * card. The behaviour is defensible as scrolling and indefensible as
   * operating a carousel, where the arrows are the obvious control and the
   * two buttons beside them already move exactly one card.
   *
   * Everything else is left alone deliberately. Home, End, Page Up and Page
   * Down are the scroll container's own and work correctly, and the guard
   * below means a key pressed while one of the card links has focus is
   * still the browser's to interpret — this only fires when the scroller
   * itself is the focused element.
   */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      step(event.key === "ArrowRight" ? 1 : -1);
    },
    [step]
  );

  if (entries.length === 0) return null;

  return (
    /* --car-count is the one thing in the stylesheet that has to know how
       many cards there are: it sizes the position indicator's thumb and says
       how far it travels. A number, not a length, so the keyframe can do
       arithmetic with it. */
    <div className={styles.frame} style={{ "--car-count": entries.length } as CSSProperties}>
      <div
        ref={viewport}
        className={styles.viewport}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
      >
        <ul className={styles.track}>
          {entries.map((entry, i) => (
            /*
              `cardCycle` goes on the slot and not on the card, because the
              hue is decided by position among siblings and the slot is the
              sibling. The card inside inherits --card-wash from it. Same
              rule, same five colours and same order as every other group of
              cards on the site; see cardType.ts.
            */
            <li
              key={entry.collection.slug}
              data-slide
              className={`${styles.slot} ${cardCycle}`}
            >
              {/* The tilt is one element in from the snap target on purpose;
                  see the note on `.slot` in the stylesheet. */}
              <div className={styles.tilt}>
                <CarouselCard
                  entry={entry}
                  heading={heading}
                  plate={firstPlate + i}
                  eager={eagerFirst && i === 0}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/*
        One card is not a shelf. With a single entry there is nothing to
        advance to and nothing for the indicator to indicate, and a disabled
        pair of arrows under it would be a control that exists only to say
        it does not work.
      */}
      {entries.length > 1 && (
        <div className={styles.controls}>
          <Action
            tone="outline"
            glyph="back"
            className={styles.arrow}
            onClick={() => step(-1)}
            /* The accessible name has to begin with the visible one, or a
               reader using speech says a label the browser cannot match —
               WCAG 2.5.3, and the reason the button is not called "Prev". */
            aria-label={`Previous project in ${label}`}
          >
            Previous
          </Action>

          {/*
            The indicator is decorative in the accessibility tree and that is
            deliberate: it reports a scroll position, which is exactly what a
            scrollbar reports, and no screen reader needs to be told where a
            list it can read in full is currently scrolled to. Announcing it
            would be narrating the furniture.
          */}
          <div className={styles.progress} aria-hidden="true">
            <span className={styles.thumb} />
          </div>

          <Action
            tone="outline"
            glyph="onward"
            className={styles.arrow}
            onClick={() => step(1)}
            aria-label={`Next project in ${label}`}
          >
            Next
          </Action>
        </div>
      )}
    </div>
  );
}
