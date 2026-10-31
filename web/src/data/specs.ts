import { projects } from "@/data/projects";

/*
 * The collection's spec plate.
 *
 * This file replaces `data/stack.ts`, which listed twenty-three tool names in
 * three groups. The list is gone rather than moved: "React, TypeScript, Node,
 * Docker" is an inventory, not a claim, and an inventory does not count. The
 * tools themselves now live in the field lines of the objects that use them,
 * where `REACT 19 · CHROME WEB STORE · IN USE` says more about WindoM than a
 * logo wall ever said about its author.
 *
 * THE HONESTY RULE IS THE WHOLE DEVICE
 * ------------------------------------
 * A counter is a truth claim with motion attached. Every figure below is
 * derived, on load, from `data/projects.ts` — the same table that renders the
 * objects on the page — and every one of them carries the derivation in a
 * comment, so a reader who disbelieves a number can check it against the six
 * entries. Nothing here is typed into markup and nothing is rounded up.
 *
 * What is NOT here, and that is the point
 * ---------------------------------------
 * The sketch for this plate wanted `1,240 USERS` and `11 LANGUAGES`. Neither
 * went on the page.
 *
 *   The Chrome Web Store user count is real and is not in this repository.
 *   It lives on a store listing, behind no API this site calls, and the only
 *   way to print it today would be to read it once by hand and type it in —
 *   at which point it is a number that was true in October and is a claim
 *   from then on. A figure that cannot re-derive itself is not a figure.
 *
 *   Languages would have to come from the GitHub API, which this site does
 *   read — `Collection.stats.language` — but it returns one dominant language
 *   per repository and only for published collections, of which there are
 *   currently none. Counting the languages in `tech` instead would be
 *   counting a hand-written list and calling it an API field.
 *
 *   Stars and merged pull requests have the same shape of problem: the only
 *   number in the tree is the sentence "125 merged pull requests" inside one
 *   project's highlights, and parsing a figure back out of English prose is
 *   how a plate starts printing numbers nobody can account for.
 *
 * So the plate has four figures. If the table shrinks until one of them is
 * zero it will have three; see the filter at the foot of this file.
 */

export type SpecFigure = {
  /**
   * The number. Derived at load, never written down.
   *
   * A `number` rather than a formatted string, because the plate counts it up
   * and a counter needs an integer to interpolate towards.
   */
  value: number;
  /**
   * What the number is, in the mono field voice.
   *
   * Written in sentence case and uppercased by CSS, the same way the label
   * schema's field line is — see the note on `LabelField.value`.
   */
  caption: string;
  /** A unit that belongs to the number rather than to the caption. `yrs`. */
  unit?: string;
};

/*
 * FIGURE 1 — how many objects are in the collection.
 *
 * Source: the length of `projects` in `data/projects.ts`, which is the same
 * array the pile renders. It cannot disagree with the page above it, because
 * it is the page above it.
 */
const objectCount = projects.length;

/*
 * FIGURE 2 — how many of them you can open right now.
 *
 * Source: entries in `data/projects.ts` carrying a `link`, which is defined
 * as the live product and never the repository (`seedToCollection` drops it
 * when it is the same URL as `github`). Two signals agree on this count: the
 * five entries with a link are also the five whose `status` begins "Live".
 * Bothy, the sixth, ships as source and says so.
 */
const liveCount = projects.filter((p) => typeof p.link === "string" && p.link.length > 0).length;

/*
 * A trailing version number, so one tool is not counted twice.
 *
 * `React 19` and `React` are the same tool, as are `Vite 8` and `Vite`, and
 * `Traefik v3.7` and a bare `Traefik` would be. Folding the version is the
 * difference between the honest 20 and the flattering 22 — the inflated
 * count was the first number this plate produced, which is a fair warning
 * about how easily a derived figure can still be wrong.
 *
 * `Manifest V3` folds to `Manifest`, which is cosmetically odd and arithmetically
 * correct: there is no other Manifest in the table, so it counts once either way.
 */
const VERSION_TAIL = /\s+v?\d+(?:\.\d+)*$/i;

/*
 * FIGURE 3 — how many distinct tools the collection is built out of.
 *
 * Source: the union of every entry's `tech` array in `data/projects.ts`,
 * lower-cased and with version tails folded. This is the one figure that is a
 * count *of* the inventory rather than a count of objects, and it earns its
 * place by being checkable: the six `tech` arrays hold thirty-two strings
 * between them, twenty-two of which are distinct as written and twenty once
 * the versions are folded.
 */
const toolCount = new Set(
  projects.flatMap((p) => p.tech).map((tool) => tool.replace(VERSION_TAIL, "").trim().toLowerCase())
).size;

/*
 * FIGURE 4 — how long the collection has been shipping.
 *
 * Source: the `year` field on every entry, which runs 2024 to 2026. Inclusive
 * of both ends, because a thing shipped in 2024 and a thing shipped in 2026
 * is three calendar years of shipping and not two — the alternative reading
 * undercounts by one and is the sort of arithmetic nobody checks.
 *
 * Deliberately not "years of experience", which is a different and much
 * softer claim, and not derived from anything in this repository.
 */
const years = projects
  .map((p) => Number.parseInt(p.year, 10))
  .filter((year) => Number.isFinite(year));
const yearSpan = years.length > 0 ? Math.max(...years) - Math.min(...years) + 1 : 0;

/**
 * The plate, in reading order.
 *
 * Zero is filtered out rather than printed. A figure that has come out empty
 * has lost its source — an empty table, a `year` field that stopped being a
 * year — and the honest response to that is a plate with three figures on it,
 * not a plate with a nought.
 */
export const specFigures: SpecFigure[] = [
  { value: objectCount, caption: "Projects" },
  { value: liveCount, caption: "Live" },
  { value: toolCount, caption: "Tools" },
  { value: yearSpan, caption: "Shipping", unit: "yrs" },
].filter((figure) => figure.value > 0);
