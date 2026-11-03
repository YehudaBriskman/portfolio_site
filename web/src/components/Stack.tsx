import type { CSSProperties } from "react";
import InkRule from "@/components/motion/InkRule";
import { specFiguresOf } from "@/data/specs";
import { useContent } from "@/content/store";
import { useHomeWords } from "@/i18n/pages";
import styles from "@/components/Stack.module.css";

/*
 * The spec plate, where the tool list used to be.
 *
 * What this replaced
 * ------------------
 * Three cards holding twenty-three tool names in three groups: "reach for
 * daily", "shipped to production", "currently learning". The grouping was the
 * best thing about it and it was still the wrong shape for this beat, because
 * `React, TypeScript, Node, Docker` is an inventory and an inventory does not
 * count. The tools have gone into the field lines of the objects that use
 * them, which is where they are actually informative:
 * `REACT 19 · CHROME WEB STORE · IN USE` tells you something about WindoM
 * that no logo wall ever told anybody about its author.
 *
 * What stands here instead is the collection's spec plate — a small set of
 * figures about the work, counted up by the reader's scroll as they arrive. Both of the reference
 * sites close on exactly this; the most quietly confident thing on zephium.app
 * is `40 MB / Instant / Lighter / Longer` with four tiny captions under it.
 *
 * The honesty rule is the whole device
 * ------------------------------------
 * A counter is a truth claim with motion attached, so every number here is
 * derived from `data/projects.ts` on load and carries its derivation in a
 * comment beside it — see `data/specs.ts`. Two figures the sketch asked for
 * are missing because they could not be sourced: the Chrome Web Store user
 * count, which lives on a store listing this site does not read, and a
 * language count, which would have to come from a GitHub field that is null
 * for every project until a collection is published. A number that cannot
 * re-derive itself is not a figure, however good it looks counting up.
 *
 * There is no arrival on this section. The beat's device is `count`; wrapping the figures in an
 * arrival as well would be two devices saying "here I am" at different speeds,
 * and the count is the stronger of the two by a distance.
 */
export default function SpecPlate() {
  /* Counted from the content store's table (#163), the one the pile renders. */
  const specFigures = specFiguresOf(useContent().projects);
  const w = useHomeWords();
  return (
    /*
     * `id="stack"` outlives the name on purpose.
     *
     * Nothing in the tree links to it today, but the nav is being rebuilt as
     * an index of the collection by another hand, and a section anchor that
     * changes underneath an in-page link is a dead link that nothing catches.
     * The heading is what the reader sees and it says what this is now.
     */
    <section id="stack" className="wrap section-y relative">
      {/* Centred, like the three other heads on this page; the layout and the
          argument for the flanking pair of rules are in `.section-head` in
          index.css. */}
      <div className="section-head">
        <InkRule className="section-head-rule" />
        <h2 className="display text-section leading-[0.9]">{w.specs}</h2>
        <InkRule className="section-head-rule" />
        <p className="eyebrow section-head-note">{w.specsNote}</p>
      </div>

      {/*
       * A description list, because that is what a plate of figures is: four
       * names and four values. The visual order — figure above caption — is a
       * flex direction on each cell and not a reordering of the document, so
       * a screen reader still reads "Projects, 6" rather than "6, Projects".
       */}
      <dl
        className={styles.plate}
        style={{ "--spec-columns": specFigures.length } as CSSProperties}
      >
        {specFigures.map((figure) => (
          <div key={figure.caption} className={styles.cell}>
            <dt className={`${styles.caption} text-field`}>{w.spec[figure.caption]}</dt>
            <dd
              className={`${styles.figure} text-section`}
              style={
                {
                  "--spec-to": figure.value,
                  /* How wide the digits have to be before the first one
                     arrives, so nothing shuffles sideways at 9 → 10. */
                  "--spec-digits": String(figure.value).length,
                } as CSSProperties
              }
            >
              {/*
               * The visible digits are drawn by a CSS counter on this span's
               * `::before`, which is the only way a number can change
               * without React re-rendering it. Generated content is read by
               * most screen readers, and a figure caught mid-count is
               * nonsense to read out, so the span is hidden from the
               * accessibility tree and the true value sits beside it as text.
               */}
              <span className={styles.count} aria-hidden="true" />
              {/* The spoken figure, with its unit inside the same string.
                  Split across two elements it came out as "3yrs", because
                  the space between them is a flex gap and a gap is not
                  whitespace in the accessibility tree. */}
              <span className="sr-only">
                {figure.unit ? `${figure.value} ${w.years}` : figure.value}
              </span>
              {figure.unit && (
                <span className={styles.unit} aria-hidden="true">
                  {w.years}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
