import type { ReactNode } from "react";
import styles from "@/components/motion/IrisPanel.module.css";

/**
 * The elements a panel is allowed to be.
 *
 * Narrow on purpose. An iris clips whatever it wraps, so the element has to be
 * one that can own a block of content; `as` exists to keep the document
 * outline honest when a panel is really a figure or a section, not to turn
 * this into a general-purpose polymorphic box.
 */
export type IrisPanelTag = "div" | "figure" | "section" | "aside" | "li";

export type IrisPanelProps = {
  children: ReactNode;
  as?: IrisPanelTag;
  className?: string;
};

/*
 * A panel that opens from its centre as it enters the viewport.
 *
 * Purely presentational and entirely declarative: the component adds a class
 * and nothing else. There is no observer, no ref and no state, because a view
 * timeline already knows where the element is relative to the scrollport —
 * and an IntersectionObserver doing the same job would only ever reproduce it
 * one frame late.
 *
 * The page-level rules this panel answers to, including why there is no
 * observer and what has to happen if anything in here is ever pinned, are in
 * `docs/motion-contract.md`.
 */
export default function IrisPanel({
  children,
  as = "div",
  className = "",
}: IrisPanelProps) {
  const Tag = as;

  return <Tag className={`${styles.panel} ${className}`}>{children}</Tag>;
}
