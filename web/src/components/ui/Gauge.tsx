import type { ReactNode } from "react";
import { Check, OctagonAlert, TriangleAlert } from "lucide-react";
import styles from "@/components/ui/Gauge.module.css";
import { INTL, useLang } from "@/components/dashboard/i18n";
import { useVisualWords } from "@/i18n/visuals";

/*
 * Budget used against a limit, as a ring. The level (ok / warn / danger) is
 * carried three ways so colour is never alone: the arc's colour, a different
 * glyph in a badge (check, triangle, octagon), and words, spoken always and
 * printed on request. A visually hidden native <meter> holds the real value
 * for assistive tech; the drawing is aria-hidden.
 */

export type GaugeLevel = "ok" | "warn" | "danger";

/** The 70 / 90 percent steps the admin already uses for its send budget. */
export const DEFAULT_THRESHOLDS: readonly [number, number] = [0.7, 0.9];

const EPS = 1e-9;

export function gaugeLevel(value: number, max: number, thresholds: readonly [number, number] = DEFAULT_THRESHOLDS): GaugeLevel {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return "ok";
  const ratio = value / max;
  if (ratio >= thresholds[1] - EPS) return "danger";
  if (ratio >= thresholds[0] - EPS) return "warn";
  return "ok";
}

export interface GaugeProps {
  value: number;
  max: number;
  /** [warn, danger] as fractions of max. */
  thresholds?: readonly [number, number];
  /** The accessible name, e.g. "Today: 310 of 500". */
  label: string;
  /** Diameter in px. */
  size?: number;
  /** Real text in the middle, e.g. "62%". */
  center?: ReactNode;
  /** Print the level in words under the ring. */
  showLevel?: boolean;
  className?: string;
}

const GLYPH = { ok: Check, warn: TriangleAlert, danger: OctagonAlert } as const;
const RADIUS = 15.9155; // circumference 100: dash lengths read as percent

export function Gauge({ value, max, thresholds = DEFAULT_THRESHOLDS, label, size = 72, center, showLevel, className }: GaugeProps) {
  const w = useVisualWords();
  const lang = useLang();
  const level = gaugeLevel(value, max, thresholds);
  const levelWord = { ok: w.levelOk, warn: w.levelWarn, danger: w.levelDanger }[level];
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
  const filled = Math.min(100, (safeValue / safeMax) * 100);
  const pct = new Intl.NumberFormat(INTL[lang], { style: "percent", maximumFractionDigits: 0 }).format(safeValue / safeMax);
  const Glyph = GLYPH[level];
  return (
    <span className={[styles.gauge, className].filter(Boolean).join(" ")} data-tone={level} style={{ inlineSize: size, blockSize: size }}>
      <svg className={styles.ring} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
        <circle className={styles.track} cx="18" cy="18" r={RADIUS} />
        <circle
          className={styles.arc}
          cx="18"
          cy="18"
          r={RADIUS}
          pathLength={100}
          strokeDasharray={`${filled} 100`}
        />
        {thresholds.map((t, i) => (
          <line
            key={i}
            className={styles.tick}
            x1="18"
            y1="0.6"
            x2="18"
            y2="4.2"
            transform={`rotate(${Math.min(1, Math.max(0, t)) * 360} 18 18)`}
          />
        ))}
      </svg>
      {center ? <span className={styles.center}>{center}</span> : null}
      <span className={styles.badge} data-gauge-glyph={level} aria-hidden="true">
        <Glyph className={styles.badgeGlyph} />
      </span>
      <meter
        className={styles.meter}
        min={0}
        max={safeMax}
        value={Math.min(safeValue, safeMax)}
        aria-label={label}
        aria-valuenow={safeValue}
        aria-valuetext={`${label}, ${pct}, ${levelWord}`}
      />
      {showLevel ? (
        <span className={styles.level} data-gauge-level="">
          {levelWord}
        </span>
      ) : null}
    </span>
  );
}
