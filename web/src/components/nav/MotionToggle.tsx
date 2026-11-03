import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "../Nav.module.css";
import { useChromeWords } from "@/i18n/chrome";

/**
 * Stop the page moving.
 *
 * The plates and the grain are gone, but the page still prints itself as you
 * descend it — every card, list row and rule arrives on a view-timeline wipe —
 * which is a lot of movement to put in front of someone who only wanted to
 * read about the work. The OS reduced-motion setting covers the people who
 * have already decided about every site; this covers the person who decides
 * here.
 *
 * `aria-pressed` rather than two buttons or a checkbox: it is one control
 * with a state.
 *
 * The accessible name does not change with that state, and that is a
 * correction (#99 audit). It used to flip to "Play motion" when pressed,
 * which a screen reader announced as "Play motion, toggle button, pressed"
 * — a sentence that says motion is playing at exactly the moment it is not.
 * A toggle's name names the thing being toggled and `aria-pressed` carries
 * the state; that is the WAI-ARIA APG's rule for toggle buttons, and why it
 * has the rule. The sighted reader still gets the change twice: the icon
 * swaps to Play, and the tooltip says what a press will do next.
 *
 * Presentational, with the state and the stored preference in
 * `useMotionPaused`, because this button is rendered both in the controls
 * island and in the mobile sheet.
 */
export default function MotionToggle({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: () => void;
}) {
  const w = useChromeWords();
  const tip = paused ? w.motionPaused : w.pauseMotion;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="glass"
          size="islandIcon"
          /* `controlIcon` squares it off. The `islandIcon` size is 44px wide,
             which was the old island's target; in the bar the pill is 38px and
             the target is grown outwards instead. See `.control` in
             Nav.module.css. */
          className={`${styles.control} ${styles.controlIcon}`}
          onClick={onToggle}
          aria-pressed={paused}
          aria-label={w.pauseMotion}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={10} className={styles.tip}>
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
