import type { ReactNode } from "react";
import styles from "@/components/cards/PaperCard.module.css";

/**
 * The elements a card is allowed to be.
 *
 * Closed, like every other polymorphic wrapper here: a card is a block that
 * owns a piece of content, so the list is the elements that can honestly say
 * so. `form` is deliberately absent — a form needs its handlers, and widening
 * this component's props to carry them would make it a generic box with a
 * border rather than a card.
 */
export type PaperCardTag = "article" | "div" | "section" | "aside" | "li";

export type PaperCardProps = {
  children: ReactNode;
  as?: PaperCardTag;
  /**
   * Opaque fill instead of the translucent default.
   *
   * Required wherever cards overlap — the stacking deck — because the shared
   * `.card-paper` wash lets whatever is behind it through, and what is behind
   * a stacked card is another card.
   */
  solid?: boolean;
  /**
   * Drop the card's own padding so a child can carry it instead.
   *
   * For a card that is entirely one link: the anchor has to fill the card, or
   * the border promises a target the reader can only hit in the middle.
   */
  flush?: boolean;
  /** For a card that is a landmark in its own right — the `aside` beside the
   *  contact form — so the region is announced rather than being an unnamed
   *  complementary one. */
  "aria-label"?: string;
  className?: string;
};

/*
 * A card: the unit the page is made of on this ground.
 *
 * Thin on purpose. The surface belongs to `.card-paper` in index.css so that
 * every card on the site — these, the project cards, the note cards — changes
 * together; this component adds the inset, the measured ink, and the one
 * decision `.card-paper` cannot make for itself, which is whether the card is
 * see-through.
 */
export default function PaperCard({
  children,
  as = "div",
  solid = false,
  flush = false,
  "aria-label": ariaLabel,
  className = "",
}: PaperCardProps) {
  const Tag = as;
  const fill = solid ? ` ${styles.solid}` : "";
  const pad = flush ? ` ${styles.flush}` : "";

  return (
    <Tag aria-label={ariaLabel} className={`card-paper ${styles.card}${fill}${pad} ${className}`}>
      {children}
    </Tag>
  );
}
