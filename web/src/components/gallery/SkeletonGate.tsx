import type { ReactNode } from "react";
import styles from "@/components/gallery/Skeleton.module.css";

/*
 * The box a loading state is painted in, and the 180ms before it is.
 *
 * Two jobs, and they are the same job from two directions. It holds the
 * region's height from the first frame, so nothing below it moves when the
 * placeholder appears or when the content replaces it; and it keeps the ink
 * off the screen for long enough that a response which was never slow leaves
 * no trace of having been loaded at all. The argument for the number, and
 * the reason the delay is on the paint rather than on the element, is on
 * `.gate` in `Skeleton.module.css`.
 *
 * It is a wrapper and not a prop on `LabelSkeleton` because the thing that
 * has to be gated is usually bigger than a label: on the notes shelf it is
 * six cards with their washes and their borders, on `/blog` it is a grid
 * with a lead card in it. Gating the labels alone would leave the card
 * chrome flashing on a fast response with nothing in it, which is the flash
 * this exists to prevent wearing a different shape.
 *
 * `aria-hidden` is here and not left to the caller, for the same reason
 * `LabelSkeleton` carries its own: a loading state has nothing to announce,
 * and the one polite region that says the content arrived belongs to the
 * caller and is not reproduced per placeholder.
 */
export type SkeletonGateProps = {
  children: ReactNode;
  /** The region's own layout classes. This component contributes none. */
  className?: string;
};

export default function SkeletonGate({ children, className = "" }: SkeletonGateProps) {
  return (
    <div className={`${styles.gate} ${className}`} aria-hidden="true">
      {children}
    </div>
  );
}
