import type { ReactNode } from "react";
import "@/components/phone/tokens.css";
import styles from "@/components/phone/phone.module.css";
import type { Tone } from "@/components/phone/AvatarCircle";

/**
 * A state or a count as a pill, 24px tall on a phone: a dot and a word, or a
 * number. The word is always printed, so colour never carries it alone
 * (WCAG 1.4.1). `className` is the page's own pill class: above 640px that is
 * the whole look and this adds nothing.
 */
export default function PillBadge({
  tone = "neutral",
  className = "",
  dataKind,
  children,
}: {
  tone?: Tone;
  className?: string;
  dataKind?: string;
  children: ReactNode;
}) {
  return (
    <span className={`${styles.pill} ${className}`} data-phone-pill="" data-tone={tone} data-kind={dataKind}>
      {children}
    </span>
  );
}
