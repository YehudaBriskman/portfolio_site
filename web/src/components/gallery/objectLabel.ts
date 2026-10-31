/*
 * The label schema, as a type.
 *
 * Everything on this site is an object in one collection — the projects, the
 * notes, and the person whose collection it is — and every object carries the
 * same three-part label. That sameness is not tidiness. A collection is only a
 * collection because its labels share a schema; without one it is a grid of
 * things that happen to be near each other.
 *
 *     NAME                  the object's own name
 *     one line of fact      what the thing is
 *     FIELD · FIELD         the specs
 *
 * Two rules govern what may go in them, and both are easier to break than to
 * notice.
 *
 * FACT, NOT PITCH. A museum label reads `Cedar. Air-dried 18 months.` and not
 * `Craftsmanship you can feel.` "A car marketplace that loads on a phone
 * signal" is a fact; "blazing-fast marketplace experience" is a claim wearing
 * a fact's clothes. Persuasion in an object label is what makes a portfolio
 * read as a CV, which is the one thing this page is trying not to be.
 *
 * THE SCHEMA HAS TO SURVIVE BEING CROPPED. A label spends most of its life
 * half-visible — a card entering the viewport, a note mid-travel on the shelf.
 * Field order is therefore load-bearing: the most identifying field goes
 * first, because it is the one still on screen when the rest is not.
 */

/**
 * What kind of thing a field states.
 *
 * A closed union rather than a free string, because the kind is what lets the
 * shelf and the pile sort and truncate fields without reading their contents,
 * and because an open bag of strings is how a schema stops being one.
 */
export type FieldKind =
  /** What it is built with. `React 19`, `Rust`. */
  | "tech"
  /** Where it lives. `Chrome Web Store`, `npm`. */
  | "where"
  /** What state it is in. `In use`, `Archived`. */
  | "state"
  /** When. A year, a month and year, or a span. */
  | "when"
  /** How long it takes to read. Notes only. */
  | "reading"
  /** A counted fact. `1,240 users`. Only ever a real number. */
  | "count";

export type LabelField = {
  kind: FieldKind;
  /** Rendered as written. Capitalisation is applied by CSS, not here. */
  value: string;
};

export type ObjectLabelData = {
  /** The object's own name. Never a headline about the object. */
  name: string;
  /**
   * One line of fact. What the thing is, not why it is good.
   * Kept to a sentence — the fact line is read, the fields are scanned.
   */
  fact: string;
  /**
   * Two or three. Four is a datasheet, which is exactly what the project
   * blocks were before they were cut back.
   */
  fields: LabelField[];
};

/**
 * The order a field line is read in, most identifying first.
 *
 * Sorting by kind rather than by author means a label written carelessly still
 * crops correctly, and it means two objects of the same type always put the
 * same kind of fact in the same place — which is what makes a column of them
 * scannable at all.
 */
const FIELD_ORDER: readonly FieldKind[] = [
  "state",
  "tech",
  "where",
  "count",
  "reading",
  "when",
];

/** Three, hard. The cap is the schema; see the note on ObjectLabelData. */
export const MAX_FIELDS = 3;

/**
 * Put a label's fields in reading order and cut it to the cap.
 *
 * Returns a new array; the caller's data is never mutated, because the seed
 * table in `data/projects.ts` is module state shared across every render.
 */
export function orderFields(fields: LabelField[]): LabelField[] {
  return [...fields]
    .sort((a, b) => FIELD_ORDER.indexOf(a.kind) - FIELD_ORDER.indexOf(b.kind))
    .slice(0, MAX_FIELDS);
}
