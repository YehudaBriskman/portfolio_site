import { useEffect, useRef, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import styles from "../Nav.module.css";
import type { NavIndexItem } from "./navIndex";
import type { CollectionIndexState } from "./useCollectionIndex";

/*
 * The index itself: the objects in the room, in the order the room puts them.
 *
 * Two destinations, one item
 * --------------------------
 * An item is never hidden and never dead. If the object's plate is in this
 * document the item is an in-page jump to it; if it is not — because the page
 * shows four of six, or because you are reading a note — the item is a link
 * to where that object lives. Same label, same position, same voice; only the
 * trip changes. The two alternatives are both worse: hiding the items whose
 * plate is absent gives the reader a bar that loses entries as they move
 * around the site, and pointing every item at the collection page gives six
 * links to one place.
 *
 * `aria-current="location"` and not `"page"`
 * ------------------------------------------
 * "page" means this link is the document you are reading. These links are not
 * documents; they are positions within one, and "location" is the token ARIA
 * defines for exactly that — the current place in an environment. The routes
 * at the leading edge of the bar still use "page", so a screen reader
 * distinguishes "the room you are in" from "the object you are at", which is
 * a real difference and the whole reason the bar has two groups.
 *
 * The affordance the two destinations were missing
 * -----------------------------------------------
 * An audit measured what "only the trip changes" costs: of the eight items in
 * `nav[aria-label="Index"]`, six were in-page anchors and two were route
 * changes, with nothing whatsoever marking which was which. A keyboard user
 * walking the index was silently navigated off the page on items five and six.
 *
 * The decision in `navIndex.ts` is not the bug and is not undone — hiding the
 * absent items, or pointing them all at the collection page, are both worse,
 * and that is argued above. What was missing is the one thing that makes the
 * design honest: an item that will take you somewhere else says so, in the
 * accessible name and on the screen. See `AWAY_NOTE` and `.awayMark`.
 */

/**
 * What an item adds to its accessible name when the trip leaves this page.
 *
 * One string for every away item rather than a phrasing per case, and the
 * phrasing is about the object rather than about the link. "Icaros, opens its
 * own page" was the first draft and it is wrong for one of the eight: Contact
 * has no page of its own — it is the last plate of the collection, by design —
 * so from a note its item is a route change *plus* a scroll, and "its own
 * page" would be a promise the site deliberately does not keep. "On another
 * page" is true of all eight, which is why it can be derived from `present`
 * instead of written out per item and kept in step by hand.
 *
 * The comma earns its place: most screen readers do not speak it and all of
 * them pause on it, so the name arrives as a name and then a note about it
 * rather than as one seven-syllable label.
 */
const AWAY_NOTE = ", on another page";

/**
 * The mark that says the same thing to someone looking at it.
 *
 * A chevron, and the first version was `→` — the site's own "onward" glyph out
 * of `ui/Action.tsx`, borrowed rather than invented, which is the right
 * instinct and the wrong mark here. It was measured and it does not fit.
 *
 * The index's track is 920px wide at 1440. The eight labels set at 819px, and
 * a note page is the one route where all eight items are away items, so the
 * arrow was charged eight times: 19px each — a 14px glyph plus its 5px of
 * air — taking the strip to 971px. The strip is built to scroll and that is a
 * blessed state below 1336px, but this pushed a page that had 100px of room to
 * spare into scrolling, with "Contact" clipped mid-word at a desktop width.
 * Shrinking the arrow does not recover it: 8 x 19 has to come down to 8 x 12.6,
 * which is a 9px arrow at half ink, which is not an affordance.
 *
 * `›` costs 9px and the eight away items set at 902px, so the index fits. It
 * is also the better mark for the job rather than merely the cheaper one: in a
 * list of destinations a chevron is the disclosure indicator every reader has
 * met, which is exactly the claim being made — there is more of this object,
 * elsewhere. The site already uses one for that meaning (see the note in
 * `marks.tsx`, and the submenu mark in `ui/dropdown-menu.tsx`), so this is
 * still a borrowing and not a ninth sign.
 *
 * `aria-hidden`, because the accessible name already carries the fact in
 * words. A mark announced between an object's name and a phrase about it is
 * the version of this that makes the bar louder for the reader it was supposed
 * to help.
 */
const AWAY_GLYPH = "›";

export type IndexLinksProps = {
  items: readonly NavIndexItem[];
  state: CollectionIndexState;
  /**
   * `bar` is the one line across the top; `sheet` is the stacked list a phone
   * opens. One component, because they are the same index: two
   * implementations would be two chances to disagree about what is in the
   * room, and the sheet is the only index a phone gets.
   */
  variant: "bar" | "sheet";
  /** Whether movement is allowed — the OS preference and the Pause control. */
  settle: boolean;
  /**
   * Activation. The caller owns the jump, because jumping is where focus has
   * to move and the chrome is also what has to close.
   *
   * @returns nothing; the caller calls `preventDefault` itself when it has
   * handled the trip, so an id that has gone missing still falls through to
   * the browser's own fragment navigation rather than becoming a dead click.
   */
  onPick: (item: NavIndexItem, event: MouseEvent<HTMLAnchorElement>) => void;
};

export default function IndexLinks({ items, state, variant, settle, onPick }: IndexLinksProps) {
  const strip = useRef<HTMLUListElement>(null);
  const marked = useRef<HTMLAnchorElement | null>(null);
  /* Read off the object rather than used through it, so the effect below
     depends on the value that changed and not on a container the lint rule
     cannot see inside. */
  const currentKey = state.current;

  /*
   * Keep the marked object in view when the strip is too narrow to hold the
   * whole index.
   *
   * Below 1336px the eight objects do not fit across the bar and the strip
   * scrolls instead — which is the one collapse an index may have, because nothing is
   * removed from it. The cost of scrolling is that the marked item can be off
   * to one side while the reader is standing on it, so the strip follows.
   *
   * Three guards, each for a thing that went wrong: it does nothing when the
   * strip is not actually scrollable (otherwise `scrollTo` on a non-scrolling
   * box still fires a scroll event), nothing when the item is already fully
   * visible (otherwise every crossing nudged a strip that was already right),
   * and it moves `scrollLeft` rather than calling `scrollIntoView`, which
   * walks up to the document and would have scrolled the page the reader is
   * in the middle of scrolling themselves.
   */
  useEffect(() => {
    if (variant !== "bar") return;
    const box = strip.current;
    const el = marked.current;
    if (!box || !el) return;
    if (box.scrollWidth <= box.clientWidth + 1) return;

    const left = el.offsetLeft - box.scrollLeft;
    if (left >= 0 && left + el.offsetWidth <= box.clientWidth) return;

    box.scrollTo({
      left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2,
      behavior: settle ? "smooth" : "auto",
    });
  }, [currentKey, variant, settle, items]);

  const list = variant === "bar" ? styles.indexStrip : styles.sheetList;
  const link = variant === "bar" ? styles.indexLink : styles.sheetLink;

  return (
    <ul ref={strip} className={list}>
      {items.map((item) => {
        const here = state.present.has(item.key);
        const current = here && currentKey === item.key;

        /* The href is the real destination and not a `#` with a handler on
           it: a middle-click, a copied link and a reader who has turned
           JavaScript off all have to arrive at the same place as a plain
           click. */
        const common = {
          className: link,
          "aria-current": current ? ("location" as const) : undefined,
          ref: current ? marked : undefined,
        };

        return (
          <li key={item.key}>
            {here ? (
              <a href={`#${item.anchor}`} onClick={(e) => onPick(item, e)} {...common}>
                {item.label}
              </a>
            ) : (
              /*
               * `aria-label`, and the visible label leads it.
               *
               * WCAG 2.5.3, Label in Name, is satisfied by the name *starting*
               * with the text on the screen: a reader who says "Icaros" has
               * said a prefix of this link's name, which is what voice control
               * needs. It is the same rule that made the language picker read
               * "EN — change language" rather than "Language: English", and the
               * reason the note is appended rather than substituted.
               *
               * The first draft put the note in an `sr-only` sibling span
               * instead, which is the usual advice and does not survive
               * measurement: the accessible name is the concatenation of each
               * child's contribution with every contribution trimmed, so a
               * leading space inside the span is discarded and the name
               * computes as "Icaroson another page" — verified against
               * dom-accessibility-api, which is the algorithm the test suite
               * and the browsers agree on. Nothing a text node can carry
               * guarantees the separator, so the separator is written here
               * where this component owns the whole string.
               *
               * The two halves cannot drift: both are `item.label`.
               */
              <Link
                to={item.away.to}
                onClick={(e) => onPick(item, e)}
                aria-label={`${item.label}${AWAY_NOTE}`}
                {...common}
              >
                {item.label}
                <span aria-hidden="true" className={styles.awayMark}>
                  {AWAY_GLYPH}
                </span>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
