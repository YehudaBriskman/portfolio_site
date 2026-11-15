import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ControlBar, type ControlItem } from "@/components/ui/ControlBar";
import type { ControlIcon } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { NAV_GLYPH } from "@/components/ui/icons";
import styles from "@/components/ui/PageHeader.module.css";

/*
 * The page header (A1, A2): one `h1`, one primary, one secondary, then More.
 *
 * Actions go through ControlBar, so the bar is one toolbar with one tab stop and
 * arrows that mirror in a right-to-left page. Only the primary and the secondary
 * are drawn; every `more` action sits behind the "..." menu, which is how a page
 * stays at one focal point (A1). The kit owns no words: `moreLabel`, every action
 * label, the back label and the description are the caller's.
 *
 * `back` is the path out ("Posts"), never the page's own title (A2). `status` is
 * ONE line under the title: a single status word or glyph, not a row of pills (A6).
 * `description` is a sentence that clamps to one line on a phone; the long version
 * is `info`, behind an info button, so no page opens with a paragraph.
 */

export interface PageAction {
  id: string;
  label: string;
  /** Required for `primary` and `secondary` (they are drawn); optional in `more`. */
  icon?: ControlIcon;
  onSelect: () => void;
  disabled?: boolean;
}

export interface PageHeaderProps {
  title: ReactNode;
  /** One sentence. Longer help goes in `info`. */
  description?: ReactNode;
  /** The long help, behind an info button next to the description. */
  info?: string;
  /** The way out of this page; a route or a handler. */
  back?: { label: string; href?: string; onSelect?: () => void };
  primary?: PageAction & { icon: ControlIcon };
  secondary?: PageAction & { icon: ControlIcon };
  more?: PageAction[];
  /** Name of the "..." button. Required when `more` is given. */
  moreLabel?: string;
  /** Accessible name of the action toolbar. */
  actionsLabel?: string;
  /** One line under the title: a status word, a path. */
  status?: ReactNode;
  /** Legacy (screens not yet moved to `primary`/`secondary`/`more`): free-form buttons beside the title. New code does not use it. */
  actions?: ReactNode;
  /** Legacy alias of `status`. */
  meta?: ReactNode;
}

const Nothing: ControlIcon = () => null;

export function PageHeader({
  title,
  description,
  info,
  back,
  primary,
  secondary,
  more = [],
  moreLabel = "",
  actionsLabel = "",
  status,
  actions,
  meta,
}: PageHeaderProps) {
  const items: ControlItem[] = [
    ...(primary
      ? [{ id: primary.id, icon: primary.icon, label: primary.label, tone: "primary" as const, showLabel: "always" as const, priority: 3, disabled: primary.disabled, onSelect: primary.onSelect }]
      : []),
    ...(secondary
      ? [{ id: secondary.id, icon: secondary.icon, label: secondary.label, showLabel: "always" as const, priority: 2, disabled: secondary.disabled, onSelect: secondary.onSelect }]
      : []),
    ...more.map((m) => ({ id: m.id, icon: m.icon ?? Nothing, label: m.label, priority: 0, disabled: m.disabled, onSelect: m.onSelect })),
  ];
  const drawn = (primary ? 1 : 0) + (secondary ? 1 : 0);
  const infoName = typeof title === "string" ? title : "";

  return (
    <header className={styles.head}>
      {back &&
        (back.href ? (
          <Link to={back.href} className={styles.back}>
            <Icon icon={NAV_GLYPH.back} size={16} mirrorInRtl />
            <span className={styles.backLabel}>{back.label}</span>
          </Link>
        ) : (
          <button type="button" className={styles.back} onClick={back.onSelect}>
            <Icon icon={NAV_GLYPH.back} size={16} mirrorInRtl />
            <span className={styles.backLabel}>{back.label}</span>
          </button>
        ))}
      <div className={styles.row}>
        <div className={styles.text}>
          <h1 className={`a-h1 ${styles.title}`}>{title}</h1>
          {(status ?? meta) && <div className={styles.status}>{status ?? meta}</div>}
          {description && (
            <div className={styles.descRow}>
              <p className={styles.desc} title={typeof description === "string" ? description : undefined}>
                {description}
              </p>
              {info && <InfoPopover label={infoName} text={info} />}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <ControlBar className={styles.actions} label={actionsLabel} moreLabel={moreLabel} items={items} max={drawn} />
        )}
        {actions && <div className={`a-page-actions ${styles.actions}`}>{actions}</div>}
      </div>
    </header>
  );
}
