import { Search, X } from "lucide-react";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/SettingsSearch.module.css";

/*
 * One search field for a settings list. It only holds the text and says how
 * many settings match (a polite status line); the list does the filtering with
 * `matchItems` from settingsKit. No results offers "Clear search".
 */

export interface SettingsSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** How many settings match the current value. */
  count: number;
  className?: string;
}

export function SettingsSearch({ value, onChange, count, className }: SettingsSearchProps) {
  const w = useMobileWords().settings;
  const searching = value.trim() !== "";
  return (
    <div className={[styles.search, className].filter(Boolean).join(" ")}>
      <div className={styles.field}>
        <Search size={18} strokeWidth={2} aria-hidden="true" focusable="false" className={styles.glass} />
        <input
          type="search"
          className={styles.input}
          value={value}
          aria-label={w.search}
          placeholder={w.search}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
        {value !== "" && !(searching && count === 0) && (
          <button type="button" className={styles.clear} aria-label={w.clearSearch} onClick={() => onChange("")}>
            <X size={18} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        )}
      </div>
      <div role="status" className={styles.status}>
        {searching ? (count === 0 ? w.noMatch : w.found(count)) : ""}
      </div>
      {searching && count === 0 && (
        <button type="button" className={styles.again} onClick={() => onChange("")}>
          {w.clearSearch}
        </button>
      )}
    </div>
  );
}
