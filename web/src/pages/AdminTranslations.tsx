import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import TranslationPill from "@/components/admin/TranslationPill";
import { Counter, ErrorState, LoadingRows, PageHeader } from "@/components/admin/ui";
import { useAdminWords } from "@/i18n/admin";
import {
  TABS,
  TRANSLATION_TYPES,
  editHref,
  tabOf,
  useTranslationReport,
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

const TAB_LABEL: Record<TranslationTab, string> = { missing: "Missing", stale: "Stale", draft: "Draft", done: "Done" };
const TAB_EMPTY: Record<TranslationTab, string> = {
  missing: "Every field a reader sees has Hebrew.",
  stale: "No Hebrew is behind its English.",
  draft: "No Hebrew is waiting in a draft.",
  done: "Nothing is translated yet.",
};
const TYPE_LABEL: Record<TranslationType, string> = {
  post: "Note",
  area: "Area",
  project: "Project",
  story: "Story",
  "site-copy": "Site copy",
};
const TYPE_PLURAL: Record<TranslationType, string> = {
  post: "Notes",
  area: "Areas",
  project: "Projects",
  story: "Story",
  "site-copy": "Site copy",
};
type Visibility = "public" | "all" | "private";
const VISIBILITY_LABEL: Record<Visibility, string> = { public: "Public only", all: "Public and private", private: "Private only" };

const isTab = (v: string | null): v is TranslationTab => TABS.includes(v as TranslationTab);
const isType = (v: string | null): v is TranslationType => TRANSLATION_TYPES.includes(v as TranslationType);
const isVisibility = (v: string | null): v is Visibility => v === "public" || v === "all" || v === "private";

/** `decisions.2.body` → `decisions`; a list's units are counted under its name. */
function fieldsOf(units: TranslationUnit[]): string {
  const counts = new Map<string, number>();
  for (const u of units) {
    const head = u.path.split(".").filter((p) => !/^\d+$/.test(p))[0] ?? u.path;
    counts.set(head, (counts.get(head) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(", ");
}

export default function AdminTranslations() {
  const w = useAdminWords();
  const { report, error, reload } = useTranslationReport();
  const [params, setParams] = useSearchParams();
  const tab: TranslationTab = isTab(params.get("status")) ? (params.get("status") as TranslationTab) : "missing";
  const type: TranslationType | "all" = isType(params.get("type")) ? (params.get("type") as TranslationType) : "all";
  const visibility: Visibility = isVisibility(params.get("visibility")) ? (params.get("visibility") as Visibility) : "public";

  const setParam = (key: string, value: string, fallback: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  /* The type and visibility scope the counts; the tab then picks the units. */
  const scoped = useMemo(
    () =>
      (report?.items ?? []).filter(
        (i) => (type === "all" || i.type === type) && (visibility === "all" || i.visibility === visibility),
      ),
    [report, type, visibility],
  );
  const counts = useMemo(() => {
    const c: Record<TranslationTab, number> = { missing: 0, stale: 0, draft: 0, done: 0 };
    for (const i of scoped) for (const u of i.units) c[tabOf(u.status)] += 1;
    return c;
  }, [scoped]);
  const coverage = useMemo(() => {
    const total = counts.missing + counts.stale + counts.draft + counts.done;
    return total ? Math.round(((counts.done + counts.stale) / total) * 100) : 100;
  }, [counts]);
  const rows = useMemo(
    () =>
      scoped.flatMap((item) => {
        const units = item.units.filter((u) => tabOf(u.status) === tab);
        return units.length ? [{ item, units }] : [];
      }),
    [scoped, tab],
  );

  return (
    <AdminShell title={w.nav.translations} section="translations">
      <div className="a-wrap">
        <PageHeader
          title={w.nav.translations}
          meta={
            report && (
              <span className="tabular-nums">
                Hebrew coverage <strong>{coverage}%</strong>
              </span>
            )
          }
          description={
            <>
              Every field a reader sees in Hebrew, in the order they meet it. Stale Hebrew stays on the site until you
              update it or mark it still correct.
            </>
          }
        />

        <div className="a-toolbar">
          <label className="w-full sm:w-auto">
            <span className="sr-only">Filter by type</span>
            <select className="a-select sm:w-44" value={type} onChange={(e) => setParam("type", e.target.value, "all")}>
              <option value="all">All types</option>
              {TRANSLATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_PLURAL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="w-full sm:w-auto">
            <span className="sr-only">Filter by visibility</span>
            <select className="a-select sm:w-52" value={visibility} onChange={(e) => setParam("visibility", e.target.value, "public")}>
              {(["public", "all", "private"] as const).map((v) => (
                <option key={v} value={v}>
                  {VISIBILITY_LABEL[v]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="sr-only" role="status">
          {report === null ? w.loading : `${rows.length} ${rows.length === 1 ? "item" : "items"}, ${TAB_LABEL[tab].toLowerCase()}`}
        </p>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : report === null ? (
          <LoadingRows rows={6} />
        ) : (
          <div className="a-box">
            <div className="a-box-head !p-0 !min-h-0">
              <div className="a-tabs w-full border-0 px-2" role="group" aria-label="Filter by Hebrew status">
                {TABS.map((t) => (
                  <button key={t} type="button" className="a-tab" aria-pressed={tab === t} onClick={() => setParam("status", t, "missing")}>
                    {TAB_LABEL[t]}
                    <Counter n={counts[t]} />
                  </button>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="a-blank">
                <p className="a-blank-title">{TAB_EMPTY[tab]}</p>
                {(type !== "all" || visibility !== "public") && (
                  <p className="a-blank-text">Only {type === "all" ? "" : `${TYPE_PLURAL[type].toLowerCase()}, `}{VISIBILITY_LABEL[visibility].toLowerCase()} are shown.</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="a-table">
                  <caption className="sr-only">
                    {w.nav.translations}: {TAB_LABEL[tab]}
                  </caption>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Hebrew</th>
                      <th scope="col">Item</th>
                      <th scope="col">Seen on</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ item, units }) => {
                      const href = editHref(item, units[0]);
                      return (
                        <tr key={`${item.type}:${item.id}`}>
                          <td className="a-fit !pr-0 align-top">
                            <TranslationPill status={units.reduce((worst, u) => (RANK[u.status] < RANK[worst] ? u.status : worst), units[0].status)} />
                          </td>
                          <td>
                            <Link to={href} className="a-row-title">
                              {item.title}
                            </Link>
                            <span className="a-row-meta">
                              <span>{TYPE_LABEL[item.type]}</span>
                              <span className="min-w-0 [overflow-wrap:anywhere]">{fieldsOf(units)}</span>
                              {item.visibility === "private" && <span>Private</span>}
                              <code dir="ltr" className="md:hidden">
                                {heRoute(item.route)}
                              </code>
                            </span>
                          </td>
                          <td className="a-fit hidden md:table-cell">
                            <code dir="ltr" className="text-[0.8125rem] text-[rgb(var(--ink-soft))]">
                              {heRoute(item.route)}
                            </code>
                          </td>
                          <td className="a-fit !pl-0">
                            {/* The visible word starts the accessible name (WCAG 2.5.3). */}
                            <Link to={href} className="a-btn a-btn-ghost">
                              Edit<span className="sr-only"> {item.title}</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

/** The row's pill: the worst of the units it lists. */
const RANK = { missing: 0, stale: 1, draft: 2, unverified: 3, translated: 4 } as const;

const heRoute = (route: string) => (route === "/" ? "/he" : `/he${route}`);
