import { useFilterWords } from "@/i18n/pages";
import { useLocalBrowseHost } from "./localBrowse";
import styles from "../Nav.module.css";

/*
 * The phone menu's one page-specific row (#808): the page's existing Browse
 * word, how many filters are on, and a chevron. Pressing it closes the menu
 * and asks the page to open its own sheet. Drawn only while a page has
 * registered one (`useLocalBrowse`); a page with nothing to browse shows only
 * the global links.
 */
export default function LocalSection({ onLeave }: { onLeave: () => void }) {
  const { label, count, requestOpen } = useLocalBrowseHost();
  const w = useFilterWords();
  if (!label) return null;
  return (
    <>
      <section data-local-browse="" aria-label={label}>
        <button
          type="button"
          className={styles.browseRow}
          aria-haspopup="dialog"
          onClick={() => {
            onLeave();
            requestOpen();
          }}
        >
          <span className={styles.browseWord}>{label}</span>
          {count > 0 && (
            <>
              <span className={styles.browseBadge}>{count}</span>
              <span className="sr-only">{w.filter.toLowerCase()}</span>
            </>
          )}
          <span className={styles.browseChevron} aria-hidden="true" />
        </button>
      </section>
      <div className={styles.sheetSplit} aria-hidden="true" />
    </>
  );
}
