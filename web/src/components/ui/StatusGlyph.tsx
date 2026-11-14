import { ICON, type IconSource } from "@/components/ui/icons";
import type { LucideIcon } from "lucide-react";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/StatusGlyph.module.css";

/*
 * Status as a glyph. One table maps a kind to an icon and one of four tones;
 * the word is for screen readers and a hover title (or printed, in a sheet,
 * with `withWord`). Colour is never alone: every kind has its own shape.
 *
 * What is normal draws nothing. Published, active, mailable and translated are
 * `quiet`: a row shows only what is wrong or needs the reader, so the repeated
 * "Ready" pill does not come back as a repeated green tick.
 */

export type StatusTone = "neutral" | "ok" | "attention" | "danger";

type Entry = { icon: IconSource; tone: StatusTone; quiet: boolean };
const e = (icon: IconSource, tone: StatusTone, quiet = false): Entry => ({ icon, tone, quiet });

export const STATUS = {
  draft: e(ICON.draft, "neutral"),
  scheduled: e(ICON.scheduled, "neutral"),
  sending: e(ICON.sending, "ok"),
  sent: e(ICON.sent, "ok"),
  paused: e(ICON.paused, "attention"),
  failed: e(ICON.failed, "danger"),
  canceled: e(ICON.archived, "neutral"),
  published: e(ICON.published, "ok", true),
  changes: e(ICON.changes, "attention"),
  hidden: e(ICON.hidden, "neutral"),
  archived: e(ICON.archived, "neutral"),
  active: e(ICON.published, "ok", true),
  revoked: e(ICON.revoked, "danger"),
  expired: e(ICON.expired, "attention"),
  missing: e(ICON.hebrewMissing, "attention"),
  stale: e(ICON.hebrewStale, "attention"),
  unverified: e(ICON.hebrewUnverified, "attention"),
  translated: e(ICON.hebrewDone, "ok", true),
  mailable: e(ICON.mailable, "ok", true),
  pending: e(ICON.pendingConfirm, "attention"),
  unsubscribed: e(ICON.unsubscribed, "neutral"),
  suppressed: e(ICON.suppressed, "danger"),
  attention: e(ICON.attention, "attention"),
  used: e(ICON.usedIn, "neutral"),
} satisfies Record<string, Entry>;

export type StatusKind = keyof typeof STATUS;
export const STATUS_KINDS = Object.keys(STATUS) as StatusKind[];

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

export interface StatusGlyphProps {
  kind: StatusKind;
  /** 16, 20 or 24. */
  size?: 16 | 20 | 24;
  /** Print the word beside the glyph (sheets). On a row the word is only for screen readers. */
  withWord?: boolean;
  /** Draw a normal state (published, active, mailable, translated) instead of nothing. */
  showDefault?: boolean;
  /** The words for this one glyph when the kind's own word is too general ("Long description"). */
  label?: string;
  /** Escalate a kind to a stronger tone (an error among warnings). */
  tone?: StatusTone;
  className?: string;
}

export function StatusGlyph({ kind, size = 20, withWord = false, showDefault = false, label, tone, className }: StatusGlyphProps) {
  const kindWord = useMobileWords().status[kind];
  const word = label ?? kindWord;
  const entry: Entry = STATUS[kind];
  if (entry.quiet && !showDefault) return null;
  const Icon = entry.icon as LucideIcon;
  const glyph = (
    <Icon
      size={size}
      strokeWidth={size === 16 ? 1.75 : 2}
      aria-hidden="true"
      focusable="false"
      className={styles.svg}
    />
  );
  const common = { "data-kind": kind, "data-tone": tone ?? entry.tone, className: cx(styles.glyph, className) };
  if (withWord) {
    return (
      <span {...common}>
        {glyph}
        <span className={styles.word}>{word}</span>
      </span>
    );
  }
  return (
    <span {...common} role="img" aria-label={word} title={word}>
      {glyph}
    </span>
  );
}
