/*
 * A dev-only page that draws the admin list kit (DataTable, RowActions,
 * FilterBar, FilterChips, Skeleton, EmptyState) in its states, so a screenshot
 * can show them without logging in. Not part of the build (vite builds
 * index.html only). `?lang=he&theme=dark&select=1&only=table&density=compact`;
 * see scripts/a11y/admin-kit-gallery.mjs.
 */
import "../src/index.css";
import { StrictMode, useMemo, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Archive, Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { DataTable, type Column, type DataTableWords } from "@/components/ui/DataTable";
import { RowActions } from "@/components/ui/RowActions";
import { FilterBar, useFilterBar, type FilterBarWords } from "@/components/ui/FilterBar";
import { FilterChips } from "@/components/ui/FilterChips";
import { SelectionHeader } from "@/components/ui/SelectionBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSelection } from "@/components/ui/useSelection";
import type { FilterDef } from "@/components/ui/filters";

const q = new URLSearchParams(location.search);
const lang = q.get("lang") === "he" ? "he" : "en";
document.documentElement.lang = lang;
document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
document.documentElement.setAttribute("data-theme", q.get("theme") === "dark" ? "dark" : "light");

const T = {
  en: {
    title: "Posts", status: "Status", views: "Views (30 days)", updated: "Updated", area: "Area",
    search: "Search posts", clearSearch: "Clear search", results: (n: number) => `${n} results`, clearAll: "Clear all",
    edit: "Edit", more: "More", dup: "Duplicate", open: "Open on site", archive: "Archive", del: "Delete",
    pub: "Published", draft: "Draft", hidden: "Hidden", loading: "Loading", firstTitle: "No posts yet",
    firstText: "Write a post and it shows up here.", newPost: "New post", noTitle: "No post matches",
    errTitle: "Posts did not load", retry: "Retry", clear: "Clear filters", actions: "Actions",
    names: ["Launch notes", "How the audience import checks addresses before it sends anything at all", "pnpm-workspace-and-turbo-pipeline-configuration-notes-2026", "Retrospective", "Short", "A note on caching"],
    areas: ["Notes", "Projects", "Lab notes", "Notes", "Notes", "Lab notes"],
    stages: ["Finished sending", "Needs attention", "Scheduled", "Waiting for review", "Draft"],
  },
  he: {
    title: "פוסטים", status: "סטטוס", views: "צפיות (30 יום)", updated: "עודכן", area: "תחום",
    search: "חיפוש פוסטים", clearSearch: "ניקוי חיפוש", results: (n: number) => `${n} תוצאות`, clearAll: "ניקוי הכול",
    edit: "עריכה", more: "עוד", dup: "שכפול", open: "פתיחה באתר", archive: "העברה לארכיון", del: "מחיקה",
    pub: "פורסם", draft: "טיוטה", hidden: "מוסתר", loading: "טוען", firstTitle: "עדיין אין פוסטים",
    firstText: "כתבו פוסט והוא יופיע כאן.", newPost: "פוסט חדש", noTitle: "אין פוסט שמתאים",
    errTitle: "הפוסטים לא נטענו", retry: "ניסיון חוזר", clear: "ניקוי מסננים", actions: "פעולות",
    names: ["הערות השקה", "איך ייבוא הקהל בודק כתובות לפני ששולחים משהו בכלל", "pnpm-workspace-and-turbo-pipeline-configuration-notes-2026", "סיכום רבעון", "קצר", "הערה על מטמון"],
    areas: ["הערות", "פרויקטים", "מעבדה", "הערות", "הערות", "מעבדה"],
    stages: ["שליחה הסתיימה", "דורש תשומת לב", "מתוזמן", "ממתין לבדיקה", "טיוטה"],
  },
}[lang];

type Post = { id: string; title: string; area: string; status: "published" | "draft" | "hidden"; views: number; updated: string };
const ROWS: Post[] = Array.from({ length: 12 }, (_, i): Post => ({
  id: `p${i}`,
  title: T.names[i % T.names.length],
  area: T.areas[i % T.areas.length],
  status: i % 4 === 3 ? "draft" : i % 7 === 6 ? "hidden" : "published",
  views: [1204, 38, 15920, 7, 450, 2310][i % 6] * (i + 1),
  updated: new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" }).format(new Date(2026, 10, 14 - i)),
}));

const defs: FilterDef[] = [
  { id: "status", kind: "segmented", label: T.status, options: [{ value: "published", label: T.pub }, { value: "draft", label: T.draft }, { value: "hidden", label: T.hidden }] },
  { id: "stage", kind: "segmented", label: `${T.status} 2`, options: T.stages.map((s) => ({ value: s, label: s })) },
];

const words: DataTableWords = {
  selectAll: lang === "he" ? "בחירת הכול" : "Select all",
  selectRow: (t) => (lang === "he" ? `בחירה: ${t}` : `Select ${t}`),
  actions: T.actions,
  loading: T.loading,
  bulkLabel: lang === "he" ? "פעולות קבוצתיות" : "Bulk actions",
  count: (n) => (lang === "he" ? `${n} נבחרו` : `${n} selected`),
  cancel: lang === "he" ? "ביטול" : "Cancel",
  more: T.more,
};
const fbWords: FilterBarWords = { search: T.search, clearSearch: T.clearSearch, results: T.results, clearAll: T.clearAll };
const nf = new Intl.NumberFormat(lang);

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} style={{ marginBlock: "1.5rem" }}>
      <h2 style={{ fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.5rem", color: "rgb(var(--ink-soft))" }}>{title}</h2>
      {children}
    </section>
  );
}

const glyph = (I: typeof Pencil) => {
  const G = (p: { className?: string }) => <I className={p.className} aria-hidden="true" />;
  return G;
};

function Gallery() {
  const bar = useFilterBar("kit-gallery", defs);
  const rows = useMemo(
    () => ROWS.filter((r) => (!bar.filters.status || r.status === bar.filters.status) && (!bar.query || r.title.toLowerCase().includes(bar.query.toLowerCase()))),
    [bar.filters, bar.query],
  );
  const selection = useSelection(rows.map((r) => r.id));
  const [entered, setEntered] = useState(false);
  if (q.get("select") === "1" && !entered) {
    setEntered(true);
    selection.enter(rows[1]?.id);
  }

  const statusWord = (s: Post["status"]) => (s === "published" ? T.pub : s === "draft" ? T.draft : T.hidden);
  const columns: Column<Post>[] = [
    { id: "title", header: T.title, cell: (r) => r.title, sort: (a, b) => a.title.localeCompare(b.title), primary: true },
    /* A status column says only what is NOT the norm: published is blank (A6). */
    { id: "status", header: T.status, cell: (r) => (r.status === "published" ? "" : statusWord(r.status)), hideBelow: "md", width: "7rem" },
    { id: "area", header: T.area, cell: (r) => r.area, hideBelow: "sm", width: "8rem" },
    { id: "views", header: T.views, cell: (r) => nf.format(r.views), align: "num", sort: (a, b) => a.views - b.views, width: "9rem" },
    { id: "updated", header: T.updated, cell: (r) => r.updated, width: "6rem" },
  ];
  const rowActions = (r: Post) => (
    <RowActions
      label={`${T.actions}: ${r.title}`}
      moreLabel={T.more}
      primary={{ id: "edit", icon: glyph(Pencil), label: T.edit, onSelect: () => {} }}
      actions={[
        { id: "dup", icon: glyph(Copy), label: T.dup, onSelect: () => {} },
        { id: "open", icon: glyph(ExternalLink), label: T.open, onSelect: () => {} },
        { id: "del", icon: glyph(Trash2), label: T.del, onSelect: () => {}, tone: "danger" },
      ]}
    />
  );
  const common = {
    label: T.title,
    columns,
    rowKey: (r: Post) => r.id,
    rowLabel: (r: Post) => r.title,
    words,
    onOpen: () => {},
    rowActions,
    selection,
    bulkActions: [
      { id: "arch", label: T.archive, icon: Archive, onRun: () => {} },
      { id: "del", label: T.del, icon: Trash2, onRun: () => {}, tone: "danger" as const, confirm: (n: number) => `${T.del} (${n})` },
    ],
    phoneRow: (r: Post) => ({
      icon: <span />,
      title: r.title,
      openLabel: r.title,
      facts: [{ text: r.area }, { text: nf.format(r.views) }] as [{ text: string }, { text: string }],
    }),
  };
  const density = q.get("density") === "compact" ? "compact" : q.get("density") === "comfortable" ? "comfortable" : undefined;
  const only = q.get("only");
  const show = (id: string) => !only || only === id;

  return (
    <div className="a-app" style={{ padding: "1rem", minHeight: "100vh", background: "rgb(var(--paper))", color: "rgb(var(--ink))", fontFamily: "Rubik, system-ui, sans-serif" }}>
      {show("table") && (
        <Section id="table" title="FilterBar + DataTable">
          <FilterBar defs={defs} value={bar.filters} onChange={bar.setFilters} common={["status"]} query={bar.query} onQueryChange={bar.setQuery} resultCount={rows.length} words={fbWords} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginBlock: "0.5rem" }}>
            <SelectionHeader selection={selection} total={rows.length} />
          </div>
          <DataTable {...common} rows={rows} density={density} />
        </Section>
      )}
      {show("grouped") && (
        <Section id="grouped" title="Grouped: the status once, as a header">
          <DataTable
            {...common}
            columns={columns.filter((c) => c.id !== "status")}
            rows={[...rows].sort((a, b) => a.status.localeCompare(b.status))}
            groupBy={(r) => (r.status === "published" ? null : r.status)}
            groupLabel={(k, l) => `${statusWord(k as Post["status"])} · ${l.length}`}
          />
        </Section>
      )}
      {show("chips") && (
        <Section id="chips" title="Chip row beside Select (the collision)">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", minInlineSize: 0 }}>
            <div style={{ flex: "1 1 12rem", minInlineSize: 0 }}>
              <FilterChips defs={defs} value={{}} onChange={() => {}} common={["stage"]} onOpenSheet={() => {}} />
            </div>
            <SelectionHeader selection={selection} total={4} />
          </div>
        </Section>
      )}
      {show("states") && (
        <Section id="states" title="Loading, first use, no results, error">
          <DataTable {...common} rows={[]} loading />
          <DataTable {...common} rows={[]} empty={<EmptyState variant="first-use" title={T.firstTitle} description={T.firstText} action={{ label: T.newPost, onClick: () => {} }} />} />
          <DataTable
            {...common}
            rows={[]}
            empty={<EmptyState variant="no-results" title={T.noTitle} filters={[`${T.status}: ${T.draft}`, `${T.area}: ${T.areas[1]}`]} clear={{ label: T.clear, onClick: () => {} }} />}
          />
          <DataTable {...common} rows={ROWS.slice(0, 3)} error={{ title: T.errTitle, retry: T.retry, onRetry: () => {} }} />
          <Skeleton variant="cards" rows={3} label={T.loading} />
        </Section>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Gallery />
    </BrowserRouter>
  </StrictMode>,
);
