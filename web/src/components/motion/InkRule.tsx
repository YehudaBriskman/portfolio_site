import styles from "@/components/motion/InkRule.module.css";

export type InkRuleProps = {
  /**
   * Layout only. The rule has no measure of its own — it fills whatever box it
   * is given, so the caller decides whether it is a 2.5rem tick inside a card
   * or the full span between a heading and its eyebrow.
   */
  className?: string;
};

/*
 * A hairline that draws itself in as it reaches the viewport.
 *
 * Purely decorative and marked as such: it separates two things that are
 * already separated in the document order, so a screen reader gains nothing
 * from it and `aria-hidden` keeps it out of the way.
 *
 * `preserveAspectRatio="none"` plus `vector-effect="non-scaling-stroke"` is
 * the pair that makes one path work at every width: the geometry stretches to
 * the box, the ink does not, so a rule spanning 900px of a desktop heading and
 * one spanning 40px inside a card are the same weight of line.
 */
export default function InkRule({ className = "" }: InkRuleProps) {
  return (
    <svg
      className={`${styles.rule} ${className}`}
      viewBox="0 0 100 2"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <path
        className={styles.stroke}
        /* Four gentle control points rather than a straight `M0 1 H100`: the
           drift is sub-pixel once rendered, and it is the difference between
           a drawn line and a border. */
        d="M0 1.05 C 18 0.55, 34 1.55, 52 1 S 82 0.45, 100 0.95"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
