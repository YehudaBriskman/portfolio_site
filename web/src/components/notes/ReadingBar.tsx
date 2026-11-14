import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ListTree, Minus, Plus, Type } from "lucide-react";
import ShareMenu from "@/components/share/ShareMenu";
import type { ShareEntity } from "@/lib/share";
import { useReaderWords } from "@/components/notes/reader/words";
import { SCALES, type ReadingPrefs } from "@/components/notes/reader/readingPrefs";
import { nextTucked } from "@/components/notes/readerBar";
import "@/components/phone/tokens.css";
import styles from "@/components/notes/reader/Reader.module.css";

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
 * The rail used to track --pr, a document-wide figure derived from the whole
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
  entity,
  target,
  contentsLabel,
  onContents,
  prefs,
  setPrefs,
}: {
  /** The reading preferences the bar's text-size control changes (the same store the sheet uses). */
  prefs?: ReadingPrefs;
  setPrefs?: (p: Partial<ReadingPrefs>) => void;
  /** What the bar's share control shares. */
  entity: ShareEntity;
  /** The phone's sheet of contents and details (#249), opened from the bar. */
  contentsLabel?: string;
  onContents?: (opener: HTMLElement) => void;
  /** The reading matter: title through to the last paragraph, nothing after. */
  target: RefObject<HTMLElement | null>;
}) {
  const [w] = useReaderWords();
  /* Down tucks the bar away, up brings it back; the top of the note and any
     focus inside it show it (phones; the bar is not drawn from 640px up). */
  const [tucked, setTucked] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const sizeId = useId();
  /*
   * Focus inside the bar shows it, whatever the scroll position (WCAG 2.4.11,
   * found by the #99 audit). It hides itself in the first 240px of a post by
   * sliding below the screen — but its two controls are still in the tab
   * order there, so a keyboard reader on a phone tabbed onto "Notes" and
   * "Share" and saw no focus at all: the focused control was off the bottom
   * edge. Taking them out of the order while hidden would also work, and
   * would make the second tab stop on the page depend on how far it has been
   * scrolled.
   */
  const [focused, setFocused] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = -1;
    let lastY = window.scrollY;

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
      const y = window.scrollY;
      const from = lastY;
      lastY = y;
      /* `from` is captured: the updater runs later, when `lastY` has moved on. */
      setTucked((t) => nextTucked(t, y, from));
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

    /*
     * The bar is fixed over the foot of the screen, so the browser's own
     * scroll-into-view on Tab would happily park a focused link underneath
     * it (WCAG 2.4.11). The top bar answers the same problem with
     * `scroll-padding-top` in Nav.module.css; this is the bottom half, and
     * it is only set while a post is mounted. Harmless above `sm`, where the
     * bar is not drawn and there is nothing for the padding to clear but a
     * few lines of slack.
     */
    const root = document.documentElement;
    root.style.scrollPaddingBottom = "calc(6rem + env(safe-area-inset-bottom))";
    /* The footer takes the bar's room on a phone (CSS reads this flag). */
    root.setAttribute("data-has-reader-bar", "");

    return () => {
      root.style.scrollPaddingBottom = "";
      root.removeAttribute("data-has-reader-bar");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target]);

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

      {/* Phones: one floating bar with the three reading controls, opaque
          (no blur), above the home indicator. Contents opens the sheet, Text
          size opens a small stepper above the bar (the sheet's own control),
          Share is the page's share menu. It tucks on the way down and returns
          on the way up; focus inside it, or the stepper open, keeps it shown. */}
      <div
        className={styles.bar}
        data-phone="reader-bar"
        data-tucked={tucked && !focused && !sizeOpen ? "" : undefined}
        onFocus={(e) => {
          /* A keyboard focus holds the bar open (WCAG 2.4.11); a tap does not
             (`data-input` is the site's modality tracker, R21). */
          if (document.documentElement.getAttribute("data-input") === "keyboard") setFocused(true);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
      >
        {sizeOpen && prefs && setPrefs && (
          <div id={sizeId} className={styles.sizePanel} role="group" aria-label={w.textSize}>
            <span className={styles.toolLabel} aria-hidden="true">
              {w.textSize}
            </span>
            <span className={styles.stepper}>
              <button
                type="button"
                className={styles.toolBtn}
                aria-label={w.smaller}
                title={w.smaller}
                disabled={SCALES.indexOf(prefs.scale as (typeof SCALES)[number]) <= 0}
                onClick={() => setPrefs({ scale: SCALES[Math.max(0, SCALES.indexOf(prefs.scale as (typeof SCALES)[number]) - 1)] })}
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <output className={styles.toolValue} aria-live="polite" aria-label={w.sizeNow(`${Math.round(prefs.scale * 100)}%`)}>
                {`${Math.round(prefs.scale * 100)}%`}
              </output>
              <button
                type="button"
                className={styles.toolBtn}
                aria-label={w.larger}
                title={w.larger}
                disabled={SCALES.indexOf(prefs.scale as (typeof SCALES)[number]) >= SCALES.length - 1}
                onClick={() =>
                  setPrefs({ scale: SCALES[Math.min(SCALES.length - 1, SCALES.indexOf(prefs.scale as (typeof SCALES)[number]) + 1)] })
                }
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </span>
          </div>
        )}
        <div className={styles.barPill}>
          <div
            ref={fillRef}
            aria-hidden="true"
            className={styles.barFill}
            style={{ transform: "scaleX(0)" }}
          />
          {onContents && (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={(e) => onContents(e.currentTarget)}
              className={styles.barBtn}
              data-phone="reader-contents"
            >
              <ListTree aria-hidden="true" />
              <span>{contentsLabel ?? w.contents}</span>
            </button>
          )}
          {prefs && setPrefs && (
            <button
              type="button"
              className={styles.barBtn}
              data-phone="reader-size"
              aria-expanded={sizeOpen}
              aria-controls={sizeOpen ? sizeId : undefined}
              onClick={() => setSizeOpen((o) => !o)}
            >
              <Type aria-hidden="true" />
              <span>{w.textSize}</span>
            </button>
          )}
          <ShareMenu kind="post" entity={entity} variant="text" className={styles.barBtn} />
        </div>
      </div>
    </>
  );
}
