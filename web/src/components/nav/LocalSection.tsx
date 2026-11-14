import { useEffect, useRef } from "react";
import { useLocalBrowseHost } from "./localBrowse";
import styles from "../Nav.module.css";

/*
 * The phone menu's first section (#780): the page's own Browse. Drawn only
 * while a page has registered one (`useLocalBrowse`); the page portals its
 * content into the slot. A link that leaves the page closes the sheet
 * (`onLeave`); a control inside `data-filter-scope` does not.
 *
 * A native listener, not `onClick`: React bubbles a portal's events through
 * the React tree (the page), not the DOM tree (this section).
 */
export default function LocalSection({ onLeave }: { onLeave: () => void }) {
  const { label, setSlot } = useLocalBrowseHost();
  const section = useRef<HTMLElement>(null);
  const leave = useRef(onLeave);
  useEffect(() => {
    leave.current = onLeave;
  });
  const shown = label !== null;
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href]");
      if (a && !a.closest("[data-filter-scope]")) leave.current();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [shown]);
  if (!label) return null;
  return (
    <>
      <section ref={section} data-local-browse="" aria-label={label}>
        <p className={styles.sheetHead}>{label}</p>
        <div ref={setSlot} className={styles.sheetLocal} />
      </section>
      <div className={styles.sheetSplit} aria-hidden="true" />
    </>
  );
}
