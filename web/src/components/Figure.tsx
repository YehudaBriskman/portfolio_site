import type { CSSProperties, ReactNode } from "react";
import styles from "@/components/Figure.module.css";
import { useHomeWords } from "@/i18n/pages";

/*
 * A picture, framed and captioned.
 *
 * The ground used to be a photograph and the images were the ground: four
 * full-bleed plates with the page read over the top of them. On paper that
 * arrangement has nothing left to mean, so every picture on the site is now
 * an object sitting on the page — a white mount, a border that is meant to
 * be seen, and a line underneath saying what you are looking at. That is
 * what `.figure-frame` in index.css draws; this component is what fills it
 * in, so that the caption is a caption everywhere rather than whatever each
 * call site felt like writing.
 *
 * The caption is information, not decoration. A plate number so a reader can
 * refer to one, what the picture is of, and — at the far end of the line —
 * one more fact the picture cannot say for itself, usually the year. Nothing
 * here is invented: every field is optional and an absent one prints
 * nothing rather than a placeholder.
 */
export type FigureProps = {
  /**
   * The plate number, printed as `FIG. 03`. Numbering runs across a whole
   * page rather than per component, so the caller owns it.
   */
  index?: number;
  /** What the picture shows. */
  caption: string;
  /** One more fact, set at the far end of the caption row. */
  note?: string;
  /** The picture: an `<img>`, a `<picture>`, a `<Shot>` or a `<Plate>`. */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export default function Figure({ index, caption, note, children, className = "", style }: FigureProps) {
  const w = useHomeWords();
  return (
    <figure className={`figure-frame ${styles.frame} ${className}`.trim()} style={style}>
      {children}
      <figcaption className={styles.caption}>
        {index !== undefined && (
          <span className={styles.index}>{w.figure}&nbsp;{String(index).padStart(2, "0")}</span>
        )}
        <span className={styles.what}>{caption}</span>
        {note && <span className={styles.note}>{note}</span>}
      </figcaption>
    </figure>
  );
}
