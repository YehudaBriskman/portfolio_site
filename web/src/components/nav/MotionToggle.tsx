import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "../Nav.module.css";

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
 * with a state, and the label changes with it, so the state is readable for
 * anyone the attribute does not reach.
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
  const label = paused ? "Play motion" : "Pause motion";

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
          aria-label={label}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={10} className={styles.tip}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
