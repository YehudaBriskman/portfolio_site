import type { MouseEvent } from "react";
import { useLocalBrowseHost } from "./localBrowse";
import styles from "../Nav.module.css";

/*
 * The phone menu's first section (#780): the page's own Browse. Drawn only
 * while a page has registered one (`useLocalBrowse`); the page portals its
 * content into the slot. A link that leaves the page closes the sheet
 * (`onLeave`); a control inside `data-filter-scope` does not.
 */
export default function LocalSection({ onLeave }: { onLeave: () => void }) {
  const { label, setSlot } = useLocalBrowseHost();
  if (!label) return null;
  const onClick = (e: MouseEvent<HTMLElement>) => {
    const a = (e.target as HTMLElement).closest("a[href]");
    if (a && !a.closest("[data-filter-scope]")) onLeave();
  };
  return (
    <>
      <section data-local-browse="" aria-label={label} onClick={onClick}>
        <p className={styles.sheetHead}>{label}</p>
        <div ref={setSlot} className={styles.sheetLocal} />
      </section>
      <div className={styles.sheetSplit} aria-hidden="true" />
    </>
  );
}
