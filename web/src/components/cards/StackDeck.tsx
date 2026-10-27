import { Children, type CSSProperties, type ReactNode } from "react";
import styles from "@/components/cards/StackDeck.module.css";
/* Sticky does not work on this page without it. See the file. */

export type StackDeckProps = {
  /** One card per child. Each is given its own slot and its index in the pile. */
  children: ReactNode;
  /** An accessible name for the list, since the pile is a list of things. */
  "aria-label"?: string;
  className?: string;
};

/*
 * Cards that pile up on one another as the reader scrolls.
 *
 * The component's entire job is structural: wrap each child in a slot and
 * tell that slot where it sits in the deck. Everything that moves is in the
 * stylesheet — `position: sticky` for the pile, one scroll-driven animation
 * for the settle — because both of the conditions that have to switch the
 * motion off are at-rules, and neither an inline style nor a Tailwind
 * utility can carry one.
 *
 * `Children.toArray` rather than asking the caller for an array: it flattens
 * fragments and drops the nulls a conditional render leaves behind, so the
 * index each slot receives is its real position in the pile rather than its
 * position in the caller's source.
 *
 * An ordered list because the order is the content. These are numbered
 * principles read top to bottom, and a reader who never sees the stacking —
 * reduced motion, a short screen, a browser without scroll-driven
 * animation — still gets them as a numbered list, which is the whole fallback
 * story in one element choice.
 */
export default function StackDeck({
  children,
  "aria-label": ariaLabel,
  className = "",
}: StackDeckProps) {
  const slots = Children.toArray(children);

  return (
    <ol aria-label={ariaLabel} className={`${styles.deck} ${className}`}>
      {slots.map((child, i) => {
        /* Children.toArray stamps a stable key on every child it returns;
           reusing it keeps React's identity for the card rather than
           inventing a second one from the index. */
        const stamped =
          typeof child === "object" && child !== null && "key" in child ? child.key : null;

        return (
          <li
            key={stamped ?? i}
            className={styles.slot}
            style={{ "--deck-i": i } as CSSProperties}
          >
            {child}
          </li>
        );
      })}
    </ol>
  );
}
