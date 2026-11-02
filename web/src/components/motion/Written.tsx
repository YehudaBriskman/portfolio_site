import {
  Children,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import styles from "@/components/motion/Written.module.css";
import { penRange } from "@/components/motion/penClock";

/*
 * `pen` — prose that is written as it is read.
 *
 * Wrap any block of reading text in this and nothing else: a paragraph, a
 * list item, a definition, a markdown body's paragraphs. Every word starts
 * muted, and as the paragraph rises through the window the pen inks it ONE
 * WORD AFTER ANOTHER, in reading order, and leaves what it wrote at full ink —
 * so a sentence is written out the way a hand writes it, and is un-written,
 * word by word in the opposite order, if the reader scrolls back up. Scroll is
 * the only clock: nothing here runs on a timer or fires once.
 *
 * The call site passes nothing per word and knows nothing about lines; that is
 * the whole of the API, and it is the requirement in #98 rather than a
 * convenience.
 *
 * THE CLOCK, AND WHY IT IS A WORD COUNT (#158)
 * --------------------------------------------
 * The first version placed each word on the paragraph's clock by geometry: its
 * line's offset from the paragraph's top (`--line`, measured) plus its place
 * along the line times one line-height (`--pen`), and lit it for the height of
 * a 14vh band. Measured in Chromium on /story, that gave:
 *
 *   - a step of `1lh / words-on-the-line` between neighbours — about 2px of
 *     scroll at 15 words to a 31px line — against a ramp of 8% of the band,
 *     about 10px. So five words were mid-ramp at once: a smear, not a pen;
 *   - a whole line written in one line-height of scroll, 31px, which is a
 *     third of one mouse-wheel notch. One notch wrote three lines at once —
 *     "a block appears all at once";
 *   - every word lit for a band's height, 126px, which is four lines — "two
 *     lines go to full ink at the same time", and it was more than two.
 *
 * The pace was tied to the text's own movement, so the pen could never be
 * slower than the scroll that carried it. Now the paragraph's clock is split
 * by word count instead: word `i` of `n` owns exactly the slice `i/n` to
 * `(i+1)/n` of it, ramps from muted to ink across that slice and nothing else,
 * and holds ink after. Two consequences, both pinned by the tests:
 *
 *   - at any scroll position at most ONE word is between muted and ink; every
 *     word before it is at ink and every word after it is muted;
 *   - the slices tile the clock with no gap and no overlap, so the pen never
 *     pauses and never writes two words at once, across line breaks too.
 *
 * The clock (`Written.module.css`) runs from the paragraph's top reaching
 * 85% of the window's height to its bottom reaching 45%, so a paragraph of
 * `h` px gets `h + 40vh` of scroll: about 15px a word for a two-line beat on
 * /story, 5–8px a word for a long post paragraph — slow enough to watch, and
 * finished before the paragraph is out of the reading zone.
 *
 * The index is known at render time, so there is no measurement any more: no
 * `ResizeObserver`, no font-load pass, no `getClientRects`. A resize, a font
 * swap or a different wrap cannot desynchronise it, because nothing about it
 * depends on where the lines break. Logical order is DOM order, which is the
 * reading order in a Hebrew paragraph, in English under `dir="rtl"` and for
 * an English word inside a Hebrew line alike.
 *
 * WHERE THE SPLIT STARTS FROM
 * ---------------------------
 * `ObjectLabel`'s `splitName` already solved the three things a split must not
 * break, and this keeps all three: the accessible text stays one string, the
 * copied text stays one string (the spaces are the original text nodes and
 * the spans add no characters), and a word never breaks across lines.
 *
 * A WORD HERE IS AN INLINE SPAN AND NEVER AN INLINE-BLOCK. The effect is
 * colour, and `color` applies to an inline box perfectly well:
 *
 *   - BIDI. An inline-block is an atomic inline, which the bidi algorithm
 *     treats as a neutral object character; a run of them in an RTL paragraph
 *     is laid out right to left (#110's ADUHEY NAMXSIRB). An inline span with
 *     `unicode-bidi: normal` is invisible to the bidi algorithm.
 *   - LINE BREAKING. An inline span is not a break opportunity. The only
 *     break opportunities in the paragraph are the spaces that were always
 *     there.
 *
 * One `view()` per paragraph, not per word: on an inline box `view()`
 * resolves to the block it is laid out in, so the paragraph names the clock
 * (`--written-clock`) and every word reads it.
 *
 * Two shared observers park paragraphs that are outside the reading zone —
 * see `watch` — and the off-switches are in the stylesheet.
 */

/** The elements prose arrives in. A heading is not one: a heading is read at a glance, not word by word. */
type WrittenTag = "p" | "li" | "dd" | "div" | "blockquote" | "figcaption";

export type WrittenProps = HTMLAttributes<HTMLElement> & {
  as?: WrittenTag;
  children?: ReactNode;
};

/*
 * Elements whose text is not prose and is left exactly as it arrived.
 *
 * Code is the important one: an identifier is read character by character, it
 * has its own ground and its own ink, and an inline `code` span that dimmed
 * and lit with the sentence round it would be the one place a reader could
 * not trust the colour of what they were copying. The rest cannot hold
 * running text at all, or hold text that is not the page's.
 *
 * Matched by tag, and by the `tagName` react-markdown hands its components as
 * `node`, so a markdown body whose `code` is a custom component is still
 * recognised as code. Anything else can opt out with `data-written="off"`.
 */
const LEAVE = new Set(["code", "pre", "kbd", "samp", "svg", "math", "script", "style", "textarea", "select"]);

/*
 * The break opportunities, and only those.
 *
 * ASCII whitespace and not `\s`: `\s` also matches U+00A0, and a no-break
 * space is exactly the character an author types to say *these two words are
 * one unit on the line*, so the pen writes "10 km" as one word.
 */
const BREAK = /([\t\n\f\r ]+)/;

type Walk = { count: number; total: number };

function splitText(text: string, walk: Walk): ReactNode[] {
  return text.split(BREAK).map((part, i) => {
    /* Odd indices are the captured whitespace: returned as the original
       string, so it is a real text node with the real character in it — the
       break opportunity the line needs and the space the clipboard needs. */
    if (i % 2 === 1 || part === "") return part;
    const k = walk.count;
    walk.count += 1;
    const [from, to] = penRange(k, walk.total);
    return (
      <span
        key={i}
        className={styles.word}
        data-word=""
        style={{ "--pen-from": from, "--pen-to": to } as CSSProperties}
      >
        {part}
      </span>
    );
  });
}

function tagOf(el: ReactElement): string | undefined {
  if (typeof el.type === "string") return el.type;
  const node = (el.props as { node?: { tagName?: unknown } }).node;
  return typeof node?.tagName === "string" ? node.tagName : undefined;
}

function split(children: ReactNode, walk: Walk): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return splitText(child, walk);
    if (typeof child === "number") return splitText(String(child), walk);
    if (!isValidElement(child)) return child;

    const props = child.props as { children?: ReactNode; "data-written"?: string };
    /* A nested `Written` splits and clocks its own text; its words are on its
       clock, not this one, and are not counted here. */
    if (child.type === Written) return child;
    if (props["data-written"] === "off") return child;
    const tag = tagOf(child);
    if (tag !== undefined && LEAVE.has(tag)) return child;
    if (props.children === undefined) return child;

    /* Same element, same props, same key — only its text is split. A link
       stays the link, with its href and its handlers, and its name stays its
       text: the spans are inside it, not around it. */
    return cloneElement(child, undefined, split(props.children, walk));
  });
}

/*
 * Two passes: the first counts the words, so the second can hand each one
 * its slice of a clock whose length it now knows. Paragraph-sized work, once
 * per render.
 */
function splitAll(children: ReactNode): ReactNode {
  const count: Walk = { count: 0, total: 1 };
  split(children, count);
  return split(children, { count: 0, total: count.count });
}

/* ------------------------------------------------------- the near-watch -- */

/* The effect only runs where scroll-driven animation does. */
function canRun(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof IntersectionObserver === "function" &&
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timeline: view()")
  );
}

/*
 * Which paragraphs are in the reading zone, and the only ones that animate.
 *
 * Measured (motion-contract §2), the cost of `pen` is the number of words
 * animating, not the number split: every animating word's colour is resolved
 * again on every frame its paragraph's clock moves, including words sitting
 * in a fill state that cannot change. So a paragraph outside the zone is told
 * where it is, and the stylesheet stops its animation:
 *
 *   - `below`: not reached yet, so every word is muted — the clock's start;
 *   - `above`: passed, so every word is at ink — the clock's end.
 *
 * Both are exactly the values the animation's own fill would hold there, so
 * crossing in or out of the zone changes nothing a reader can see. The zone
 * is the window from 40% of its height down to its foot, which contains the
 * whole clock (top at 85% to bottom at 45%) with a margin either side.
 *
 * TWO OBSERVERS, because one cannot tell `above` from `below` reliably. An
 * observer reports crossings of its own zone, and a jump — a fragment link, a
 * restored scroll position, Home/End — can carry a paragraph from below the
 * window to far above it without ever intersecting the zone, so no callback
 * comes and a paragraph that is now above keeps saying `below`, muted
 * forever. (Found in the screenshots for #158.) So the second observer's zone
 * is everything above the zone's top edge, out to a distance no page reaches:
 * passing the edge in either direction, by any means, crosses it.
 *
 * Fires on crossings, not on scroll. With no attribute at all the paragraph
 * animates, so an observer that never fires leaves the effect running rather
 * than the text stuck.
 */
let near: IntersectionObserver | null = null;
let past: IntersectionObserver | null = null;

function settle(t: HTMLElement) {
  const { penNear, penPast } = t.dataset;
  if (penNear === undefined || penPast === undefined) return;
  t.dataset.pen = penNear === "1" ? "live" : penPast === "1" ? "above" : "below";
}

function observer(key: "penNear" | "penPast", rootMargin: string): IntersectionObserver {
  return new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const t = e.target as HTMLElement;
        t.dataset[key] = e.isIntersecting ? "1" : "0";
        settle(t);
      }
    },
    { rootMargin },
  );
}

function watch(el: HTMLElement): () => void {
  if (!canRun()) return () => {};
  near ??= observer("penNear", "-40% 0px 0px 0px");
  /* From the zone's top edge (40% of the window) upwards, without end. */
  past ??= observer("penPast", "1000000px 0px -60% 0px");
  near.observe(el);
  past.observe(el);
  return () => {
    near?.unobserve(el);
    past?.unobserve(el);
  };
}

/* ------------------------------------------------------------- component -- */

export default function Written({ as = "p", className = "", children, ...rest }: WrittenProps) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    return el ? watch(el) : undefined;
  }, []);

  const Tag = as as "p";
  return (
    <Tag
      {...rest}
      ref={ref as Ref<HTMLParagraphElement>}
      className={`${styles.written} ${className}`.trimEnd()}
      data-written=""
    >
      {splitAll(children)}
    </Tag>
  );
}
