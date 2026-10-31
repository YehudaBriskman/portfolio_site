import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "../Nav.module.css";
import { PROFILES } from "./social";

/**
 * Where to find me that is not this site, as marks.
 *
 * Mark-only, and that is now an argument about the bar rather than about
 * width. The bar has one voice for anything you can go to — display face,
 * sentence case, a pill — and it is spent on the index, because the index is
 * what the bar is for. Two more words in that voice at the trailing edge
 * would read as two more objects in the collection, which GitHub and LinkedIn
 * are not: they are the same person, elsewhere. A logotype says that without
 * joining the sentence.
 *
 * The names are not lost. Every mark carries an `aria-label`, which is what a
 * screen reader announces, and a tooltip, which is what a hovering pointer
 * gets. Neither is load-bearing for the other, and the label is not optional:
 * a path with no accessible name announces as "link" and the reader has to
 * follow it to find out where it went.
 *
 * A plain anchor rather than the shadcn button these used to be. The button
 * was carrying a `glass` variant written for a translucent dark island and
 * every one of its colours was being overridden in `Nav.module.css` anyway;
 * what was left was a pill shape and a hover wash, which is four lines of CSS
 * and not a dependency.
 */
export default function ElsewhereMarks() {
  return (
    <ul className={styles.markRow}>
      {PROFILES.map(({ key, href, label, Icon }) => (
        <li key={key}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={href}
                aria-label={label}
                /* `noopener` is the one that matters — a tab opened with
                   `target="_blank"` can otherwise reach back through
                   `window.opener` — and `noreferrer` implies it, so both are
                   written out rather than relying on the implication. */
                target="_blank"
                rel="noreferrer noopener"
                className={styles.mark}
              >
                <Icon className={styles.markGlyph} />
              </a>
            </TooltipTrigger>
            <TooltipContent sideOffset={10} className={styles.tip}>
              {label}
            </TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}
