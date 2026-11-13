import { Mail } from "lucide-react";
import { InstagramGlyph, LinkedinGlyph, XGlyph } from "@/components/ui/channelGlyphs";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/ChannelIcon.module.css";

/*
 * Where a thing is posted, drawn as the four logos in a fixed order, so that
 * position says which channel before the eye has learned the logos.
 * Posted = the filled mark with a small check at its corner; not yet = the
 * same mark as an outline. Words are for screen readers only ("LinkedIn:
 * posted"); a row carries no text for them.
 */

export const CHANNELS = ["linkedin", "x", "instagram", "email"] as const;
export type Channel = (typeof CHANNELS)[number];

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

function Mark({ channel, done, size }: { channel: Channel; done: boolean; size: number }) {
  const common = { size, className: styles.mark, "aria-hidden": true as const };
  switch (channel) {
    case "linkedin":
      return <LinkedinGlyph {...common} outline={!done} />;
    case "x":
      return <XGlyph {...common} outline={!done} />;
    case "instagram":
      return <InstagramGlyph {...common} outline={!done} />;
    case "email":
      return <Mail size={size} className={styles.mark} aria-hidden="true" focusable="false" strokeWidth={done ? 2.25 : 1.5} />;
  }
}

export interface ChannelIconProps {
  channel: Channel;
  done: boolean;
  /** 16, 20 or 24. */
  size?: number;
  className?: string;
}

export function ChannelIcon({ channel, done, size = 20, className }: ChannelIconProps) {
  const w = useMobileWords().channel;
  const name = w.names[channel];
  return (
    <span
      role="img"
      aria-label={done ? w.posted(name) : w.notPosted(name)}
      data-channel={channel}
      data-done={String(done)}
      className={cx(styles.icon, className)}
      style={{ inlineSize: size, blockSize: size }}
    >
      <Mark channel={channel} done={done} size={size} />
      {done && (
        <svg data-check="" className={styles.check} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
          <circle cx="5" cy="5" r="5" />
          <path d="M2.6 5.2 4.3 6.8 7.4 3.6" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/** What has been posted, per channel: an ISO time, or nothing. `gmail` folds into `email`. */
export type ChannelDone = Partial<Record<Channel | "gmail", string | undefined | null>>;

export function ChannelRow({ done, size = 20, className }: { done: ChannelDone; size?: number; className?: string }) {
  const w = useMobileWords().channel;
  return (
    <span role="group" aria-label={w.group} className={cx(styles.row, className)}>
      {CHANNELS.map((c) => (
        <ChannelIcon
          key={c}
          channel={c}
          size={size}
          done={Boolean(done[c] || (c === "email" && done.gmail))}
        />
      ))}
    </span>
  );
}
