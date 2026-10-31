import { projects } from "@/data/projects";
import { objectAnchorId } from "@/lib/objectAnchor";

/*
 * The index, generated from the collection.
 *
 * This file holds no list of names. Every project in the bar comes out of
 * `data/projects.ts` — the same table the plates are rendered from — so the
 * index cannot drift from the collection: a project added to the data appears
 * in the chrome without anyone remembering to put it there, and one removed
 * leaves it. A hand-written array up here would be a second collection that
 * happens to resemble the first most of the time, which is the failure mode
 * the old nav had with its own section anchors.
 *
 * Two plates are not projects and are written out, because they are not rows
 * in any table: the notes shelf and the inquiry plate. They are the last two
 * objects in the room and they come after the work, in the order the page
 * puts them in.
 */

/**
 * Where an object lives when its plate is not in the document.
 *
 * The index is one list at every width and on every route, which means an
 * item has to be able to answer "take me to this object" from a page the
 * object's plate is not on. It is never a dead link and never a hidden item:
 * absent plate, so the object's own page instead.
 */
export type NavIndexAway = {
  /** A route. Never a bare hash — this is used when the hash has nowhere to land. */
  to: string;
  /** An id to scroll to once that route has rendered. Only for plates with no page of their own. */
  anchor?: string;
};

export type NavIndexItem = {
  /** Stable identity for React and for the current-object bookkeeping. */
  key: string;
  /**
   * What the bar prints. Sentence case, and short: the index is read as one
   * line across the top of the page, so a name that wraps is a name that has
   * broken the bar.
   */
  label: string;
  /** The id of this object's plate on the collection page. */
  anchor: string;
  away: NavIndexAway;
};

/*
 * How long a name may be before the index shortens it.
 *
 * Measured rather than chosen: at the index's type size the six project names
 * in the table set between 42px and 70px wide except one — "Programming with
 * Yehuda", which sets at 168px and on its own costs more of the bar than the
 * two plates after it put together. Sixteen characters is the first cut that
 * separates that one name from the other five, so the rule fires once and
 * leaves every other label exactly as the data wrote it.
 *
 * The honest fix is a `shortName` on `Project`, written by whoever wrote the
 * title, because what a long name is called in an index is a judgement and
 * this is a heuristic standing in for one. `data/projects.ts` belongs to
 * another change and could not be given a field here; the fallback below is
 * what happens in the meantime, and it is reported as a gap rather than
 * presented as the answer.
 */
const LABEL_LIMIT = 16;

/**
 * The name the index prints for an object.
 *
 * Falls back to the first word of the fact line, because the fact line is the
 * only other string the table holds that was written about this object: the
 * teaching platform's reads "Programming lessons, grouped by concept and by
 * language", so the index prints "Programming". A word the author chose, which
 * is the most a derivation can promise — and the reason the limit above is set
 * so that exactly one of six names goes through here at all. The fact line can
 * also open on a verb, in which case this produces a word that names nothing;
 * see the guard below.
 */
export function indexLabel(title: string, tagline: string): string {
  if (title.length <= LABEL_LIMIT) return title;
  const word = tagline.trim().split(/\s+/)[0] ?? "";
  /* A one- or two-letter first word ("A platform for…") names nothing. Rather
     than print a stub, keep the title and let the bar clip it: a truncated
     real name is still the object's name, where "A" is not. */
  return word.length > 2 ? word : title;
}

/* Ascending by `order`, which is how `useProjects` sorts the same rows before
   the plates are drawn. Sorting here rather than trusting the array's literal
   order means the index and the page agree even if a row is appended to the
   middle of the table. */
const OBJECTS: NavIndexItem[] = [...projects]
  .sort((a, b) => a.order - b.order)
  .map((p) => ({
    key: p.slug,
    /* `fact`, which is what `tagline` was called before the label schema
       renamed it — see the note on `Project` in data/projects.ts. */
    label: indexLabel(p.title, p.fact),
    anchor: objectAnchorId(p.slug),
    /* The object's own page. Every project has one, which is what lets an
       index item work from anywhere on the site without the chrome having to
       know what page it is on. */
    away: { to: `/projects/${p.slug}` },
  }));

const TAIL: NavIndexItem[] = [
  /* The notes shelf on the home page; the full room when that shelf is not
     under you. Both are the notes, at two scales. */
  { key: "notes", label: "Notes", anchor: "notes", away: { to: "/blog" } },
  /*
   * The one item with no room of its own.
   *
   * There is no /contact route and there should not be — the ask is typeset
   * as the last plate of the collection, not filed as a page. So off the home
   * page this item is a route *plus* an id, and the jump is finished after the
   * route has painted; see `useAwayJump` in Nav.tsx.
   */
  { key: "contact", label: "Contact", anchor: "contact", away: { to: "/", anchor: "contact" } },
];

export const NAV_INDEX: readonly NavIndexItem[] = [...OBJECTS, ...TAIL];

/*
 * The routes, which are now the smaller half of the bar.
 *
 * They do not disappear — three rooms exist and all three have to be
 * reachable from the chrome — but they stop being the primary thing in it,
 * because in a collection the chrome's job is to say what is in the room, not
 * to list the building's floors. So they sit at the leading edge in the quiet
 * value, and the index owns the centre.
 *
 * The labels are "All work" and "All notes" rather than "Projects" and
 * "Notes", and that is the whole point of the distinction rather than a
 * flourish. The index already contains an item called Notes, which jumps to
 * the notes shelf — four of however many notes exist. Two links a hundred
 * pixels apart both reading "Notes" and going to different places is the kind
 * of thing that makes a reader stop trusting a nav. "All notes" says which of
 * the two is the room.
 *
 * "Home" is here because the wordmark is gone. A two-letter monogram over a
 * page whose first screen sets the full name in display type was a second,
 * worse answer to a question already answered, and the trip it offered — back
 * to the top — is a link like any other and reads better as a word.
 */
export type NavRoute = { to: string; label: string };

export const NAV_ROUTES: readonly NavRoute[] = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "All work" },
  { to: "/blog", label: "All notes" },
];
