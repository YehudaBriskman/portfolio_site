import styles from "@/components/cards/PaperCard.module.css";

/*
 * The type roles that live on a card.
 *
 * Its own module rather than a second export from PaperCard.tsx, because a
 * file that exports a component and a constant breaks React Fast Refresh for
 * that component — the lint rule says so and three files in this tree are
 * already carrying the warning.
 *
 * These exist at all because contrast on a card is not contrast on the page.
 * The card surface composites to #F6F5EF, lighter than the #ECE8DC ground, so
 * solid ink gains against it (17.00:1 where the paper gives 15.17:1) and
 * anything set with a Tailwind alpha loses: `text-bone/70` measures 6.64:1 on
 * a card, while the same role as a solid --ink-soft measures 7.13:1. Naming
 * the four roles once is what stops the alpha habit returning a call site at
 * a time.
 */
export const cardType = {
  /** The card's own padding, for the anchor inside a `flush` card. */
  inset: styles.inset,
  /** The card's heading. --ink, 17.00:1 on the card surface. */
  title: styles.title,
  /** Running text inside a card. --ink-soft, 7.13:1. */
  body: styles.body,
  /** Mono capitals: dates, labels, group notes, deck ordinals. --ink-soft, 7.13:1. */
  meta: styles.meta,
} as const;
