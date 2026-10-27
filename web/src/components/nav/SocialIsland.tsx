import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "../Nav.module.css";
import { ELSEWHERE } from "./social";

/**
 * The left island: where to find me that is not this site.
 *
 * Icon-only, because this island has to stay narrow enough that the centre
 * one is still centred on a 1024px laptop, and because these three marks are
 * the most recognisable objects on the page — a GitHub glyph needs no caption
 * the way "Approach" did. The names are not lost: every button carries an
 * `aria-label`, which is what a screen reader announces, and a tooltip, which
 * is what a hovering pointer gets. Neither is load-bearing for the other.
 */
export default function SocialIsland() {
  return (
    <nav className={`${styles.island} ${styles.sideIsland}`} aria-label="Elsewhere">
      <ul className={styles.iconRow}>
        {ELSEWHERE.map(({ key, href, label, Icon, external }) => (
          <li key={key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="glass" size="islandIcon" className={styles.control} asChild>
                  <a
                    href={href}
                    aria-label={label}
                    /* `noopener` is the one that matters — a tab opened with
                       `target="_blank"` can otherwise reach back through
                       `window.opener` — and `noreferrer` implies it, so both
                       are written out rather than relying on the implication. */
                    {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                  >
                    <Icon aria-hidden="true" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={10} className={styles.tip}>
                {label}
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </nav>
  );
}
