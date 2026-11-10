import styles from "../Nav.module.css";
import DisplayMenu, { type NavControls } from "./DisplayMenu";
import { useChromeWords } from "@/i18n/chrome";

export type { NavControls };

/**
 * The display control, at the trailing edge of the bar: one button that opens
 * one panel (`DisplayMenu`) holding language, theme, text size, contrast and
 * the motion pause. It was three triggers; see DisplayMenu for why they are
 * one.
 *
 * Still a `group` of its own and not part of a `nav`. A language picker and a
 * motion switch are not destinations; filing them under a navigation landmark
 * makes a screen reader announce settings as part of the collection, and makes
 * "skip navigation" skip them.
 *
 * It is a real flex box and not `display: contents`: an element with a role
 * and `display: contents` has been dropped from the accessibility tree
 * outright by shipping browsers, and the role is the reason this wrapper
 * exists.
 */
export default function Controls({ controls }: { controls: NavControls }) {
  const w = useChromeWords();
  return (
    <div role="group" aria-label={w.siteControls} className={styles.controlGroup}>
      <DisplayMenu controls={controls} />
    </div>
  );
}
