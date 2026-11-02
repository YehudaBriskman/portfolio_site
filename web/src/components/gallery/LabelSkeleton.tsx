import SkeletonLines from "@/components/gallery/SkeletonLines";
import type { LabelScale } from "@/components/gallery/ObjectLabel";
import { MAX_FIELDS } from "@/components/gallery/objectLabel";
import label from "@/components/gallery/ObjectLabel.module.css";

/*
 * The label, before the object arrives.
 *
 * ── why one of these and not one per section ──────────────────────────────
 *
 * Every object in the gallery is labelled through `ObjectLabel` — a name, one
 * line of fact, two or three mono fields, at one of three scales — and that
 * sameness is what makes a placeholder tractable. A skeleton shaped like *the
 * schema* is correct for a project, a note and a person alike, because those
 * three are already drawn identically. One per section would be one guess at
 * a height per section, each free to drift from the thing it stands in for
 * the next time that thing is edited.
 *
 * ── it wears the label's own stylesheet, and that is the load-bearing bit ──
 *
 * The wrapper takes `.label` and the scale class, the name block takes
 * `.name` and the same size utility `ObjectLabel` picks, the fact line takes
 * `.fact`, the field row takes `.fields`. Not copies of those rules: the
 * rules. Combined with `SkeletonLines`, which has no height in it either,
 * that means there is not one hard-coded measurement anywhere in this
 * component — the skeleton is as tall as the label because it is set in the
 * label's type at the label's gaps, and a change to either moves both.
 *
 * ── where this is used, and where it is deliberately not ──────────────────
 *
 * The one async region on the site that renders `ObjectLabel` is the notes
 * shelf. `/blog`'s grid and the project page's note list are built from
 * `NoteCard`, which is not a label — it has a badge row, a stretched link
 * and its own type steps — so a label-shaped skeleton there would be the
 * wrong shape *and* the wrong height, which is worse than either alone.
 * Those two compose `SkeletonLines` under the card's own classes instead.
 * One drawing, one sweep, one set of off-switches, one gate; the composition
 * follows the thing being stood in for, because that is the only thing that
 * can make a skeleton the right height.
 */

export type LabelSkeletonProps = {
  /** The scale the real labels in this region are drawn at. */
  scale?: LabelScale;
  /**
   * How many lines the real name runs to at this width.
   *
   * Half of what makes the skeleton the right height, and not a guess to be
   * made casually. The honest way to pick it is to look at the region loaded
   * and count.
   */
  nameLines?: number;
  /** How many lines the real fact line runs to. Same argument as above. */
  factLines?: number;
  /** How many fields the real label prints. Two or three; three is the cap. */
  fields?: number;
  className?: string;
};

/**
 * The three field capsules, and the one place in a skeleton where a width is
 * a measurement rather than a drawing.
 *
 * Everywhere else here the capsule widths are decoration: a line is a block
 * box in a column, so how far along it the ink runs cannot move anything.
 * The field row is the exception and it cost a wrong phone layout to find.
 * `.fields` is `display: flex; flex-wrap: wrap`, so the row is one line tall
 * when the three fields fit across the card and two when they do not — and
 * if the capsules are not about as wide as the words they stand in for, the
 * skeleton wraps at a different width from the thing it is predicting and
 * the card comes out a line short.
 *
 * Measured on the notes shelf, which is where the schema's field line is
 * drawn at its narrowest. At 390x844 the real fields run 72 / 65-73 / 90-94
 * CSS pixels against a 252px row, so four of the six cards wrap to two rows
 * and set the height of all six; at 1440x900 the same fields run 68 / 61-69
 * / 84-89 against a 302px row and none of them wrap. These three lengths
 * reproduce both: in `rem`, so they scale with the root exactly as
 * `text-field` does, and the one breakpoint that matters is the phone's
 * larger root rather than a media query.
 *
 * They are lengths and not percentages because a percentage on a flex item
 * that is sizing to its content resolves against nothing.
 */
const FIELD_WIDTHS = ["4.25rem", "4rem", "5.5rem"] as const;

export default function LabelSkeleton({
  scale = "object",
  nameLines = 1,
  factLines = 2,
  fields = MAX_FIELDS,
  className = "",
}: LabelSkeletonProps) {
  /* The same two conditionals `ObjectLabel` applies, and they have to be the
     same two: the name's size is a utility at `plate` and `object` and a rule
     in the stylesheet at `inline`, and the fact line is that same division
     one step down. Picking either differently here would set the skeleton in
     a type step the label never uses, which is the one way this component
     can be the wrong height while looking right. */
  const nameSize =
    scale === "plate" ? "text-hero" : scale === "object" ? "text-object" : "";
  const factSize = scale === "inline" ? "" : "text-fact";

  return (
    /*
      `aria-hidden`, and nothing of this in the accessibility tree.

      A placeholder has nothing to announce — it is the absence of content,
      drawn. A reader on a screen reader learns the region arrived from the
      one polite region the caller already owns, not from a dozen empty boxes
      entering the tree and leaving it again a second later.
    */
    <div className={`${label.label} ${label[scale]} ${className}`} aria-hidden="true">
      <div className={`${label.name} ${nameSize}`} data-sk-block="name">
        <SkeletonLines lines={nameLines} />
      </div>
      <p className={`${label.fact} ${factSize}`} data-sk-block="fact">
        <SkeletonLines lines={factLines} />
      </p>
      {fields > 0 && (
        <div className={`${label.fields} text-field`} data-sk-block="fields">
          {FIELD_WIDTHS.slice(0, Math.min(fields, MAX_FIELDS)).map((w) => (
            <SkeletonLines key={w} lines={1} tail={w} />
          ))}
        </div>
      )}
    </div>
  );
}
