import type { ReactNode } from "react";
import styles from "@/components/motion/InkWipe.module.css";

/**
 * The elements a wipe is allowed to be.
 *
 * A closed union rather than `ElementType`, for the reason IrisPanel gives: a
 * clip path crops whatever it is applied to, so the element has to be one that
 * can own a block of content. `form` is in the list because a contact panel is
 * a form and the document outline should say so.
 */
export type InkWipeTag =
  | "div"
  | "article"
  | "section"
  | "aside"
  | "figure"
  | "li"
  | "form";

/** Which way the nib travels. Up is the default; right is for wide, short things. */
export type InkWipeDirection = "up" | "right";

export type InkWipeProps = {
  children: ReactNode;
  as?: InkWipeTag;
  direction?: InkWipeDirection;
  className?: string;
};

/*
 * An element that is printed onto the page as it arrives.
 *
 * The gesture is a hard-edged stroke, not a dissolve. A fade is a statement
 * about how *present* something is and it always reads as the browser being
 * slow; a hard edge crossing the box is a statement about ink reaching paper,
 * which is the only story this ground tells. The edge is raked a little so it
 * reads as a nib rather than as a loading bar.
 *
 * Nothing here runs at scroll time, and there is deliberately no observer and
 * no state. A view timeline already knows exactly where the element sits in
 * the scrollport; an IntersectionObserver reproducing that would only ever be
 * a frame behind it, and would put a scroll listener back on a site that has
 * none left. The component contributes class names and nothing else, which is
 * also what lets the stylesheet switch the whole effect off from an at-rule.
 */
export default function InkWipe({
  children,
  as = "div",
  direction = "up",
  className = "",
}: InkWipeProps) {
  const Tag = as;
  const dir = direction === "right" ? ` ${styles.right}` : "";

  return <Tag className={`${styles.wipe}${dir} ${className}`}>{children}</Tag>;
}
