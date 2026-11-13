/* eslint-disable react-refresh/only-export-components -- entry file, never hot-reloaded */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Mail } from "lucide-react";
import "@/index.css";
import { FilterChips, FiltersRestoredNote } from "@/components/ui/FilterChips";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { filterCount, type DateRange, type FilterDef, type Filters } from "@/components/ui/filters";
import { useSavedFilters } from "@/components/ui/useSavedFilters";

const params = new URLSearchParams(location.search);
const rtl = params.get("dir") === "rtl";
const dark = params.get("theme") === "dark";
document.documentElement.dir = rtl ? "rtl" : "ltr";
document.documentElement.lang = rtl ? "he" : "en";
document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
if (params.get("seed")) {
  try {
    window.localStorage.setItem("admin.filters.demo", params.get("seed") ?? "");
  } catch {
    /* demo only */
  }
}

const t = rtl
  ? {
      title: "קהל", status: "סטטוס", lang: "שפה", group: "קבוצה", created: "תאריך הצטרפות", sort: "מיון",
      active: "פעיל", pending: "ממתין", bounced: "חזר",
      en: "EN", he: "עב", newest: "החדשים", name: "שם", p7: "7 הימים האחרונים",
      groups: ["ניוזלטר", "לקוחות", "מגייסים", "קולגות", "חברים", "משפחה", "קהילה", "אירועים", "ספקים", "אחר"],
      countOf: (n: number, m: number) => `${n} מתוך ${m}`, open: "פתיחת סינון",
    }
  : {
      title: "Audience", status: "Status", lang: "Language", group: "Group", created: "Joined", sort: "Sort by",
      active: "Active", pending: "Pending", bounced: "Bounced",
      en: "EN", he: "עב", newest: "Newest", name: "Name", p7: "Last 7 days",
      groups: ["Newsletter", "Clients", "Recruiters", "Colleagues", "Friends", "Family", "Community", "Events", "Vendors", "Other"],
      countOf: (n: number, m: number) => `${n} of ${m}`, open: "Open filters",
    };

const defs: FilterDef[] = [
  { id: "status", kind: "segmented", label: t.status, options: [{ value: "active", label: t.active }, { value: "pending", label: t.pending }, { value: "bounced", label: t.bounced }] },
  { id: "lang", kind: "segmented", label: t.lang, options: [{ value: "en", label: t.en }, { value: "he", label: t.he }] },
  { id: "group", kind: "multi", label: t.group, options: t.groups.map((label, i) => ({ value: `g${i}`, label })) },
  { id: "created", kind: "range", label: t.created, presets: [{ label: t.p7, from: "2026-11-07", to: "2026-11-14" }] },
  { id: "sort", kind: "sort", label: t.sort, options: [{ value: "new", label: t.newest }, { value: "name", label: t.name }] },
];

const STATUSES = ["active", "pending", "bounced"] as const;
const rows = Array.from({ length: 42 }, (_, i) => ({
  id: i,
  email: `p${i + 1}@example.com`,
  status: STATUSES[i % 3],
  lang: i % 4 === 0 ? "he" : "en",
  group: `g${i % 10}`,
  day: `2026-11-${String((i % 14) + 1).padStart(2, "0")}`,
}));

function match(f: Filters) {
  const r = f.created as DateRange | undefined;
  const groups = (f.group as string[] | undefined) ?? [];
  return rows
    .filter((x) => (!f.status || x.status === f.status) && (!f.lang || x.lang === f.lang) && (groups.length === 0 || groups.includes(x.group)))
    .filter((x) => (!r?.from || x.day >= r.from) && (!r?.to || x.day <= r.to))
    .sort((a, b) => (f.sort === "name" ? a.email.localeCompare(b.email) : b.day.localeCompare(a.day)));
}

function Demo() {
  const [filters, set, state] = useSavedFilters("demo", defs);
  const [open, setOpen] = useState(params.get("sheet") === "open");
  const shown = match(filters);
  return (
    <div className="a-app" style={{ padding: "1rem", display: "grid", gap: 12, alignContent: "start" }}>
      <h2 style={{ fontWeight: 700 }}>{t.title}</h2>
      <FilterChips defs={defs} value={filters} onChange={set} common={["status", "lang"]} onOpenSheet={() => setOpen(true)} resultCount={shown.length} />
      <FiltersRestoredNote restored={state.restored} onUndo={state.undoRestore} onDismiss={state.dismissRestored} />
      {filterCount(defs, filters) > 0 && (
        <p role="status" style={{ margin: 0, fontVariantNumeric: "tabular-nums", color: "rgb(var(--ink-soft))" }}>{t.countOf(shown.length, rows.length)}</p>
      )}
      <div style={{ border: "1px solid var(--a-line)", borderRadius: "var(--a-r-box)" }}>
        {shown.slice(0, 8).map((r) => (
          <RecordRow key={r.id} icon={Mail} title={r.email} facts={[{ text: r.day, dir: "ltr" }]} status={<StatusGlyph kind={r.status === "active" ? "mailable" : r.status === "pending" ? "pending" : "suppressed"} showDefault />} openLabel={`${t.open} ${r.email}`} onOpen={() => {}} />
        ))}
      </div>
      <FilterSheet open={open} onClose={() => setOpen(false)} defs={defs} value={filters} onApply={set} resultCount={(d) => match(d).length} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Demo />
  </BrowserRouter>,
);
