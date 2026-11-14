import { useId, type ComponentType, type ReactNode } from "react";
import { ChevronRight, TriangleAlert, type LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { firstSentence } from "@/components/ui/settingsKit";
import styles from "@/components/ui/SettingsRow.module.css";

/*
 * One line in a settings list, in three kinds:
 *  - "switch": a label and a Switch that applies at once. The long help hides
 *    behind a separate 44px info button; the switch is described by the help's
 *    first sentence so a screen reader still hears the gist.
 *  - "value":  a label, the current value and a chevron; opens an editor.
 *  - "link":   an icon tile, a name, ONE live summary line and a chevron; it
 *    is how SettingsList shows a group.
 * The label is one line (ellipsis, full text in `title`). Only a warning is
 * ever shown as extra text, and it is announced.
 */

type Common = {
  id: string;
  label: string;
  /** The long help, behind the info button. Never rendered as a paragraph. */
  info?: string;
  /** Shown whenever it is set, in the attention tone, with a glyph. */
  warning?: string | null;
  disabled?: boolean;
  /** A small dot: this value has an unsaved change. */
  dirty?: boolean;
  as?: "div" | "li";
  className?: string;
};

export type SettingsRowProps = Common &
  (
    | { kind: "switch"; checked: boolean; onChange: (v: boolean) => void }
    | { kind: "value"; valueText: string; onOpen: () => void }
    | { kind: "link"; icon: LucideIcon | ReactNode; summary: string; onOpen: () => void; current?: boolean }
  );

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

function Tile({ icon }: { icon: LucideIcon | ReactNode }) {
  if (icon == null || typeof icon === "string" || typeof icon === "number" || (typeof icon === "object" && "type" in (icon as object))) {
    return <>{icon as ReactNode}</>;
  }
  const Icon = icon as ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean; focusable?: string }>;
  return <Icon size={18} strokeWidth={2} aria-hidden focusable="false" />;
}

export function SettingsRow(props: SettingsRowProps) {
  const uid = useId();
  const warnId = `${uid}-warn`;
  const descId = `${uid}-desc`;
  const { id, label, info, warning, disabled, dirty, as = "div", className } = props;
  const Root = as;

  const warn = warning ? (
    <div id={warnId} role="alert" className={styles.warning} data-sr-warning="">
      <TriangleAlert size={16} strokeWidth={2.25} aria-hidden="true" focusable="false" />
      <span>{warning}</span>
    </div>
  ) : null;

  const chevron = (
    <span data-sr-chevron="" className={styles.chevron}>
      <ChevronRight size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
    </span>
  );

  if (props.kind === "switch") {
    return (
      <Root className={cx(styles.row, className)} data-setting-id={id} data-dirty={dirty ? "true" : undefined}>
        <div className={styles.line}>
          <Switch
            id={`${uid}-sw`}
            label={label}
            checked={props.checked}
            onChange={props.onChange}
            disabled={disabled}
            describedBy={cx(info && descId, warning && warnId) || undefined}
          />
          {dirty && <span className={styles.dot} aria-hidden="true" />}
          {info && <InfoPopover label={label} text={info} />}
        </div>
        {info && (
          <span id={descId} className={styles.srOnly}>
            {firstSentence(info)}
          </span>
        )}
        {warn}
      </Root>
    );
  }

  if (props.kind === "value") {
    return (
      <Root className={cx(styles.row, className)} data-setting-id={id} data-dirty={dirty ? "true" : undefined}>
        <div className={styles.line}>
          <button
            type="button"
            className={styles.press}
            disabled={disabled}
            onClick={props.onOpen}
            aria-describedby={warning ? warnId : undefined}
          >
            <span className={styles.label} data-sr-label="" title={label}>
              {label}
            </span>
            <span className={styles.value} dir="auto">
              <bdi>{props.valueText}</bdi>
            </span>
            {chevron}
          </button>
          {info && <InfoPopover label={label} text={info} />}
        </div>
        {warn}
      </Root>
    );
  }

  return (
    <Root className={cx(styles.row, className)} data-settings-group={id}>
      <button
        type="button"
        className={cx(styles.press, styles.link)}
        disabled={disabled}
        onClick={props.onOpen}
        aria-current={props.current ? "true" : undefined}
        aria-describedby={warning ? warnId : undefined}
      >
        <span className={styles.tile} aria-hidden="true">
          <Tile icon={props.icon} />
        </span>
        <span className={styles.stack}>
          <span className={styles.label} data-sr-label="">
            {label}
          </span>
          <span className={styles.summary} data-sg-summary="" aria-live="polite">
            {props.summary}
          </span>
        </span>
        {warning && <TriangleAlert className={styles.flag} size={18} strokeWidth={2.25} aria-hidden="true" focusable="false" />}
        {chevron}
      </button>
      {warn}
    </Root>
  );
}
