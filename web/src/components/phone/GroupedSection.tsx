import type { ReactNode } from "react";
import "@/components/phone/tokens.css";
import styles from "@/components/phone/phone.module.css";

/**
 * A group on a phone: a quiet header above one inset rounded surface (22px,
 * no outline, rows divided by a hairline that starts after the circle). The
 * group is the rounded thing; a row is never its own card.
 *
 * It wraps the page's own list (`<ul>` or `<ol>` of `<li>`) and adds no
 * element of its own to the accessibility tree: the page's heading and list
 * keep their semantics. Above 640px it is `display: contents`.
 */
export default function GroupedSection({ children }: { children: ReactNode }) {
  return (
    <div className={styles.group} data-phone-group="">
      {children}
    </div>
  );
}
