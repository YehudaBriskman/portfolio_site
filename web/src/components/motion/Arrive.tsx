import type { ReactNode } from "react";
import styles from "@/components/motion/Arrive.module.css";

/**
 * The elements an arrival may be. A closed union, as the ink wipe's was: it
 * has to be something that owns a block of content.
 */
export type ArriveTag = "div" | "section" | "article" | "aside" | "li" | "header";

export type ArriveProps = {
  children: ReactNode;
  as?: ArriveTag;
  className?: string;
  /** For an arrival that is itself a labelled region. */
  "aria-labelledby"?: string;
  "aria-label"?: string;
  "aria-busy"?: boolean;
};

/*
 * The site's one appear primitive (#251). It replaced `InkWipe`.
 *
 * WHAT IT DOES
 * ------------
 * A block rises the last 12px into its place as it comes up over the foot of
 * the window, scrubbed by the reader's scroll and undone on the way back up.
 * That is all the block itself does. The brand part of an arrival is a
 * `Ring` (motion/Ring.tsx) on the block's heading — the living line's
 * circle-around, drawn once round a dot by the same scroll — and a block
 * that has no heading simply rises.
 *
 * WHY NOT THE WIPE
 * ----------------
 * The wipe printed a block with a hard clip edge and a saturated band riding
 * that edge, so for the whole of its range the text was half hidden and then
 * painted over in red, yellow or blue. The owner (2026-11-03): "not on par
 * with the app brand. Remove it and switch to something better." The rule
 * this file is held to since: **an arrival never covers, clips or fades the
 * content.** No clip-path, no opacity, no pseudo-element over the box. The
 * text is at full ink from the first pixel of it that is on screen, and the
 * only thing that moves is where it sits, by 12px.
 *
 * WHY 12PX AND 240PX
 * ------------------
 * §5 of docs/motion-contract.md: past about 24px a rise reads as a slide,
 * and anything still moving once the reader has started on the block is in
 * the way. The range is the first 240px of the block's entry, or its whole
 * entry if it is shorter than that, so a block that is fully on screen has
 * always finished — a short page that cannot scroll far enough can never
 * leave one hanging 5px low.
 *
 * Like every scrubbed device here it contributes a class and nothing else:
 * no observer, no state, no effect. The stylesheet declares the motion
 * inside the three gates of §4 only, so reduced motion, Pause and an engine
 * without view timelines all render the arrived block by construction.
 */
export default function Arrive({ children, as = "div", className = "", ...label }: ArriveProps) {
  const Tag = as;
  return (
    <Tag className={`${styles.arrive} ${className}`.trimEnd()} {...label}>
      {children}
    </Tag>
  );
}
