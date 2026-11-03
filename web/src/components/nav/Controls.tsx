import styles from "../Nav.module.css";
import LanguageMenu from "./LanguageMenu";
import MotionToggle from "./MotionToggle";
import ThemeMenu from "./ThemeMenu";
import type { LocaleCode } from "./locale";

/**
 * Everything the chrome lets you change about how the site behaves, as
 * opposed to where you are in it.
 *
 * One object rather than four loose props: these four always travel together
 * and are also handed to the mobile sheet, so naming the bundle once keeps the
 * two call sites from drifting apart a prop at a time.
 */
export type NavControls = {
  locale: LocaleCode;
  onSelectLocale: (code: LocaleCode) => void;
  motionPaused: boolean;
  onToggleMotion: () => void;
};

/**
 * The controls, at the trailing edge of the bar.
 *
 * A `group` and not a `nav`, and that distinction is why they are a group of
 * their own rather than two more items on the end of the index. A language
 * picker and a motion switch are not destinations; filing them under a
 * navigation landmark makes a screen reader announce two settings as part of
 * the collection, and makes "skip navigation" skip them.
 *
 * No box of its own any more. These sat in a third ruled island, and the three
 * islands are one bar now — the grouping that island was drawing is done by
 * position and by the hairline before the marks, which is what a bar does
 * instead of drawing three boxes on a page that is already a page.
 *
 * It is still a real flex box and not `display: contents`, which would have
 * been the tidier way to let the two controls sit in the trailing group's own
 * row. An element with a role and `display: contents` has been dropped from
 * the accessibility tree outright by shipping browsers, and the role is the
 * entire reason this wrapper exists.
 */
export default function Controls({ controls }: { controls: NavControls }) {
  return (
    <div role="group" aria-label="Site controls" className={styles.controlGroup}>
      <LanguageMenu value={controls.locale} onSelect={controls.onSelectLocale} />
      <ThemeMenu />
      <MotionToggle paused={controls.motionPaused} onToggle={controls.onToggleMotion} />
    </div>
  );
}
