import type { ReactElement, SVGProps } from "react";
import styles from "@/components/Approach.module.css";

/*
 * One small diagram per principle, drawn from what the principle says (#157).
 *
 * Each is a handful of strokes on a 96-unit square, and every stroke is drawn
 * by the reader's scroll: `pathLength={1}` normalises its length so one
 * keyframe (`stroke-dashoffset` 1 → 0) draws any of them, and `data-step`
 * places it on the principle's clock — step 1 is drawn first, and two strokes
 * with the same step are drawn together, which three of them do on purpose
 * (see each figure). The ranges are in `Approach.module.css`.
 *
 * WHY THEY ARE `aria-hidden`
 * --------------------------
 * The paragraph beside each one already says everything the drawing shows.
 * A figure that only illustrates the sentence next to it would read that
 * sentence a second time to a screen reader, worse, so all three are out of
 * the accessibility tree and carry no title. If a figure ever shows something
 * its text does not say, it needs a text alternative instead.
 *
 * WHY THEY ARE DIRECTION-NEUTRAL
 * ------------------------------
 * Nothing in them flows sideways — the clone comes down, the outcomes fork
 * down into both sides, the key is held above the history — so none of them
 * has a reading direction to mirror under `dir="rtl"`, and the Hebrew page
 * draws the same marks as the English one.
 *
 * Inline SVG markup and no `style` attribute on any mark, so nothing here
 * needs the CSP to allow inline styles.
 */

type Mark = SVGProps<SVGPathElement> & { step: number };

/* A path on the clock. `d` and the step are the whole of what varies. */
function M({ step, ...rest }: Mark) {
  return <path pathLength={1} data-step={step} {...rest} />;
}

function C({ step, ...rest }: SVGProps<SVGCircleElement> & { step: number }) {
  return <circle pathLength={1} data-step={step} {...rest} />;
}

function Figure({ children, name }: { children: ReactElement | ReactElement[]; name: string }) {
  return (
    <svg
      className={styles.figure}
      viewBox="0 0 96 96"
      aria-hidden="true"
      focusable="false"
      data-figure={name}
    >
      {children}
    </svg>
  );
}

/*
 * Install from empty, every time.
 *
 * An empty directory, open at the top; the clone coming down into it; then
 * the three-line install filling it from the floor up, one line at a time.
 * The box is drawn before anything enters it because the point is that it
 * starts empty, and it is drawn again from nothing on every scroll down.
 */
function FromEmpty() {
  return (
    <Figure name="from-empty">
      <M step={1} d="M14 30 V86 H82 V30" />
      <M step={2} d="M48 6 V40" />
      <M step={2} d="M40 32 L48 40 L56 32" />
      <M step={3} className={styles.fill} d="M24 76 H72" />
      <M step={4} className={styles.fill} d="M24 64 H72" />
      <M step={5} className={styles.fill} d="M24 52 H72" />
    </Figure>
  );
}

/*
 * A check that cannot fail is not a check.
 *
 * One run, forking into two outcomes that are drawn at the same moment — the
 * pass and the fail are on one step, because the check only means something
 * if both branches are reachable — and only then marked, the pass in the
 * signal ink and the fail in the body ink, so neither reads as decoration.
 */
function MustFail() {
  return (
    <Figure name="must-fail">
      <M step={1} d="M48 6 V32" />
      <M step={2} d="M48 32 C48 46 24 44 24 58" />
      <M step={2} d="M48 32 C48 46 72 44 72 58" />
      <C step={3} cx={24} cy={72} r={12} />
      <C step={3} cx={72} cy={72} r={12} />
      <M step={4} className={styles.fill} d="M18 72 L22.5 76.5 L30.5 67.5" />
      <M step={4} d="M66.5 66.5 L77.5 77.5" />
      <M step={5} d="M77.5 66.5 L66.5 77.5" />
    </Figure>
  );
}

/*
 * Generated, never committed.
 *
 * A key, cut at install time; the history below it, three commits on one
 * line; and between them a path from the key that stops at a bar short of the
 * line. The key is drawn first and the history after it, and the path is the
 * last thing drawn, so the stop is the end of the sentence.
 */
function NeverCommitted() {
  return (
    <Figure name="never-committed">
      <C step={1} cx={26} cy={22} r={11} />
      <M step={2} d="M37 22 H82 M72 22 V31 M80 22 V29" />
      <M step={3} d="M8 82 H19 M29 82 H43 M53 82 H67 M77 82 H88" />
      <C step={3} cx={24} cy={82} r={5} />
      <C step={3} cx={48} cy={82} r={5} />
      <C step={3} cx={72} cy={82} r={5} />
      <M step={4} d="M48 40 V58" />
      <M step={5} className={styles.fill} d="M38 64 H58" />
    </Figure>
  );
}

/*
 * Keyed by the claim, not by position, for the reason the old arrival
 * treatments were: a drawing is a statement about one sentence, and if the
 * copy in `data/site.ts` is reworded or reordered the right failure is for a
 * principle to have no figure rather than to show one drawn for a different
 * claim. An empty rail cell keeps the claim on the text edge.
 */
const FIGURES: Record<string, (() => ReactElement) | undefined> = {
  "Install from empty, every time": FromEmpty,
  "A check that cannot fail is not a check": MustFail,
  "Generated, never committed": NeverCommitted,
};

export default function ApproachFigure({ claim }: { claim: string }) {
  const Drawn = FIGURES[claim];
  return Drawn ? <Drawn /> : <span className={styles.figure} aria-hidden="true" />;
}
