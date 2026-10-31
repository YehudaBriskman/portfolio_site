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
 * Thin on purpose. The border, the shadow and the lift belong to `.card-paper`
 * in index.css so that every card on the site — these, the project cards, the
 * note cards — changes together; this component adds the inset, the measured
 * ink, the corner and the resting colour.
 *
 * The `solid` variant this used to carry is gone. It existed because
 * `.card-paper` is translucent and a translucent card in a pile lets the card
 * underneath read straight through it; every card is now painted with an
 * opaque fill — the same composited colour, or one of the five washes — so
 * there is no longer a see-through state for a variant to opt out of.
 */
export default function PaperCard({
  children,
  as = "div",
  flush = false,
  "aria-label": ariaLabel,
  className = "",
}: PaperCardProps) {
  const Tag = as;
  const pad = flush ? ` ${styles.flush}` : "";

  return (
    <Tag aria-label={ariaLabel} className={`card-paper ${styles.card}${pad} ${className}`}>
      {children}
    </Tag>
  );
}
