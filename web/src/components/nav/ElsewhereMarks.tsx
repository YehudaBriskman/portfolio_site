import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "../Nav.module.css";
import { useProfiles } from "./social";

/**
 * Where to find me that is not this site, as marks.
 *
 * Mark-only, and that is an argument about the bar rather than about width.
 * The bar has one voice for anything you can go to — display face, sentence
 * case, a pill — and it is spent on the three rooms this site keeps. Two more
 * words in that voice at the trailing edge would read as two more rooms, which
 * GitHub and LinkedIn are not: they are the same person, elsewhere. A logotype
 * says that without joining the sentence.
 *
 * The argument has if anything got stronger since it was written, when the
 * voice was spent on an index of eight objects and these two would have been
 * the ninth and tenth. A bar with three words in it has room for five, and the
 * reason not to is still that the two extra would be the wrong kind of thing.
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
  const profiles = useProfiles();
  return (
    <ul className={styles.markRow}>
      {profiles.map(({ key, href, label, Icon }) => (
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
