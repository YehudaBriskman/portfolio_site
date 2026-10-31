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
 */

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
              <Link to={item.away.to} onClick={(e) => onPick(item, e)} {...common}>
                {item.label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
