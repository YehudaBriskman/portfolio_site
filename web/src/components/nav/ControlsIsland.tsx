import styles from "../Nav.module.css";
import LanguageMenu from "./LanguageMenu";
import MotionToggle from "./MotionToggle";
import type { LocaleCode } from "./locale";

/**
 * Everything the chrome lets you change about how the site behaves, as
 * opposed to where you are in it.
 *
 * One object rather than four loose props: these four always travel together
 * and are also handed to the mobile sheet, so naming the bundle once keeps
 * the two call sites from drifting apart a prop at a time.
 */
export type NavControls = {
  locale: LocaleCode;
  onSelectLocale: (code: LocaleCode) => void;
  motionPaused: boolean;
  onToggleMotion: () => void;
};

/**
 * The right island.
 *
 * A `group` rather than a `nav`, and that distinction is the reason this is a
 * third island instead of two more items on the end of the centre one. A
 * language picker and a motion switch are not destinations; filing them under
 * a navigation landmark makes a screen reader announce two settings as part
 * of the site map, and makes "skip navigation" skip them.
 */
export default function ControlsIsland({ controls }: { controls: NavControls }) {
  return (
    <div
      className={`${styles.island} ${styles.sideIsland}`}
      role="group"
      aria-label="Site controls"
    >
      <LanguageMenu value={controls.locale} onSelect={controls.onSelectLocale} />
      <MotionToggle paused={controls.motionPaused} onToggle={controls.onToggleMotion} />
    </div>
  );
}
