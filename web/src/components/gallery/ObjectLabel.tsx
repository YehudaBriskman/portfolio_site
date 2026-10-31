import { orderFields, type ObjectLabelData } from "@/components/gallery/objectLabel";
import styles from "@/components/gallery/ObjectLabel.module.css";

/**
 * How much room the label has, and nothing else.
 *
 * Deliberately not a list of sections. A scale says how big the plate is; it
 * does not say what kind of thing is on it, because the whole point is that a
 * project and a note and a person are labelled identically.
 */
export type LabelScale = "plate" | "object" | "inline";

/**
 * Which heading level the name is.
 *
 * The name is the object's heading in the document, so its rank is the
 * caller's to decide — a pile of projects under a section head wants `h3`, the
 * title plate wants `h1`. `p` is for the handful of places a label appears
 * where it is not a heading at all, such as inside another object's card.
 */
export type NameAs = "h1" | "h2" | "h3" | "h4" | "p";

export type ObjectLabelProps = ObjectLabelData & {
  scale?: LabelScale;
  nameAs?: NameAs;
  className?: string;
};

/*
 * Every object on this site is labelled through here.
 *
 * The schema, and the two rules about what may go in it, are documented on the
 * type in `objectLabel.ts`. The short version: fact and not pitch, and the
 * most identifying field first, because a label spends most of its life
 * cropped.
 *
 * There is no `variant` prop and no per-section override, and that absence is
 * the component. A gallery's labels are identical by construction; the first
 * exception granted to one section is the point at which the page becomes a
 * grid of unrelated things again.
 */
export default function ObjectLabel({
  name,
  fact,
  fields,
  scale = "object",
  nameAs = "h3",
  className = "",
}: ObjectLabelProps) {
  const Name = nameAs;
  const ordered = orderFields(fields);

  /* Size comes from the type scale, not from the stylesheet, so a label and a
     section head sharing a rung cannot drift apart. */
  const nameSize =
    scale === "plate" ? "text-hero" : scale === "object" ? "text-object" : "";

  return (
    <div className={`${styles.label} ${styles[scale]} ${className}`}>
      <Name className={`${styles.name} ${nameSize}`}>{name}</Name>
      <p className={`${styles.fact} ${scale === "inline" ? "" : "text-fact"}`}>
        {fact}
      </p>
      {ordered.length > 0 && (
        <ul className={`${styles.fields} text-field`}>
          {ordered.map((f) => (
            /* Keyed by value, not by index: the shelf re-sorts fields and an
               index key would carry the previous field's DOM across. */
            <li key={`${f.kind}:${f.value}`} className={styles.field}>
              {f.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
