import Written from "@/components/motion/Written";
import LivingLine from "@/components/motion/LivingLine";
import ApproachFigure from "@/components/ApproachFigures";
import { lineAttr } from "@/components/motion/lineMoves";
import { approachLine } from "@/data/site";
import { useContent } from "@/content/store";
import styles from "@/components/Approach.module.css";

/*
 * How I work — the wall text, read the way /story is read (#157).
 *
 * What changed, and why
 * ---------------------
 * This beat used to be three paragraphs and three principles at the page's
 * body size in a 62ch column, arriving through `flow`: each item rose 14px on
 * a 620ms clock, fired once when it crossed 12% of the window. The owner asked
 * for three things the old build could not give:
 *
 *   - bigger reading type and more room — the measure was derived for 19px
 *     and is re-derived for the new size in `Approach.module.css`;
 *   - prose in short sections that read like /story — every paragraph is now
 *     a line or two, written word by word by the pen (`motion/Written`), and
 *     each intro section carries a small label, the way a /story beat carries
 *     its "when";
 *   - one small diagram per principle that shows the method instead of only
 *     naming it (`ApproachFigures.tsx`), drawn by the reader's scroll.
 *
 * And the house rule (owner, 2026-11-02): scroll is the clock. Nothing in this
 * section runs on a timer or fires once; the pen and the drawing are both
 * scrubbed by scroll position and reverse exactly on the way back up. That
 * retires `flow` from this beat — a 620ms arrival fired by an observer is the
 * thing the rule forbids — and the beat's family in the ledger is now `draw`.
 *
 * The layout is one rail and one column
 * -------------------------------------
 * On a wide window every label and every figure sits in a narrow rail on the
 * start side, and every line of prose starts on the same edge beside it — so
 * the section has one left edge to return to (one right edge in Hebrew), and
 * the figures and labels read as marks in a margin rather than as content
 * competing with the text. On a phone the rail folds above each section.
 *
 * The heading stays a step below the other section heads — a wall text is
 * titled, not billboarded — but every size under it moved up a step.
 */
/*
 * THE LINE (#178, #191)
 * ---------------------
 * The story's line (`motion/LivingLine`) runs behind the whole section,
 * drawn by the reader's scroll, in the aurora's strands. It starts behind
 * the work run's dark stage, at its centre, flows straight down out of the
 * projects, turns in a circle to the head's lane, and comes down beside the
 * head; then turns lane to lane through the short sections, and loops once
 * round each principle's figure, entered from above and left from below
 * straight down the rail's outer edge (the principle is the loop's
 * `data-line-hold`), so it never crosses the claim or the lines beside it.
 * Every station's moves are data (`approachLine` in `data/site.ts`, or a
 * section's own `line`). The figures keep their own strokes and their own
 * clock; the line only connects them.
 */
export default function Approach() {
  /* The words from the content store (#163); the line's moves stay code. */
  const { about } = useContent().site;
  const last = about.intro.length;
  return (
    <section id="approach" className="wrap section-y">
      <LivingLine className={styles.wall} from={approachLine.from}>
        <header className={styles.top} data-line={lineAttr(approachLine.section(0, last))}>
          <h2 className={`display-tight text-sub ${styles.head}`}>{about.heading}</h2>
          {/* The role is "technical team lead", never anything that names
              where — see the employer rule in `data/site.ts`. */}
          <p className="eyebrow mt-3">Full-stack &middot; Technical team lead</p>
        </header>

        {about.intro.map((s, i) => (
          <div key={s.label} className={styles.beat} data-line={lineAttr(s.line ?? approachLine.section(i + 1, last))}>
            {/* The beat's "when", in the field register every label on the
                site uses. It names the section; it is not a heading, because
                a heading per two sentences would turn the outline of the page
                into a list of three-word entries. */}
            <p className={`eyebrow ${styles.label}`}>{s.label}</p>
            <div className={styles.text}>
              {s.lines.map((line) => (
                <Written key={line.slice(0, 32)} className={styles.prose}>
                  {line}
                </Written>
              ))}
            </div>
          </div>
        ))}

        {/*
          Three principles: a figure in the rail, a claim, and its lines. No
          ordinals — read as prose these are not a countdown.

          The figure is keyed by the claim (`ApproachFigures.tsx`), and a
          claim nobody drew a figure for gets none rather than someone else's.
        */}
        {about.principles.map((p) => (
          <div key={p.claim} className={styles.principle} data-line-hold="">
            <div className={styles.ring} data-line={lineAttr(p.line ?? approachLine.principle)}>
              <ApproachFigure claim={p.claim} />
            </div>
            <div className={styles.text}>
              <h3 className={styles.claim}>{p.claim}</h3>
              {p.lines.map((line) => (
                <Written key={line.slice(0, 32)} className={styles.prose}>
                  {line}
                </Written>
              ))}
            </div>
          </div>
        ))}
      </LivingLine>
    </section>
  );
}
