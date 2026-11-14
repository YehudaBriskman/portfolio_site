import { useRef, type KeyboardEvent } from "react";
import styles from "@/components/ui/ControlBar.module.css";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconButton,
  type ControlIcon,
  type ControlSize,
  type ControlTone,
  type ShowLabel,
} from "@/components/ui/IconButton";

/*
 * A bar of icon controls that collapses by priority.
 *
 * Only `max` controls are drawn; the rest go into a "More" menu (the shared
 * dropdown-menu), lowest `priority` first. The drawn ones keep the order the
 * caller wrote them in, as do the menu's, so the bar never reshuffles when a
 * count changes. Ties keep the earlier item. Apple's toolbar guidance and the
 * APG agree: few controls, one prominent, the rest one tap away.
 *
 * `label` names the toolbar and `moreLabel` names the overflow button; both
 * are the caller's words (the kit has none of its own). Arrow keys, Home and
 * End move between the controls, mirrored in a right-to-left page.
 */

export interface ControlItem {
  id: string;
  icon: ControlIcon;
  label: string;
  /** Higher stays on the bar longer. Default 0. */
  priority?: number;
  showLabel?: ShowLabel;
  tone?: ControlTone;
  pressed?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface ControlBarProps {
  /** Accessible name of the toolbar. */
  label: string;
  /** Name of the overflow button. */
  moreLabel: string;
  /** Icon of the overflow button; the kit draws three dots when omitted. */
  moreIcon?: ControlIcon;
  items: ControlItem[];
  /** How many controls to draw before the overflow. Default: all. */
  max?: number;
  size?: ControlSize;
  density?: "compact" | "comfortable";
  className?: string;
}

const Dots: ControlIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

/** Which items stay on the bar: the `max` highest priorities, ties to the earlier. */
function splitByPriority(items: ControlItem[], max: number) {
  if (items.length <= max) return { shown: items, hidden: [] as ControlItem[] };
  const keep = new Set(
    items
      .map((it, i) => ({ it, i }))
      .sort((a, b) => (b.it.priority ?? 0) - (a.it.priority ?? 0) || a.i - b.i)
      .slice(0, Math.max(0, max))
      .map((x) => x.it.id),
  );
  return { shown: items.filter((i) => keep.has(i.id)), hidden: items.filter((i) => !keep.has(i.id)) };
}

export function ControlBar({
  label,
  moreLabel,
  moreIcon = Dots,
  items,
  max = Infinity,
  size = "md",
  density = "comfortable",
  className = "",
}: ControlBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { shown, hidden } = splitByPriority(items, max);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const root = ref.current;
    if (!root || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const btns = Array.from(root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const at = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const rtl = getComputedStyle(root).direction === "rtl";
    const step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const next = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (at + step + btns.length) % btns.length;
    e.preventDefault();
    btns[next]?.focus();
  };

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={label}
      data-density={density}
      className={`${styles.bar} ${className}`.trim()}
      onKeyDown={onKeyDown}
    >
      {shown.map((it) => (
        <IconButton
          key={it.id}
          icon={it.icon}
          label={it.label}
          size={size}
          tone={it.tone}
          showLabel={it.showLabel}
          pressed={it.pressed}
          disabled={it.disabled}
          onClick={it.onSelect}
        />
      ))}
      {hidden.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton icon={moreIcon} label={moreLabel} size={size} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hidden.map((it) => (
              <DropdownMenuItem key={it.id} disabled={it.disabled} onSelect={() => it.onSelect?.()}>
                <it.icon className={styles.menuIcon} aria-hidden="true" />
                {it.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
