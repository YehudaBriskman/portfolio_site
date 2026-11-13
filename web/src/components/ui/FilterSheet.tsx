import { useId, useState } from "react";
import { Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import styles from "@/components/ui/FilterSheet.module.css";
import { useLang } from "@/components/dashboard/i18n";
import {
  SEARCH_ABOVE,
  rangeIsBackwards,
  tidy,
  type DateRange,
  type FilterDef,
  type FilterOption,
  type Filters,
} from "@/components/ui/filters";
import { useFiltersWords } from "@/i18n/filters";
import { numberIn } from "@/i18n/words";

/*
 * Every filter, in a bottom sheet. Choosing changes a draft, not the list:
 * nothing behind the sheet moves until "Show N results", and N follows the
 * draft live. Reset empties the draft; Close, Escape and Back drop it.
 * Sections come in a fixed order whatever order the screen listed them in:
 * segmented, multi-select, date range, sort.
 *
 * Segmented and sort are native radios (arrow keys and grouping for free),
 * multi-select is native checkboxes with a search field above eight options,
 * a date range is two native date inputs plus presets and refuses an end
 * before its start.
 */

export interface FilterSheetProps {
  open: boolean;
  /** Called for Close, Escape, Back and after Show. */
  onClose: () => void;
  defs: FilterDef[];
  /** What is applied now; the draft starts from it each time the sheet opens. */
  value: Filters;
  onApply: (next: Filters) => void;
  /** How many rows the draft would show: a number, or a function of the draft (a local list). */
  resultCount?: number | ((draft: Filters) => number);
  /** For a count that comes from a call: fires with the tidy draft on every change. */
  onDraftChange?: (draft: Filters) => void;
  title?: string;
}

const RANK = { segmented: 0, multi: 1, range: 2, sort: 3 } as const;

export function FilterSheet({ open, onClose, defs, value, onApply, resultCount, onDraftChange, title }: FilterSheetProps) {
  const w = useFiltersWords();
  const lang = useLang();
  const [draft, setDraft] = useState<Filters>(value);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(value);
  }

  const update = (next: Filters) => {
    setDraft(next);
    onDraftChange?.(tidy(defs, next));
  };
  const setOne = (id: string, v: Filters[string] | undefined) => {
    const next = { ...draft };
    if (v === undefined) delete next[id];
    else next[id] = v;
    update(next);
  };

  const clean = tidy(defs, draft);
  const n = typeof resultCount === "function" ? resultCount(clean) : resultCount;
  const backwards = defs.some((d) => d.kind === "range" && rangeIsBackwards(draft[d.id] as DateRange | undefined));
  const sorted = [...defs].sort((a, b) => RANK[a.kind] - RANK[b.kind]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title ?? w.filters}
      footer={
        <>
          <button type="button" className={`a-btn ${styles.reset}`} onClick={() => update({})}>
            {w.reset}
          </button>
          <button
            type="button"
            className={`a-btn a-btn-primary ${styles.show}`}
            disabled={backwards}
            onClick={() => {
              onApply(clean);
              onClose();
            }}
          >
            {n === undefined ? w.showPlain : w.show(n)}
          </button>
          <span role="status" className={styles.sr}>
            {n === undefined ? "" : w.results(n)}
          </span>
        </>
      }
    >
      <div className={styles.sections}>
        {sorted.map((def) => (
          <section key={def.id} className={styles.section} data-filter-section={def.id}>
            {def.kind === "segmented" || def.kind === "sort" ? (
              <Choice
                def={def}
                value={(draft[def.id] as string | undefined) ?? (def.kind === "sort" ? def.options[0]?.value : "")}
                onChange={(v) => setOne(def.id, v === "" ? undefined : v)}
                all={def.kind === "segmented" ? w.all : undefined}
                lang={lang}
              />
            ) : def.kind === "multi" ? (
              <Multi def={def} value={Array.isArray(draft[def.id]) ? (draft[def.id] as string[]) : []} onChange={(v) => setOne(def.id, v.length ? v : undefined)} lang={lang} />
            ) : (
              <Range def={def} value={(draft[def.id] as DateRange | undefined) ?? {}} onChange={(v) => setOne(def.id, v)} />
            )}
          </section>
        ))}
      </div>
    </BottomSheet>
  );
}

/* ---------------------------------------------------------- segmented, sort */

function Choice({
  def,
  value,
  onChange,
  all,
  lang,
}: {
  def: FilterDef & { options: FilterOption[] };
  value: string;
  onChange: (v: string) => void;
  all?: string;
  lang: "en" | "he";
}) {
  const name = useId();
  const labelId = `${name}-label`;
  const options: FilterOption[] = all ? [{ value: "", label: all }, ...def.options] : def.options;
  return (
    <>
      <h3 id={labelId} className={styles.label}>
        {def.label}
      </h3>
      <div role="radiogroup" aria-labelledby={labelId} className={styles.pills}>
        {options.map((o) => (
          <label key={o.value} className={styles.pill}>
            <input type="radio" name={name} className={styles.input} checked={value === o.value} onChange={() => onChange(o.value)} />
            {value === o.value && <Check size={16} strokeWidth={2.5} aria-hidden="true" focusable="false" />}
            <span>{o.label}</span>
            {o.count !== undefined && <span className={styles.count}>{numberIn(lang, o.count)}</span>}
          </label>
        ))}
      </div>
    </>
  );
}

/* --------------------------------------------------------------- multi */

function Multi({
  def,
  value,
  onChange,
  lang,
}: {
  def: FilterDef & { kind: "multi" };
  value: string[];
  onChange: (v: string[]) => void;
  lang: "en" | "he";
}) {
  const w = useFiltersWords();
  const [query, setQuery] = useState("");
  const searchable = def.searchable ?? def.options.length > SEARCH_ABOVE;
  const q = query.trim().toLocaleLowerCase();
  const shown = q ? def.options.filter((o) => o.label.toLocaleLowerCase().includes(q)) : def.options;
  const shownValues = new Set(shown.map((o) => o.value));

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{def.label}</legend>
      {searchable && (
        <input
          type="search"
          className={styles.search}
          aria-label={w.searchOptions}
          placeholder={w.searchOptions}
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className={styles.bulk}>
        <button type="button" className={styles.link} onClick={() => onChange([...new Set([...value, ...shown.map((o) => o.value)])])}>
          {w.selectAll}
        </button>
        <button type="button" className={styles.link} onClick={() => onChange(value.filter((v) => !shownValues.has(v)))}>
          {w.selectNone}
        </button>
      </div>
      {shown.length === 0 && <p className={styles.empty}>{w.noMatch}</p>}
      {shown.map((o) => (
        <label key={o.value} className={styles.check}>
          <input
            type="checkbox"
            className={styles.box}
            checked={value.includes(o.value)}
            onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
          />
          <span className={styles.checkText}>{o.label}</span>
          {o.count !== undefined && <span className={styles.count}>{numberIn(lang, o.count)}</span>}
        </label>
      ))}
    </fieldset>
  );
}

/* --------------------------------------------------------------- range */

function Range({ def, value, onChange }: { def: FilterDef & { kind: "range" }; value: DateRange; onChange: (v: DateRange | undefined) => void }) {
  const w = useFiltersWords();
  const id = useId();
  const bad = rangeIsBackwards(value);
  const set = (part: DateRange) => {
    const next = { ...value, ...part };
    if (!next.from) delete next.from;
    if (!next.to) delete next.to;
    onChange(next.from || next.to ? next : undefined);
  };
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{def.label}</legend>
      {def.presets && (
        <div className={styles.pills}>
          {def.presets.map((p) => (
            <button key={p.label} type="button" className={styles.pill} onClick={() => onChange({ from: p.from, to: p.to })}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className={styles.dates}>
        <label className={styles.date}>
          <span>{w.from}</span>
          <input
            type="date"
            className={styles.field}
            value={value.from ?? ""}
            aria-invalid={bad || undefined}
            aria-describedby={bad ? `${id}-err` : undefined}
            onChange={(e) => set({ from: e.target.value })}
          />
        </label>
        <label className={styles.date}>
          <span>{w.to}</span>
          <input
            type="date"
            className={styles.field}
            value={value.to ?? ""}
            aria-invalid={bad || undefined}
            aria-describedby={bad ? `${id}-err` : undefined}
            onChange={(e) => set({ to: e.target.value })}
          />
        </label>
      </div>
      {bad && (
        <p id={`${id}-err`} role="alert" className={styles.error}>
          {w.backwards}
        </p>
      )}
    </fieldset>
  );
}
