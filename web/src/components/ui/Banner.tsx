import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ICON, TONE_GLYPH } from "@/components/ui/icons";
import styles from "@/components/ui/Banner.module.css";

/*
 * A page-level message that outlasts the visit (A27): a campaign is paused, a
 * draft is waiting, the connection is down. A toast is for what an action just
 * did; a banner is for what is still true. It sits inline above the content (it
 * never floats or covers anything), carries at most one action, and can be
 * dismissed.
 *
 * The tone is a glyph and a bar as well as a colour, so it never rides on colour
 * alone: info is a circle-i, warning a triangle, danger a circle with a mark.
 * `danger` is an alert (read at once); the others are polite status text.
 *
 * `dismissKey` makes the dismissal remembered (localStorage, try/catch: it can be
 * unavailable, and then the banner simply comes back next visit). Without it, a
 * dismissal lasts until the page unmounts. `dismissLabel` is required with
 * `onDismiss` or `dismissKey`: the kit owns no words.
 */

export type BannerTone = "info" | "warning" | "danger";

export interface BannerProps {
  tone?: BannerTone;
  /** A short lead-in; the message follows it. */
  title?: string;
  children?: ReactNode;
  action?: { label: string; onSelect: () => void };
  onDismiss?: () => void;
  /** Remember the dismissal under this key. */
  dismissKey?: string;
  /** Name of the dismiss button. */
  dismissLabel?: string;
  className?: string;
}

const storeKey = (k: string) => `admin.banner.${k}`;

function wasDismissed(key?: string): boolean {
  if (!key) return false;
  try {
    return window.localStorage.getItem(storeKey(key)) === "1";
  } catch {
    return false;
  }
}

export function Banner({ tone = "info", title, children, action, onDismiss, dismissKey, dismissLabel = "", className = "" }: BannerProps) {
  const [gone, setGone] = useState(() => wasDismissed(dismissKey));
  if (gone) return null;
  const dismissible = Boolean(onDismiss || dismissKey);

  const dismiss = () => {
    setGone(true);
    if (dismissKey) {
      try {
        window.localStorage.setItem(storeKey(dismissKey), "1");
      } catch {
        /* storage blocked: the dismissal lasts for this visit only */
      }
    }
    onDismiss?.();
  };

  return (
    <div role={tone === "danger" ? "alert" : "status"} data-tone={tone} className={`${styles.banner} ${className}`.trim()}>
      <Icon icon={TONE_GLYPH[tone]} size={20} className={styles.glyph} />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
      {action && (
        <button type="button" className={styles.action} onClick={action.onSelect}>
          {action.label}
        </button>
      )}
      {dismissible && (
        <button type="button" className={styles.close} aria-label={dismissLabel} onClick={dismiss}>
          <Icon icon={ICON.close} size={20} />
        </button>
      )}
    </div>
  );
}
