import { Fragment, type CSSProperties, type ReactNode } from "react";
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
  /**
   * Write each field's kind onto its `<li>` as `data-kind`.
   *
   * Off by default, so every project and every note renders exactly the
   * markup it rendered before this existed. It is not a `variant` in
   * disguise: it changes no size, no voice and no order, and a caller that
   * turns it on gets the same label with one non-visual attribute on it.
   *
   * It exists because the title plate gives each field an arrival derived
   * from what kind of fact the field states — a place, a count, a span — and
   * the only other way to reach them from a stylesheet is `:nth-child()`.
   * `orderFields` sorts by kind, so position and kind agree for any one
   * label's current contents and disagree silently the moment those contents
   * change. The kind has to be in the markup for a rule about kinds to keep
   * meaning what it says.
   */
  exposeFieldKinds?: boolean;
  /**
   * Set the name as one span per letter, inside one span per word.
   *
   * Off by default, so every project and every note sets its name as the one
   * text node it has always been. Like `exposeFieldKinds` this is a hook and
   * not a `variant`: it changes no size, no voice, no order and no colour,
   * and the string in the document is character-for-character the same one.
   *
   * It exists because the title plate's name arrives one letter at a time,
   * and a `transform` has no effect on a non-replaced inline box — so the
   * letters have to be elements before any stylesheet can move them. Three
   * things the split has to preserve, and each is a line below rather than a
   * hope: the accessible name stays one string (`aria-label`), the copied
   * text stays one string (the spaces between words are real text nodes, and
   * the spans add no characters), and a word never breaks across lines (each
   * word is one inline-block, so the only break opportunities are the spaces
   * that were always there).
   */
  splitName?: boolean;
};

/**
 * The name as word spans of letter spans.
 *
 * `--letter` carries the letter's index across the whole name rather than
 * within its word, because the thing a stylesheet wants from it is the
 * position in the reading order — a per-word counter would restart the
 * cascade at every space. `data-letter-last` marks the end of that order so a
 * sequence can wait for the name to finish without counting elements itself.
 */
function splitIntoLetters(name: string): ReactNode {
  const words = name.split(" ");
  const total = [...name].filter((c) => c !== " ").length;
  let index = 0;

  return words.map((word, w) => (
    /* The space is a real text node between two inline-blocks: it is the
       break opportunity the line needs and the character the clipboard
       needs, and a `gap` or a margin would be neither. */
    <Fragment key={`${w}:${word}`}>
      {w > 0 && " "}
      <span className={styles.word} data-word="">
        {[...word].map((ch, i) => {
          const at = index;
          index += 1;
          return (
            <span
              key={`${i}:${ch}`}
              className={styles.letter}
              data-letter=""
              data-letter-last={at === total - 1 ? "" : undefined}
              style={{ "--letter": at } as CSSProperties}
            >
              {ch}
            </span>
          );
        })}
      </span>
    </Fragment>
  ));
}

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
  exposeFieldKinds = false,
  splitName = false,
}: ObjectLabelProps) {
  const Name = nameAs;
  const ordered = orderFields(fields);

  /* Size comes from the type scale, not from the stylesheet, so a label and a
     section head sharing a rung cannot drift apart. */
  const nameSize =
    scale === "plate" ? "text-hero" : scale === "object" ? "text-object" : "";

  return (
    <div className={`${styles.label} ${styles[scale]} ${className}`}>
      <Name
        className={`${styles.name} ${nameSize} ${splitName ? styles.split : ""}`}
        /* The one string, stated once, for the one consumer that reads a
           heading as a label rather than as a box of text. Absent when the
           name is a single text node, because an `aria-label` that repeats
           the content is a second copy of it to keep in step. */
        aria-label={splitName ? name : undefined}
      >
        {splitName ? splitIntoLetters(name) : name}
      </Name>
      <p className={`${styles.fact} ${scale === "inline" ? "" : "text-fact"}`}>
        {fact}
      </p>
      {ordered.length > 0 && (
        <ul className={`${styles.fields} text-field`}>
          {ordered.map((f) => (
            /* Keyed by value, not by index: the shelf re-sorts fields and an
               index key would carry the previous field's DOM across. */
            <li
              key={`${f.kind}:${f.value}`}
              className={styles.field}
              /* `undefined` and not `""`: an empty attribute would still
                 match `[data-kind]`, which is the selector the plate's
                 off-switches use, so every label on the site would start
                 answering to the title plate's stylesheet. */
              data-kind={exposeFieldKinds ? f.kind : undefined}
            >
              {f.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
