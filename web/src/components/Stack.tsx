import type { CSSProperties } from "react";
import InkRule from "@/components/motion/InkRule";
import { specFigures } from "@/data/specs";
import { useEnteredOnce } from "@/hooks/useEnteredOnce";
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
 * figures about the work, counted up as they arrive. Both of the reference
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
 * There is no ink wipe on this section, which every other section has
 * something of. The beat's device is `count`; wrapping the figures in an
 * arrival as well would be two devices saying "here I am" at different speeds,
 * and the count is the stronger of the two by a distance.
 */
export default function SpecPlate() {
  /*
   * One observation, once, and then the observer is gone. The flag starts the
   * stylesheet's clock; everything else about the motion — the duration, the
   * easing, and all three ways of switching it off — lives in the CSS where
   * the at-rules can reach it.
   */
  const [plate, counting] = useEnteredOnce<HTMLDListElement>();

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
      {/* Stacks below `sm` for the reason the other section heads give: a
          display heading and an unbreakable eyebrow do not share a 350px
          row. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-6">
        <h2 className="display text-section leading-[0.9]">Specs</h2>
        <InkRule className="mb-3 hidden min-w-0 flex-1 sm:block" />
        <p className="eyebrow shrink-0 sm:mb-3">Counted from the work, not claimed</p>
      </div>

      {/*
       * A description list, because that is what a plate of figures is: four
       * names and four values. The visual order — figure above caption — is a
       * flex direction on each cell and not a reordering of the document, so
       * a screen reader still reads "Projects, 6" rather than "6, Projects".
       */}
      <dl
        ref={plate}
        className={styles.plate}
        style={{ "--spec-columns": specFigures.length } as CSSProperties}
        /* The attribute is the starting gun and nothing else. Present means
           the count has been armed once; it is never removed, because a
           figure that has landed does not un-land. */
        data-counting={counting ? "" : undefined}
      >
        {specFigures.map((figure) => (
          <div key={figure.caption} className={styles.cell}>
            <dt className={`${styles.caption} text-field`}>{figure.caption}</dt>
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
                {figure.unit ? `${figure.value} ${figure.unit}` : figure.value}
              </span>
              {figure.unit && (
                <span className={styles.unit} aria-hidden="true">
                  {figure.unit}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
