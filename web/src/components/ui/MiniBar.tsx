import styles from "@/components/ui/MiniBar.module.css";
import { INTL, useLang } from "@/components/dashboard/i18n";
import { useVisualWords } from "@/i18n/visuals";

/*
 * An inline bar: a few parts of one whole. One role="img" with a text name;
 * the number beside it (opt-in) is real text. Colour is never the only
 * carrier: the danger tone is hatched, and the caller's label says it in words.
 */

export type MiniBarTone = "ok" | "danger" | "muted" | "attention";

export interface MiniBarPart {
  value: number;
  tone?: MiniBarTone;
  /** The part's name, used only in the default accessible name. */
  label?: string;
}

export interface MiniBarProps {
  /** Several parts of the total... */
  parts?: MiniBarPart[];
  /** ...or one value out of `max`. */
  value?: number;
  max?: number;
  total?: number;
  /** The accessible name. Defaults to "value of total" in the page's language. */
  label?: string;
  /** Track height in px. */
  height?: number;
  /** Print "3/10" beside the bar. */
  showNumber?: boolean;
  className?: string;
}

const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Each part's share of the track, in percent. Parts under the total leave the
 * rest of the track empty; parts over it are scaled to fill it exactly; a
 * zero, negative or NaN total draws nothing.
 */
export function segmentWidths(values: number[], total: number): number[] {
  const t = clean(total);
  const v = values.map(clean);
  if (t === 0) return v.map(() => 0);
  const sum = v.reduce((a, b) => a + b, 0);
  const base = Math.max(t, sum);
  return v.map((n) => (n / base) * 100);
}

export function MiniBar({ parts, value, max, total, label, height = 6, showNumber, className }: MiniBarProps) {
  const w = useVisualWords();
  const lang = useLang();
  const nf = new Intl.NumberFormat(INTL[lang]);
  const list: MiniBarPart[] = parts ?? [{ value: value ?? 0, tone: "ok" }];
  const whole = clean(total ?? max ?? list.reduce((a, p) => a + clean(p.value), 0));
  const widths = segmentWidths(list.map((p) => p.value), whole);
  const shown = list.reduce((a, p) => a + clean(p.value), 0);
  const name = label ?? w.ofTotal(nf.format(shown), nf.format(whole));
  return (
    <span className={[styles.wrap, className].filter(Boolean).join(" ")}>
      <span className={styles.track} role="img" aria-label={name} style={{ blockSize: height }}>
        {list.map((p, i) =>
          widths[i] > 0 ? (
            <span
              key={i}
              className={styles.segment}
              data-segment=""
              data-tone={p.tone ?? "ok"}
              style={{ inlineSize: `${widths[i]}%` }}
            />
          ) : null,
        )}
      </span>
      {showNumber ? (
        <span className={styles.number} data-number="" dir="ltr">
          {nf.format(shown)}/{nf.format(whole)}
        </span>
      ) : null}
    </span>
  );
}
