import { forwardRef, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from "react";
import styles from "@/components/ui/IconButton.module.css";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/*
 * The one icon control. `label` is required by the type: it is the accessible
 * name (aria-label) and the tooltip, so an icon-only button cannot be written
 * without a name. The words are the caller's; the kit owns none.
 *
 * Label policy: the word is drawn only to tell two similar icons apart, on the
 * one primary action of a bar, or where the icon is not universal (Edit,
 * Publish). `showLabel`: "never" (default), "from-md" (drawn from 768px up),
 * "always". Touch has no hover, so a tooltip is never the only cue for an
 * action that is not obvious; draw the word.
 */

export type ControlTone = "neutral" | "primary" | "danger";
export type ControlSize = "sm" | "md" | "lg";
export type ShowLabel = "never" | "from-md" | "always";
export type ControlIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children" | "type"> {
  icon: ControlIcon;
  /** Accessible name and tooltip. Required. */
  label: string;
  showLabel?: ShowLabel;
  tone?: ControlTone;
  size?: ControlSize;
  /** A toggle: sets aria-pressed. */
  pressed?: boolean;
  /** Extra content after the glyph (a badge). Hidden from the name. */
  badge?: ReactNode;
}

const cx = (...p: Array<string | false | undefined>) => p.filter(Boolean).join(" ");

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, showLabel = "never", tone = "neutral", size = "md", pressed, badge, className, ...rest },
  ref,
) {
  const drawn = showLabel !== "never";
  const button = (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      data-tone={tone}
      data-size={size}
      data-label={showLabel}
      className={cx(styles.btn, styles[tone], styles[size], drawn && styles.withLabel, className)}
    >
      <Icon className={styles.icon} aria-hidden="true" />
      {drawn && (
        <span className={cx(styles.label, showLabel === "from-md" && styles.fromMd)} aria-hidden="true">
          {label}
        </span>
      )}
      {badge != null && (
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      )}
    </button>
  );
  /* A drawn label is its own cue; the tooltip is for the icon-only form. */
  if (showLabel === "always") return button;
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
