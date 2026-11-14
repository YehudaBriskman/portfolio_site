import { X } from "lucide-react";
import { ICON } from "@/components/ui/icons";
import { usePhone } from "@/hooks/usePhone";
import { groupMatches } from "./Fields";
import { useContentWords } from "./words";
import styles from "./EditorPhone.module.css";

/*
 * Search over the groups of a long editor (site copy) on a phone. It matches
 * a group's title and the labels of its fields; a group it names opens, the
 * others leave the page, and the count is read out. Drawn only on a phone: a
 * desktop shows every section at once and has the browser's find.
 */

export type SearchGroup = { title: string; keywords: readonly string[] };

export function GroupSearch({ groups, value, onChange }: { groups: readonly SearchGroup[]; value: string; onChange: (v: string) => void }) {
  const phone = usePhone();
  const w = useContentWords().search;
  if (!phone) return null;
  const n = groups.filter((g) => groupMatches(value, g.title, g.keywords)).length;
  const searching = value.trim() !== "";
  const Search = ICON.searchSettings;
  return (
    <div className={styles.search}>
      <div className={styles.searchRow}>
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[rgb(var(--ink-soft))]" size={16} aria-hidden="true" focusable="false" />
          <input
            type="search"
            role="searchbox"
            aria-label={w.label}
            placeholder={w.label}
            className="a-input ps-9"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        {searching && (
          <button type="button" className="a-btn a-btn-ghost min-h-11 min-w-11 p-0" aria-label={w.clear} onClick={() => onChange("")}>
            <X size={20} aria-hidden="true" focusable="false" />
          </button>
        )}
      </div>
      <p role="status" className={styles.count}>
        {searching ? (n === 0 ? w.none : w.found(n)) : ""}
      </p>
    </div>
  );
}
