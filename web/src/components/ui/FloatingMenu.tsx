import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { NAV_GLYPH } from "@/components/ui/icons";
import styles from "@/components/ui/FloatingMenu.module.css";

/*
 * The phone's floating glass controls, as one shared piece (#886): the menu circle and the back pill.
 * They take the public phone site's box (`--float-h` tall, `--float-top` from the top with the safe
 * area in it, `--float-z`, one hairline, one shadow, the circle fixed at the inline-end edge) and its
 * two-bar glyph that crosses into an X, so the admin and the public site read as one product.
 *
 * The component owns the look and the behaviour that is the same everywhere: a 44px+ circle, the
 * glass material, the safe-area insets in both directions, RTL by logical properties, and a motion
 * that only runs for a viewer who has not asked for less. The caller owns what it opens
 * (`aria-controls`) and what it says (`label`), so the admin passes its nav tree and its words and
 * nothing here knows either. The public Nav keeps its own circle (a stylesheet under repair by
 * another change); the two share the tokens above, not the rule text.
 */

export type FloatingCircleProps = {
  open: boolean;
  /** The id of the panel the circle opens. */
  controls: string;
  /** The accessible name; the circle draws no word. */
  label: string;
  onClick: () => void;
};

export const FloatingCircle = forwardRef<HTMLButtonElement, FloatingCircleProps>(function FloatingCircle({ open, controls, label, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.circle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      data-floating-circle=""
      onClick={onClick}
    >
      <span className={styles.bars} aria-hidden="true" />
    </button>
  );
});

export type FloatingPillProps = {
  to: string;
  /** What is drawn: the section the link goes back to. */
  label: string;
  /** The accessible name; it contains `label` (WCAG 2.5.3). */
  name: string;
};

/** The way back: one link, an arrow that mirrors in Hebrew, and the name of where it goes. */
export function FloatingPill({ to, label, name }: FloatingPillProps) {
  return (
    <Link to={to} className={styles.pill} aria-label={name} data-floating-pill="">
      <Icon icon={NAV_GLYPH.back} size={20} mirrorInRtl className={styles.arrow} />
      <span className={styles.name} dir="auto">
        {label}
      </span>
    </Link>
  );
}
