import type { CSSProperties, ReactNode } from "react";
import styles from "@/components/motion/FillSweep.module.css";

/**
 * The elements a swept line is allowed to be.
 *
 * A closed union rather than ElementType: the effect clips a gradient to the
 * glyphs of one run of text, so it only makes sense on an element that holds
 * text directly, and letting a caller pass `section` or `button` would quietly
 * produce an invisible element.
 */
export type FillSweepTag = "h1" | "h2" | "h3" | "h4" | "p" | "span";

export type FillSweepProps = {
  children: ReactNode;
  /** The real element to render. The effect is decoration; the outline is not. */
  as?: FillSweepTag;
  /**
   * The filled and unfilled ink, as any CSS colour.
   *
   * These are props rather than constants because the headings sit over
   * photographs: what reads as "not yet arrived" against a night plate is
   * invisible against a bright one. Left unset, the stylesheet's own
   * defaults apply.
   */
  on?: string;
  off?: string;
  className?: string;
};

/*
 * A heading whose fill sweeps across it as it scrolls into view.
 *
 * Not an opacity fade. A fade changes how present the whole line is, which on
 * a page of photographs reads as the compositor still catching up; a fill
 * moves an edge through the words, so the line arrives in the order it is
 * read. There is one gradient, clipped to the text, and one registered number
 * moving the boundary along it.
 *
 * Nothing here runs at scroll time. The component contributes a class and, at
 * most, two colours; the sweep itself is a view-timeline animation in the
 * stylesheet, which means it never touches the main thread and it is inert
 * under reduced motion without this file knowing about the preference.
 *
 * The page-level rules this sweep answers to — the two rules of scroll-driven
 * motion and the three off-switches — are in `docs/motion-contract.md`.
 */
export default function FillSweep({
  children,
  as = "h2",
  on,
  off,
  className = "",
}: FillSweepProps) {
  const Tag = as;

  /* Only the colours are written inline, so the stylesheet keeps the gradient
     and can override the whole thing from a media query without having to
     out-specify an inline declaration. */
  const ink = {
    ...(on ? { "--sweep-on": on } : {}),
    ...(off ? { "--sweep-off": off } : {}),
  } as CSSProperties;

  return (
    <Tag className={`${styles.sweep} ${className}`} style={ink}>
      {children}
    </Tag>
  );
}
