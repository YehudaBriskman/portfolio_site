import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Chevron from "@/components/phone/Chevron";
import "@/components/phone/tokens.css";
import styles from "@/components/phone/phone.module.css";
import AvatarCircle, { type Tone } from "@/components/phone/AvatarCircle";

/**
 * One row of a grouped list: a leading icon circle (40), the title and a
 * muted meta line stacked, a chevron that mirrors in Hebrew. The whole row is
 * ONE link, at least 64px tall (so 44+ with room), with a divider inset to
 * start after the circle.
 *
 * `children` is the row's own text (a title element, then optionally a meta
 * element). The page keeps its own classes on them; above 640px the circle
 * wrapper is `display: contents` and the chevron is `display: none`, so the
 * row there is the page's row, unchanged. Render it inside a `<li>` of a
 * `GroupedSection`.
 */
export default function ListRow({
  to,
  href,
  icon,
  tone = "neutral",
  className = "",
  children,
}: {
  /** An in-app route (client navigation). */
  to?: string;
  /** An outbound URL (opens normally, `noopener noreferrer`). */
  href?: string;
  icon: ReactNode;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  const inner = (
    <>
      <AvatarCircle size={40} tone={tone}>
        {icon}
      </AvatarCircle>
      {children}
      <Chevron />
    </>
  );
  const cls = `${styles.row} ${className}`;
  return to ? (
    <Link to={to} className={cls} data-phone-row="">
      {inner}
    </Link>
  ) : (
    <a href={href} className={cls} data-phone-row="" rel="noopener noreferrer">
      {inner}
    </a>
  );
}
