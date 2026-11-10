import type { ReactNode } from "react";
import styles from "@/components/notes/Pill.module.css";

/*
 * A fact, as plain text: a date, a reading time. Not a capsule any more: a
 * bordered capsule is what a tag you can press looks like (#349), so a fact
 * is text with a dot between it and the next one.
 *
 * It was `<span className="meta-pill">` written out at four call sites across
 * two pages, which is how three of them ended up with different heights in
 * the same row. The surface itself still belongs to `.meta-pill` in index.css
 * — this component carries the correction that makes it visible on paper, and
 * carries it in one place so the fourth call site cannot miss it. See
 * Pill.module.css.
 */
export default function MetaPill({ children }: { children: ReactNode }) {
  return <span className={styles.meta}>{children}</span>;
}
