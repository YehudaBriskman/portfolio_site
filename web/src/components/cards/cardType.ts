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
 * The neutral card surface is #F6F5EF, lighter than the #ECE8DC ground, so
 * solid ink gains against it (17.02:1 where the paper gives 15.17:1) and
 * anything set with a Tailwind alpha loses: `text-bone/70` measures 6.64:1 on
 * a card, while the same role as a solid --ink-soft measures 7.14:1. Naming
 * the four roles once is what stops the alpha habit returning a call site at
 * a time.
 */
export const cardType = {
  /** The card's own padding, for the anchor inside a `flush` card. */
  inset: styles.inset,
  /** The card's heading. --ink, 17.02:1 on a card, 15.73:1 on the dullest wash. */
  title: styles.title,
  /** Running text inside a card. --ink-soft, 7.14:1 / 6.60:1. */
  body: styles.body,
  /** Mono capitals: dates, labels, group notes, deck ordinals. --ink-soft, 7.14:1 / 6.60:1. */
  meta: styles.meta,
} as const;

/*
 * The colour a group of cards rests in.
 *
 * Put `cardCycle` on the element whose position in the group decides its hue.
 * The card inside inherits `--card-wash` from it. It is `nth-child` and
 * nothing else, so a list of cards carries it whether or not it is animated.
 * See the note in PaperCard.module.css.
 */
export const cardCycle = styles.cycle;
