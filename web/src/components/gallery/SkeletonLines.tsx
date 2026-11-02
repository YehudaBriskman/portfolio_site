import type { CSSProperties } from "react";
import styles from "@/components/gallery/Skeleton.module.css";

/*
 * A run of lines, standing in for a block of text that has not arrived.
 *
 * This is the whole of what a skeleton on this site is made of, and the one
 * property worth stating twice: **it contains no height.** Each line is an
 * empty block carrying a zero-width space, so its box is one line box of
 * whatever type step the element it is placed inside is set in. Put three of
 * these inside the element that will hold the real heading and the block is
 * exactly as tall as that heading wrapped to three lines — at the reader's
 * width, in the reader's text size, after the next edit to the type scale.
 *
 * That is the difference between this and the three hand-rolled placeholders
 * it replaced, all of which were `h-3`/`h-8`/`height: 1.25rem` literals and
 * all of which were the wrong height. A number agrees with the type scale on
 * the day it is written. A line box is the type scale.
 *
 * The caller still owns two facts this cannot know — what element the real
 * text is in, and how many lines it runs to — and they are the two things a
 * skeleton can get wrong. The call sites in this repository state where their
 * counts were counted.
 */

export type SkeletonLinesProps = {
  /** How many lines the real text runs to at this width. */
  lines?: number;
  /**
   * The width of the last line, overriding the default below.
   *
   * For a block whose shape is known to be different from ordinary prose —
   * a field row of short capsules, a date line. Any CSS length or
   * percentage.
   */
  tail?: string;
  className?: string;
};

/**
 * The width of a line by its position, and nothing about the height.
 *
 * In a column these are a drawing rather than a measurement: a line is a
 * block box stacked on the one above it, so how far along it the ink runs
 * cannot move anything. They are chosen so that a block reads as text — a
 * wrapped block fills every line but its last, and a block that fits on one
 * line fills neither, because a sentence that happens to be short is short
 * rather than ragged.
 *
 * **The exception is a line in a wrapping flex row**, where the width
 * decides whether the row is one line tall or two and is therefore load
 * bearing. That is what `tail` is for, and the measurement behind the one
 * caller that uses it is on `FIELD_WIDTHS` in `LabelSkeleton.tsx`.
 *
 * Stated as constants and not randomised. A width that re-rolls on every
 * render is a placeholder that twitches while it waits, and six cards in a
 * row drawing from the same generator look like a rendering fault.
 */
const SOLO = "78%";
const TAIL = "58%";

function widthAt(i: number, total: number, tail: string | undefined): string {
  if (i < total - 1) return "100%";
  return tail ?? (total === 1 ? SOLO : TAIL);
}

export default function SkeletonLines({ lines = 1, tail, className = "" }: SkeletonLinesProps) {
  const n = Math.max(1, lines);

  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={`${styles.line} ${className}`}
          /*
            A stable hook for a caller's own stylesheet, in the markup for
            the same reason `ObjectLabel` writes `data-kind` rather than
            leaving a rule to count with `:nth-child()`.

            A region whose layout changes under one of the off-switches
            changes how many lines its text wraps to, and the only thing
            that can say so is the stylesheet that already switches that
            layout — which is in another module and cannot see a scoped
            class name. The notes shelf is the one caller that needs it: its
            card is 302px wide as a shelf and the full page measure as the
            fallback list, so the name and the fact wrap to two lines in the
            first and one in the second.
          */
          data-sk-line=""
          style={{ "--sk-w": widthAt(i, n, tail) } as CSSProperties}
        />
      ))}
    </>
  );
}
