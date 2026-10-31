import type { ReactNode } from "react";
import styles from "@/components/notes/Pill.module.css";

/*
 * A fact in a capsule: a date, a reading time, the collection a filtered
 * index is showing.
 *
 * It was `<span className="meta-pill">` written out at four call sites across
 * two pages, which is how three of them ended up with different heights in
 * the same row. The surface itself still belongs to `.meta-pill` in index.css
 * — this component carries the correction that makes it visible on paper, and
 * carries it in one place so the fourth call site cannot miss it. See
 * Pill.module.css.
 */
export default function MetaPill({ children }: { children: ReactNode }) {
  return <span className={`meta-pill ${styles.meta}`}>{children}</span>;
}
