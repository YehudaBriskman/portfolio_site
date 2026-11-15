import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import HeGlyph from "@/components/admin/posts/HeGlyph";
import { usePostsPhoneWords } from "@/components/admin/posts/words";
import TranslationsPhone from "@/components/admin/translations/TranslationsPhone";
import { useTranslationsWords } from "@/components/admin/translations/words";
import { ErrorState, PageHeader } from "@/components/admin/ui";
import {
  DataTable,
  type Column,
  type DataTableWords,
} from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar, useFilterBar } from "@/components/ui/FilterBar";
import type { FilterDef } from "@/components/ui/filters";
import { FiltersRestoredNote } from "@/components/ui/FilterChips";
import { ICON } from "@/components/ui/icons";
import { RowActions } from "@/components/ui/RowActions";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { usePhone } from "@/hooks/usePhone";
import { useAdminWords } from "@/i18n/admin";
import { usePhoneAdminWords } from "@/i18n/adminPhone";
import { useFiltersWords } from "@/i18n/filters";
import {
  TABS,
  TRANSLATION_TYPES,
  editHref,
  tabOf,
  useTranslationReport,
  type TranslationItem,
  type TranslationStatus,
  type TranslationTab,
  type TranslationType,
  type TranslationUnit,
} from "@/services/translations";

/*
 * /admin/translations (#302, design §7.3): GitHub's issues list, for Hebrew.
 * Counts as tabs (missing, stale, in a draft, done), the type and visibility
 * as filters, one row per item in the order a reader meets it: the home page
 * first, then the hubs, the projects, and notes by recency.
 *
 * Each row names the fields that need work and links to the first of them;
 * the editor opens on that field with its Hebrew input focused. Nothing here
 * is stored: the report is computed on every read (`GET
 * /api/admin/translations`), so a save elsewhere shows up on the next one.
 *
 * The admin is English (owner decision, #292); the words for the nav item and
 * the pill come from the admin's table like the rest of the chrome.
 */

type Visibility = "public" | "all" | "private";

const isTab = (v: string | null): v is TranslationTab =>
  TABS.includes(v as TranslationTab);

/** `decisions.2.body` → `decisions`; a list's units are counted under its name. */
function fieldsOf(units: TranslationUnit[]): string {
  const counts = new Map<string, number>();
  for (const u of units) {
    const head = u.path.split(".").filter((p) => !/^\d+$/.test(p))[0] ?? u.path;
    counts.set(head, (counts.get(head) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(", ");
}

/** The row's glyph: the worst of the units it lists. */
const RANK: Record<TranslationStatus, number> = {
  missing: 0,
  stale: 1,
  draft: 2,
  unverified: 3,
  translated: 4,
};
const worstOf = (units: TranslationUnit[]) =>
  units.reduce(
    (worst, u) => (RANK[u.status] < RANK[worst] ? u.status : worst),
    units[0].status,
  );

const heRoute = (route: string) => (route === "/" ? "/he" : `/he${route}`);

interface Row {
  item: TranslationItem;
  units: TranslationUnit[];
}

export default function AdminTranslations() {
  const w = useAdminWords();
  const phone = usePhone();
  const { report, error, reload } = useTranslationReport();
  const t = useTranslationsWords();
  const p = usePhoneAdminWords().translations;
  const posts = usePostsPhoneWords();
  const f = useFiltersWords();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: TranslationTab = isTab(params.get("status"))
    ? (params.get("status") as TranslationTab)
    : "missing";

  const setTab = (next: string) =>
    setParams(
      (prev) => {
        const q = new URLSearchParams(prev);
        if (next === "missing") q.delete("status");
        else q.set("status", next);
        return q;
      },
      { replace: true },
    );

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        id: "type",
        kind: "segmented",
        label: p.type,
        options: TRANSLATION_TYPES.map((x) => ({
          value: x,
          label: p.types[x],
        })),
      },
      {
        id: "visibility",
        kind: "segmented",
        label: p.visibility,
        options: [
          { value: "all", label: t.visibilityAll },
          { value: "private", label: t.visibilityPrivate },
        ],
      },
    ],
    [p, t],
  );
  const bar = useFilterBar("translations-desktop", defs);
  const typeId =
    typeof bar.filters.type === "string" &&
    TRANSLATION_TYPES.includes(bar.filters.type as TranslationType)
      ? (bar.filters.type as TranslationType)
      : null;
  const visibility: Visibility =
    bar.filters.visibility === "all" || bar.filters.visibility === "private"
      ? bar.filters.visibility
      : "public";
  const term = bar.query.trim().toLowerCase();

  /* The type, visibility and search scope the counts; the tab then picks the units. */
  const scoped = useMemo(
    () =>
      (report?.items ?? []).filter(
        (i) =>
          (!typeId || i.type === typeId) &&
          (visibility === "all" || i.visibility === visibility) &&
          (!term ||
            [i.title, i.id, i.route].some((x) =>
              x.toLowerCase().includes(term),
            )),
      ),
    [report, typeId, visibility, term],
  );
  /* A tab's count is the rows it shows: items with at least one field in it. */
  const counts = useMemo(() => {
    const c: Record<TranslationTab, number> = {
      missing: 0,
      stale: 0,
      draft: 0,
      done: 0,
    };
    for (const i of scoped)
      for (const x of new Set(i.units.map((u) => tabOf(u.status)))) c[x] += 1;
    return c;
  }, [scoped]);
  /* Coverage is by field: the share of fields in scope with Hebrew live. */
  const coverage = useMemo(() => {
    let total = 0;
    let live = 0;
    for (const i of scoped)
      for (const u of i.units) {
        total += 1;
        if (tabOf(u.status) === "done" || u.status === "stale") live += 1;
      }
    return total ? Math.round((live / total) * 100) : 100;
  }, [scoped]);
  const rows = useMemo<Row[]>(
    () =>
      scoped.flatMap((item) => {
        const units = item.units.filter((u) => tabOf(u.status) === tab);
        return units.length ? [{ item, units }] : [];
      }),
    [scoped, tab],
  );

  const words: DataTableWords = {
    selectAll: f.selectAll,
    selectRow: (label) => label,
    actions: w.colActions,
    loading: w.loading,
    bulkLabel: w.colActions,
    count: (n) => String(n),
    cancel: posts.keep,
    more: w.moreActions,
  };

  const columns: Column<Row>[] = [
    {
      id: "item",
      header: t.colItem,
      primary: true,
      cell: ({ item, units }) => (
        <Link to={editHref(item, units[0])} className="a-row-title">
          {item.title}
        </Link>
      ),
    },
    {
      id: "type",
      header: p.type,
      hideBelow: "sm",
      width: "7rem",
      cell: ({ item }) =>
        `${p.typeOne[item.type]}${item.visibility === "private" ? ` · ${p.private}` : ""}`,
    },
    {
      id: "fields",
      header: t.colFields,
      hideBelow: "md",
      width: "10rem",
      cell: ({ units }) => (
        <span
          dir="ltr"
          className="a-clamp-1"
          style={{ maxInlineSize: "10rem" }}
          title={fieldsOf(units)}
        >
          {fieldsOf(units)}
        </span>
      ),
    },
    {
      id: "path",
      header: t.colSeenOn,
      hideBelow: "lg",
      width: "11rem",
      cell: ({ item }) => (
        <code
          dir="ltr"
          className="a-path"
          style={{ maxInlineSize: "11rem" }}
          title={heRoute(item.route)}
        >
          {heRoute(item.route)}
        </code>
      ),
    },
    {
      id: "he",
      header: t.colHebrew,
      hideBelow: "sm",
      width: "6rem",
      cell: ({ units }) => <HeGlyph status={worstOf(units)} />,
    },
  ];

  const filtered = Boolean(typeId || visibility !== "public" || term);
  const idBase = "translations";

  return (
    <AdminShell title={w.nav.translations} section="translations">
      <div className="a-wrap">
        <PageHeader
          title={w.nav.translations}
          meta={
            !phone &&
            report && (
              <span className="tabular-nums">{p.coverage(coverage)}</span>
            )
          }
          description={phone ? undefined : t.intro}
        />

        {!phone && (
          <FilterBar
            defs={defs}
            value={bar.filters}
            onChange={bar.setFilters}
            common={["type", "visibility"]}
            query={bar.query}
            onQueryChange={bar.setQuery}
            resultCount={rows.length}
            words={{
              search: t.search,
              clearSearch: t.clearSearch,
              results: f.results,
              clearAll: f.clearAll,
            }}
          />
        )}
        {!phone && (
          <FiltersRestoredNote
            restored={bar.saved.restored}
            onUndo={bar.saved.undoRestore}
            onDismiss={bar.saved.dismissRestored}
          />
        )}

        <p className="sr-only" role="status">
          {report === null
            ? w.loading
            : phone
              ? ""
              : t.count(rows.length, t.tabs[tab])}
        </p>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : report === null ? (
          <Skeleton
            columns={[
              { id: "a", width: "3fr" },
              { id: "b", width: "1fr" },
              { id: "c", width: "1fr" },
            ]}
            rows={6}
            label={w.loading}
          />
        ) : phone ? (
          <TranslationsPhone items={report.items} />
        ) : (
          <>
            <Tabs
              className="mt-4"
              idBase={idBase}
              panels
              label={t.tablist}
              value={tab}
              onValueChange={setTab}
              items={TABS.map((x) => ({
                id: x,
                label: t.tabs[x],
                count: counts[x],
              }))}
            />
            <TabPanel idBase={idBase} id={tab} value={tab}>
              <DataTable<Row>
                label={`${w.nav.translations}: ${t.tabs[tab]}`}
                rows={rows}
                columns={columns}
                rowKey={({ item }) => `${item.type}:${item.id}`}
                rowLabel={({ item }) => item.title}
                words={words}
                density="comfortable"
                onOpen={({ item, units }) => nav(editHref(item, units[0]))}
                empty={
                  <EmptyState
                    variant="no-results"
                    title={filtered ? w.noMatch : t.empty[tab]}
                    description={filtered ? t.empty[tab] : undefined}
                    clear={
                      filtered
                        ? { label: w.clearFilters, onClick: bar.clearAll }
                        : undefined
                    }
                  />
                }
                rowActions={({ item, units }) => (
                  <RowActions
                    label={item.title}
                    moreLabel={w.moreActions}
                    primary={{
                      id: "open",
                      icon: ICON.draft,
                      label: t.open,
                      onSelect: () => nav(editHref(item, units[0])),
                    }}
                    actions={
                      item.visibility === "public"
                        ? [
                            {
                              id: "live",
                              icon: ICON.published,
                              label: posts.viewLive,
                              onSelect: () =>
                                window.open(
                                  heRoute(item.route),
                                  "_blank",
                                  "noopener",
                                ),
                            },
                          ]
                        : []
                    }
                  />
                )}
              />
            </TabPanel>
          </>
        )}
      </div>
    </AdminShell>
  );
}
