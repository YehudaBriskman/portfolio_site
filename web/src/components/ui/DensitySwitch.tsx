import { IconButton, type ControlIcon } from "@/components/ui/IconButton";
import { TIERS, type Tier } from "@/components/ui/useTablePrefs";
import styles from "@/components/ui/DensitySwitch.module.css";

/*
 * The row-height switch of a table toolbar: three icon buttons (compact 28,
 * cozy 36, comfy 44 px), one pressed. Each icon draws as many lines as fit in
 * the tier, so the picture says what the word says (more drawing, less
 * writing). The words are the caller's; the choice is the caller's to save
 * (`useTablePrefs`).
 */

const lines = (n: number): ControlIcon =>
  function Lines({ className }) {
    const gap = 16 / (n + 1);
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <line key={i} x1="4" x2="20" y1={4 + gap * (i + 1)} y2={4 + gap * (i + 1)} />
        ))}
      </svg>
    );
  };

const GLYPH: Record<Tier, ControlIcon> = { compact: lines(5), cozy: lines(4), comfy: lines(3) };

export interface DensitySwitchProps {
  /** Names the group: "Row height". */
  label: string;
  /** The tier in force (the pointer's default when the person has not chosen). */
  value: Tier;
  onChange: (t: Tier) => void;
  words: Record<Tier, string>;
  className?: string;
}

export function DensitySwitch({ label, value, onChange, words, className }: DensitySwitchProps) {
  return (
    <div role="group" data-joined="" aria-label={label} className={[styles.group, className].filter(Boolean).join(" ")}>
      {TIERS.map((t) => (
        <IconButton key={t} icon={GLYPH[t]} label={words[t]} size="sm" pressed={value === t} onClick={() => onChange(t)} />
      ))}
    </div>
  );
}
