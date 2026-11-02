import {
  Children,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import styles from "@/components/motion/Written.module.css";

/*
 * `pen` — prose that is written as it is read.
 *
 * Wrap any block of reading text in this and nothing else: a paragraph, a
 * list item, a definition, a markdown body's paragraphs. Every word in it is
 * muted except the words crossing a band across the lower middle of the
 * viewport, which are at full ink, and the band moves through each line
 * word by word in reading order — so a sentence appears to be set at the
 * moment the reader's eye reaches it, and is un-set again if they scroll back
 * up. The call site passes nothing per word and knows nothing about lines;
 * that is the whole of the API, and it is the requirement in #98 rather than
 * a convenience. The first time a section re-implements this in its own
 * stylesheet the primitive has failed.
 *
 * Where it starts from
 * --------------------
 * `ObjectLabel`'s `splitName` already solved the three things a split must not
 * break, and this keeps all three for the same reasons: the accessible text
 * stays one string, the copied text stays one string (the spaces are the
 * original text nodes and the spans add no characters), and a word never
 * breaks across lines. It solves them differently, and the difference is the
 * reason this exists as its own component rather than as a `splitName` for
 * paragraphs.
 *
 * A WORD HERE IS AN INLINE SPAN AND NEVER AN INLINE-BLOCK. `splitName` needs
 * boxes because a `transform` does nothing to a non-replaced inline box. This
 * effect is colour, and `color` applies to an inline box perfectly well, so
 * nothing here is a box — and that one choice removes two failures at once:
 *
 *   - BIDI. An inline-block is an atomic inline, which the bidi algorithm
 *     treats as a neutral object character; a run of them in an RTL paragraph
 *     is laid out right to left. That is the bug #110 found on the hero, where
 *     `dir="rtl"` turned the name into ADUHEY NAMXSIRB, and it is fixed there
 *     with `direction: ltr` — which is right for a Latin name and would be
 *     *wrong* for a paragraph, because a paragraph may be Hebrew, or Hebrew with
 *     an English product name inside it. An inline span with `unicode-bidi:
 *     normal` is invisible to the bidi algorithm: the text resolves exactly as
 *     it would unsplit, in either direction, in either script, mixed. Tested in
 *     both, in a real browser, and the screenshots are in docs/written.
 *   - LINE BREAKING. An inline-block is a break opportunity on each side, so
 *     `splitName` has to put `white-space: nowrap` on every word to stop a
 *     name breaking mid-word. An inline span is not a break opportunity at
 *     all. The only break opportunities in the paragraph are the spaces that
 *     were always there, `text-wrap: pretty` and `balance` see the same text,
 *     and the line breaks are not "kept" so much as never touched — measured
 *     word-for-word against the unsplit paragraph, not asserted.
 *
 * Why there is any JavaScript at all
 * ----------------------------------
 * Two reasons, and the first was found rather than expected.
 *
 * A `view()` timeline on an inline box does not follow the box. Measured in
 * Chromium, every word of a three-line paragraph reported the same progress:
 * an inline subject resolves to the block it is laid out in. So the clock
 * belongs to the paragraph (`.written` names it), and each word has to be told
 * where on that clock its line is — `--line`, in px from the paragraph's top.
 *
 * And words on one line share one vertical position, so even a timeline per
 * word could only light a whole line at once — which reads as a highlighter
 * bar moving down the page, not as writing. Writing moves *along* the line,
 * so each word is also told how far along its line it is — `--pen`, 0 to just
 * under 1, in *logical* order. The stylesheet delays the word by that fraction
 * of one line of scroll, so the pen crosses one line in the scroll it takes
 * the next line to arrive and the hand-off is continuous.
 *
 * Only layout knows where lines break, so both are read once per layout — on
 * mount, when the box resizes, and when the web fonts land — and never on
 * scroll.
 *
 * Logical order, not x. In a Hebrew paragraph the pen runs right to left; in
 * an English sentence set in a right-to-left page (which is every sentence on
 * this site under the second locale — `nav/locale.ts` switches direction and
 * not strings) it runs left to right; and an English word inside a Hebrew
 * line is reached when the reader reaches it. The DOM order *is* the reading
 * order in all three cases, and x is right in only one of them.
 *
 * No scroll listener, no `requestAnimationFrame`, no React state, and one
 * `ResizeObserver` for the whole page rather than one per paragraph. Until
 * the measurement runs — or if it never does — every word sits at the top of
 * the paragraph's clock and the whole paragraph is lit while its first line
 * crosses the band: a coarser version of the effect, and never hidden text.
 *
 * What it costs is measured in the pull request and in
 * `docs/motion-contract.md` §2, and the off-switches are in the stylesheet.
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
 * one unit on the line*. Splitting at it would not change where the line
 * breaks (the span boundary is not a break opportunity either) but it would
 * make the pen treat "10 km" as two words, which is the opposite of what the
 * author asked for.
 */
const BREAK = /([\t\n\f\r ]+)/;

function splitText(text: string): ReactNode[] {
  return text.split(BREAK).map((part, i) =>
    /* Odd indices are the captured whitespace: returned as the original
       string, so it is a real text node with the real character in it — the
       break opportunity the line needs and the space the clipboard needs. */
    i % 2 === 1 || part === "" ? (
      part
    ) : (
      <span key={i} className={styles.word} data-word="">
        {part}
      </span>
    ),
  );
}

function tagOf(el: ReactElement): string | undefined {
  if (typeof el.type === "string") return el.type;
  const node = (el.props as { node?: { tagName?: unknown } }).node;
  return typeof node?.tagName === "string" ? node.tagName : undefined;
}

function split(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return splitText(child);
    if (typeof child === "number") return splitText(String(child));
    if (!isValidElement(child)) return child;

    const props = child.props as { children?: ReactNode; "data-written"?: string };
    /* A nested `Written` measures and splits its own text; splitting it here
       too would be harmless to the text and would hand it spans it did not
       make. */
    if (child.type === Written) return child;
    if (props["data-written"] === "off") return child;
    const tag = tagOf(child);
    if (tag !== undefined && LEAVE.has(tag)) return child;
    if (props.children === undefined) return child;

    /* Same element, same props, same key — only its text is split. A link
       stays the link, with its href and its handlers, and its name stays its
       text: the spans are inside it, not around it. */
    return cloneElement(child, undefined, split(props.children));
  });
}

/* ------------------------------------------------------------ the measure -- */

/*
 * Which line each word is on, how far down the paragraph that line is, and
 * how far along it the word is.
 *
 * Two numbers per word, because the clock is the paragraph's and not the
 * word's — the component comment says why. An inline-block would have
 * carried its own clock and brought #110's bidi reversal back with it; two
 * numbers per layout are the cheaper price.
 *
 * Only this paragraph's own words: a nested `Written` names its own
 * timeline, so its words are placed against its box by its own measurement,
 * and an outer one writing over them would place them against the wrong one.
 *
 * Returns the writes rather than doing them, so that a resize which lands on
 * forty paragraphs at once reads all forty and then writes all forty: one
 * layout, then style invalidation, rather than forty alternations of the two.
 * Neither property changes geometry, but a read after a pending style change
 * still has to flush the style first.
 *
 * A word is on a new line when its first fragment starts at or below the
 * bottom of the line before it. Not "a different top": a superscript, a
 * larger inline `code` or a link with padding shifts a top by a pixel or two
 * without being a new line, and overlap is the test that ignores all of them.
 * `getClientRects()[0]` and not the bounding box, because a long URL allowed
 * to break inside itself has two fragments and belongs to the line it starts
 * on.
 */
function measure(root: HTMLElement): () => void {
  const words = Array.from(root.querySelectorAll<HTMLElement>("[data-word]")).filter(
    (w) => w.parentElement?.closest("[data-written]") === root,
  );
  const origin = root.getBoundingClientRect().top;
  const pens = new Array<string>(words.length).fill("0");
  const lines = new Array<string>(words.length).fill("0px");

  let start = 0;
  let lineTop = Infinity;
  let lineBottom = -Infinity;
  const close = (end: number) => {
    const n = end - start;
    const y = `${Math.round((lineTop - origin) * 2) / 2}px`;
    for (let i = start; i < end; i += 1) {
      pens[i] = ((i - start) / n).toFixed(3);
      lines[i] = y;
    }
  };

  words.forEach((word, i) => {
    const rect = word.getClientRects()[0];
    if (!rect) return;
    if (i > start && rect.top >= lineBottom - 0.5) {
      close(i);
      start = i;
      lineTop = rect.top;
      lineBottom = rect.bottom;
    } else {
      lineTop = Math.min(lineTop, rect.top);
      lineBottom = Math.max(lineBottom, rect.bottom);
    }
  });
  if (words.length > 0 && Number.isFinite(lineTop)) close(words.length);

  return () => {
    words.forEach((word, i) => {
      /* Written straight to the element, so a resize costs no React render;
         React never owns these because no word is given a `style`. Compared
         first, so a resize that moved nothing invalidates nothing. */
      if (word.style.getPropertyValue("--pen") !== pens[i]) word.style.setProperty("--pen", pens[i]);
      if (word.style.getPropertyValue("--line") !== lines[i]) word.style.setProperty("--line", lines[i]);
    });
  };
}

/*
 * One observer for every `Written` on the page.
 *
 * A blog post is forty paragraphs, and forty observers each delivering a
 * callback in the same frame is forty read-write passes; one observer is one
 * callback holding forty entries, which is what makes the batching above
 * possible at all.
 */
const roots = new Set<HTMLElement>();
let observer: ResizeObserver | null = null;

function remeasure(targets: Iterable<HTMLElement>) {
  const writes: Array<() => void> = [];
  for (const el of targets) if (el.isConnected) writes.push(measure(el));
  writes.forEach((w) => w());
}

/* The effect only runs where scroll-driven animation does; anywhere else the
   numbers would be computed for a stylesheet that never reads them. */
function canRun(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof ResizeObserver === "function" &&
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timeline: view()")
  );
}

/*
 * Which paragraphs are near the band, and the only ones that animate.
 *
 * Measured, the cost of `pen` is the number of words animating, not the
 * number of words split: with every word cancelled the spans cost nothing
 * measurable, and with every word animating a frame paid for all of them —
 * every word's colour is resolved again on every frame the paragraph's clock
 * moves, including the ones sitting in a fill state that cannot change. So a
 * paragraph that is nowhere near the band is told so, and the stylesheet
 * parks its words at muted with no animation at all; a post of forty
 * paragraphs animates the two or three that are being read.
 *
 * The window is wider than the band on both sides — 50% to 80% of the
 * height against the band's 58% to 72% — so a paragraph is live before its
 * first line reaches the band's foot and stays live until its last word has
 * finished un-writing; parking it is then a change from muted to the same
 * muted. A paragraph is parked only when the observer *says* it is outside:
 * with no attribute at all it animates, so an observer that never fires
 * leaves the effect running rather than the text stuck.
 *
 * Fires on crossings, not on scroll: one attribute per paragraph per
 * crossing, and nothing between them. This is the page's fourth
 * IntersectionObserver, after `Rise`, `useEnteredOnce` and `DarkAct`.
 */
let near: IntersectionObserver | null = null;

function watch(el: HTMLElement): () => void {
  if (!canRun()) return () => {};
  if (!observer) {
    observer = new ResizeObserver((entries) => remeasure(entries.map((e) => e.target as HTMLElement)));
    /* A web font that arrives after first paint can move every break in a
       paragraph without changing its height, which a ResizeObserver would not
       see. Once, for the page, when the faces are in. */
    document.fonts?.ready.then(() => remeasure(roots)).catch(() => {});
  }
  if (!near && typeof IntersectionObserver === "function") {
    near = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          (e.target as HTMLElement).dataset.pen = e.isIntersecting ? "live" : "rest";
        }
      },
      { rootMargin: "-50% 0px -20% 0px" },
    );
  }
  roots.add(el);
  /* `observe` delivers an initial callback, which is the first measurement. */
  observer.observe(el);
  near?.observe(el);
  return () => {
    roots.delete(el);
    observer?.unobserve(el);
    near?.unobserve(el);
  };
}

/* ------------------------------------------------------------- component -- */

export default function Written({ as = "p", className = "", children, ...rest }: WrittenProps) {
  const ref = useRef<HTMLElement>(null);

  /* Layout effect, so the first measurement is queued before first paint;
     the observer still delivers it, which keeps every measurement on the one
     batched path. */
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
      {split(children)}
    </Tag>
  );
}
