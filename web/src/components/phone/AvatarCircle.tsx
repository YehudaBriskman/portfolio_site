import type { ReactNode } from "react";
import "@/components/phone/tokens.css";
import styles from "@/components/phone/phone.module.css";

/** The tints a circle or pill can carry, all from the palette's own hues. */
export type Tone = "blue" | "green" | "purple" | "yellow" | "red" | "neutral";

/**
 * A soft circle that carries identity: 32, 40 or 56 px, tinted by the thing
 * it labels, the glyph a darker (light) or lighter (dark) mix of the same
 * tint. Circles, not squircles (owner decision).
 *
 * Above 640px it is `display: contents`: the child is laid out exactly as if
 * the circle were not there, so a page that adopts it does not move on a
 * tablet or a desktop. Decorative by default; pass `label` when the circle is
 * the only thing that says what it is.
 */
export default function AvatarCircle({
  size = 40,
  tone = "neutral",
  label,
  children,
}: {
  size?: 32 | 40 | 56;
  tone?: Tone;
  label?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={styles.circle}
      data-phone-circle={size}
      data-tone={tone}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {children}
    </span>
  );
}
