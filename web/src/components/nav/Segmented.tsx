import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./DisplayMenu.module.css";

export type SegmentOption<V extends string> = {
  value: V;
  label: string;
  /** Drawn above the label; decorative, the label names the option. */
  icon?: ReactNode;
  /** The language the label is written in, when it is not the page's. */
  lang?: string;
  dir?: "ltr" | "rtl";
  /** Short text drawn inside the circle (a language code, an "A"); the label still names it. */
  glyph?: ReactNode;
};

/*
 * A segmented choice: one of a few, all visible at once.
 *
 * The WAI-ARIA radio group, written out: a `radiogroup` of `radio`s, the
 * checked one the only tab stop (roving tabindex), arrow keys moving the
 * choice and the focus together, Home/End to the ends. Native radios would do
 * the same, but not in a skin like this one without hiding the input and
 * redrawing it, which is the same amount of code with a worse accessibility
 * tree.
 *
 * Direction: Up/Down always go to the previous/next option; Left/Right follow
 * what the reader sees, so in a right-to-left page Right goes to the previous
 * one. The row itself lays out with `inline` logic and mirrors with no rule.
 *
 * The group is named by a visible label elsewhere in the panel
 * (`labelledBy`), so a screen reader hears "Theme, radio group" and then
 * "Dark, radio button, 2 of 3".
 */
export default function Segmented<V extends string>({
  value,
  options,
  onChange,
  labelledBy,
  round = true,
}: {
  value: V;
  options: readonly SegmentOption<V>[];
  onChange: (next: V) => void;
  labelledBy: string;
  /**
   * Circles, not a bar: each option is a round chip carrying an icon or a short
   * glyph, and its label is the accessible name and the tooltip rather than
   * visible text. The default; `false` is the old labelled bar.
   */
  round?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();

  const go = (i: number) => {
    const n = (i + options.length) % options.length;
    refs.current[n]?.focus();
    onChange(options[n].value);
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let to: number | null = null;
    if (e.key === "ArrowDown") to = i + 1;
    else if (e.key === "ArrowUp") to = i - 1;
    else if (e.key === "ArrowRight") to = rtl ? i - 1 : i + 1;
    else if (e.key === "ArrowLeft") to = rtl ? i + 1 : i - 1;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = options.length - 1;
    if (to === null) return;
    e.preventDefault();
    go(to);
  };

  const checkedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={styles.seg}
      data-round={round || undefined}
      style={round ? undefined : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${uid}-${o.value}`}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === checkedIndex ? 0 : -1}
            className={styles.segItem}
            title={round ? o.label : undefined}
            lang={o.lang}
            dir={o.dir}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {(o.icon || (round && o.glyph)) && (
              <span className={styles.segIcon} aria-hidden="true">
                {o.icon ?? o.glyph}
              </span>
            )}
            <span className={round ? "sr-only" : styles.segLabel}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
