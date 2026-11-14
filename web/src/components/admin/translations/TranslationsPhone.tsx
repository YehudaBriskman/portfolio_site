import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FilterChips, FiltersRestoredNote } from "@/components/ui/FilterChips";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { LifecycleStepper, type LifecycleStep } from "@/components/ui/Journey";
import { MiniBar } from "@/components/ui/MiniBar";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph, type StatusKind } from "@/components/ui/StatusGlyph";
import { ICON } from "@/components/ui/icons";
import { tidy, type FilterDef } from "@/components/ui/filters";
import { useSavedFilters } from "@/components/ui/useSavedFilters";
import { usePhoneAdminWords } from "@/i18n/adminPhone";
import { TRANSLATION_TYPES, editHref, type TranslationItem, type TranslationStatus, type TranslationType, type TranslationUnit } from "@/services/translations";
import styles from "@/components/admin/phone/phone.module.css";

/*
 * Translations below 600px. A row answers "which one needs Hebrew, and how
 * far along is it?": the title, what kind it is, which fields, and ONE glyph
 * for the Hebrew status (finished Hebrew draws nothing). The five statuses are
 * the chips; type and "include private" are in the Filters sheet. The sheet
 * shows where the Hebrew is on its way to done and the fields that need work.
 * The address keeps the filters, so a link to "out of date" still works.
 * With no status chosen the list is what still needs Hebrew: finished items
 * stay out of the way until the Done chip asks for them.
 */

const RANK: Record<TranslationStatus, number> = { missing: 0, stale: 1, draft: 2, unverified: 3, translated: 4 };

/** The status the row carries: the report's own roll-up, else the worst field. */
const statusOf = (i: TranslationItem): TranslationStatus =>
  i.status ?? i.units.reduce<TranslationStatus>((worst, u) => (RANK[u.status] < RANK[worst] ? u.status : worst), "translated");

/** `decisions.2.body` is counted under `decisions`; the worst status of its fields goes with it. */
function fieldGroups(units: TranslationUnit[]): { name: string; count: number; status: TranslationStatus }[] {
  const groups = new Map<string, { name: string; count: number; status: TranslationStatus }>();
  for (const u of units) {
    const name = u.path.split(".").filter((p) => !/^\d+$/.test(p))[0] ?? u.path;
    const g = groups.get(name);
    if (!g) groups.set(name, { name, count: 1, status: u.status });
    else {
      g.count += 1;
      if (RANK[u.status] < RANK[g.status]) g.status = u.status;
    }
  }
  return [...groups.values()];
}

const label = (g: { name: string; count: number }) => (g.count > 1 ? `${g.name} ×${g.count}` : g.name);
const heRoute = (route: string) => (route === "/" ? "/he" : `/he${route}`);

/** Chip value for a status: "done" keeps the address the desktop's Done tab uses. */
const CHIP: Record<TranslationStatus, string> = { missing: "missing", stale: "stale", draft: "draft", unverified: "unverified", translated: "done" };
const STATUS_OF_CHIP = Object.fromEntries(Object.entries(CHIP).map(([k, v]) => [v, k])) as Record<string, TranslationStatus>;

const STEPS = ["missing", "draft", "unverified", "done"] as const;
const stepOf = (s: TranslationStatus): (typeof STEPS)[number] => (s === "translated" || s === "stale" ? "done" : s);

const glyphKind = (s: TranslationStatus): StatusKind => s;

export default function TranslationsPhone({ items }: { items: TranslationItem[] }) {
  const p = usePhoneAdminWords().translations;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        id: "status", kind: "segmented", label: p.status,
        options: (["missing", "stale", "draft", "unverified", "translated"] as const).map((s) => ({ value: CHIP[s], label: p.statuses[s] })),
      },
      { id: "type", kind: "multi", label: p.type, options: TRANSLATION_TYPES.map((t) => ({ value: t, label: p.types[t] })) },
      { id: "visibility", kind: "multi", label: p.visibility, options: [{ value: "private", label: p.includePrivate }] },
    ],
    [p],
  );
  const [filters, setFilters, saved] = useSavedFilters("translations", defs);

  const matches = (i: TranslationItem, f: typeof filters) => {
    const types = Array.isArray(f.type) ? (f.type as string[]) : [];
    const withPrivate = Array.isArray(f.visibility) && f.visibility.includes("private");
    const chip = typeof f.status === "string" ? STATUS_OF_CHIP[f.status] : undefined;
    const status = statusOf(i);
    return (
      (types.length === 0 || types.includes(i.type)) &&
      (withPrivate || i.visibility === "public") &&
      (chip ? status === chip : status !== "translated")
    );
  };
  const visible = items.filter((i) => matches(i, filters));

  /* Coverage is by field, over what the type and visibility filters leave in scope. */
  const coverage = useMemo(() => {
    const types = Array.isArray(filters.type) ? (filters.type as string[]) : [];
    const withPrivate = Array.isArray(filters.visibility) && filters.visibility.includes("private");
    let total = 0;
    let live = 0;
    for (const i of items) {
      if ((types.length && !types.includes(i.type)) || (!withPrivate && i.visibility !== "public")) continue;
      for (const u of i.units) {
        total += 1;
        if (u.status === "translated" || u.status === "unverified" || u.status === "stale") live += 1;
      }
    }
    return total ? Math.round((live / total) * 100) : 100;
  }, [items, filters]);

  const key = (i: TranslationItem) => `${i.type}:${i.id}`;
  const open = items.find((i) => key(i) === openKey) ?? null;
  const filtered = Object.keys(filters).length > 0;

  const steps: LifecycleStep[] = STEPS.map((s) => ({ id: s, label: p.steps[s] }));
  const needWork = (i: TranslationItem) => i.units.filter((u) => u.status !== "translated");
  const target = (i: TranslationItem) => {
    const s = statusOf(i);
    return i.units.find((u) => u.status === s) ?? needWork(i)[0] ?? i.units[0];
  };

  return (
    <div className={styles.page} data-testid="translations-phone">
      <div className={styles.section}>
        <MiniBar value={coverage} max={100} label={p.coverage(coverage)} height={8} />
        <p className={styles.note}>{p.coverage(coverage)}</p>
      </div>

      <div className={styles.section}>
        <FilterChips defs={defs} value={filters} onChange={setFilters} common={["status"]} onOpenSheet={() => setFiltersOpen(true)} resultCount={visible.length} />
        <FiltersRestoredNote restored={saved.restored} onUndo={saved.undoRestore} onDismiss={saved.dismissRestored} />
      </div>

      {visible.length === 0 ? (
        <p className="a-hint" data-testid="no-match">{filtered ? p.noMatch : p.allDone}</p>
      ) : (
        <ul className={styles.list} aria-label={p.count(visible.length)}>
          {visible.map((i) => {
            const s = statusOf(i);
            const fields = fieldGroups(needWork(i)).map(label).join(", ") || "—";
            return (
              <RecordRow
                key={key(i)} as="li" icon={ICON.language} title={i.title}
                facts={[{ text: p.typeOne[i.type] }, { text: fields, dir: "ltr" }]}
                status={<StatusGlyph kind={glyphKind(s)} label={s === "draft" ? p.draftWord : undefined} />}
                openLabel={`${p.openItem(i.title)}: ${p.typeOne[i.type]}, ${fields}`}
                onOpen={() => setOpenKey(key(i))}
              />
            );
          })}
        </ul>
      )}

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        defs={defs}
        value={filters}
        onApply={setFilters}
        resultCount={(draft) => items.filter((i) => matches(i, tidy(defs, draft))).length}
      />

      <BottomSheet open={open !== null} onClose={() => setOpenKey(null)} title={open?.title ?? ""} footer={
        open ? <Link to={editHref(open, target(open))} className={`a-btn a-btn-primary ${styles.footerButton}`}>{p.edit}</Link> : null
      }>
        {open && (
          <div className={styles.sheetBody} data-testid="translation-sheet">
            <StatusGlyph kind={glyphKind(statusOf(open))} withWord showDefault size={16} label={statusOf(open) === "draft" ? p.draftWord : undefined} />
            <LifecycleStepper steps={steps} current={stepOf(statusOf(open))} label={p.lifecycle} />
            {statusOf(open) === "stale" && <p className="a-hint !mt-0">{p.staleNote}</p>}
            <dl className={styles.facts}>
              <dt>{p.kind}</dt>
              <dd>{p.typeOne[open.type as TranslationType]}{open.visibility === "private" ? ` · ${p.private}` : ""}</dd>
              <dt>{p.seenOn}</dt>
              <dd dir="ltr" className={styles.ltr}>{heRoute(open.route)}</dd>
            </dl>
            <section aria-label={p.fields}>
              <h3 className={styles.heading}>{p.fields}</h3>
              <ul className={styles.changes}>
                {fieldGroups(needWork(open)).map((g) => (
                  <li key={g.name} className={styles.word}>
                    <StatusGlyph kind={glyphKind(g.status)} size={16} label={g.status === "draft" ? p.draftWord : undefined} />
                    <span dir="ltr" className={styles.ltr}>{label(g)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
