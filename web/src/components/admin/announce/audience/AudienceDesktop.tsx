import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ACTION_ICON } from "./sourceIcon";
import { Empty, EmptyState, ErrorState } from "@/components/admin/ui";
import { ControlBar, type ControlItem } from "@/components/ui/ControlBar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Disclosure } from "@/components/ui/Disclosure";
import { FilterBar } from "@/components/ui/FilterBar";
import { FiltersRestoredNote } from "@/components/ui/FilterChips";
import type { FilterDef } from "@/components/ui/filters";
import { ICON } from "@/components/ui/icons";
import { RowActions } from "@/components/ui/RowActions";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { useSavedFilters } from "@/components/ui/useSavedFilters";
import { useFiltersWords } from "@/i18n/filters";
import { adminAudience, CONTACT_STATUSES, EXPORT_URL, type Contact, type ContactStatus, type Group } from "@/services/adminAudience";
import { isNotAuthorised } from "@/services/authError";
import AddContact from "./AddContact";
import ContactEditor, { type GuardHook, type LeaveGuard } from "./ContactEditor";
import Email from "./Email";
import GroupsPanel from "./GroupsPanel";
import ImportDialog from "./ImportDialog";
import DataExport from "./DataExport";
import SweepNote from "./SweepNote";
import SuppressionPanel from "./SuppressionPanel";
import { useAudienceWords } from "./words";

/* What is open beside the list. `n` makes a reopened panel a fresh form, so edits abandoned earlier never come back. */
type Panel = { kind: "add"; n: number } | { kind: "edit"; contact: Contact; n: number };

/* Only what keeps a person from being mailed draws a glyph: mailable is the normal case and says nothing (A6). */
const SHOWN: ReadonlySet<ContactStatus> = new Set(["pending", "unsubscribed", "suppressed"]);

const nf = new Intl.NumberFormat("en-GB");

/*
 * The Audience tab on a wide screen (600px and up; AudiencePhone is the narrow one). Daily on top: find a person,
 * see why they are or are not mailable, edit them. Weekly: add, import, export. Rare, collapsed: groups and the
 * suppression list. A person opens in a side panel, so the list stays where it was. Nothing here sends mail, and
 * neither the search text nor an address ever reaches the address bar: it carries only status and group.
 */
export default function AudienceDesktop() {
  const w = useAudienceWords();
  const fw = useFiltersWords();
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsReady, setGroupsReady] = useState(false);
  const [items, setItems] = useState<Contact[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<"load" | "auth" | null>(null);
  const [more, setMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  /* Which list is on screen: a "Load more" answered after the search or a filter changed is for a list that is gone. */
  const listId = useRef(0);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tick, setTick] = useState(0);
  const panels = useRef(0);
  /* The open panel's own "may I leave?" (it asks when edits are not saved). */
  const leave = useRef<LeaveGuard | null>(null);
  const onGuard = useCallback<GuardHook>((g, was) => {
    if (g) leave.current = g;
    else if (leave.current === was) leave.current = null;
  }, []);
  const uid = useId();

  const defs = useMemo<FilterDef[]>(
    () => [
      { id: "status", kind: "segmented", label: w.filterStatus, options: CONTACT_STATUSES.map((s) => ({ value: s, label: w.statuses[s] })) },
      { id: "group", kind: "segmented", label: w.filterGroup, options: groups.map((g) => ({ value: g.slug, label: `${g.name} (${nf.format(g.count)})`, count: g.count })) },
    ],
    [w, groups],
  );
  const [filters, setFilters, saved] = useSavedFilters("audience", defs);
  const status = (typeof filters.status === "string" ? filters.status : "") as ContactStatus | "";
  const group = typeof filters.group === "string" ? filters.group : "";

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const loadGroups = useCallback(() => void adminAudience.groups().then(setGroups, () => {}).finally(() => setGroupsReady(true)), []);
  useEffect(loadGroups, [loadGroups]);

  /* Held until the groups are known: an address with group=friends is read against them, and must not list everyone meanwhile. */
  useEffect(() => {
    if (!groupsReady) return;
    let live = true;
    listId.current += 1;
    adminAudience.contacts({ group, status, q: term }).then(
      (p) => live && (setItems(p.items), setNext(p.nextCursor), setError(null), setMore(false), setMoreFailed(false)),
      (e: unknown) => live && setError(isNotAuthorised(e) ? "auth" : "load"),
    );
    return () => {
      live = false;
    };
  }, [groupsReady, group, status, term, tick]);

  /* A reload keeps the rows on screen until the new ones arrive, so the row that opened the panel is still there to take focus back. */
  const reload = () => (setError(null), setTick((n) => n + 1));
  const closePanel = () => setPanelOpen(false);
  const refreshed = () => (closePanel(), loadGroups(), reload());
  const openPanel = async (next: Omit<Panel, "n">) => {
    /* Another row while edits are unsaved asks the same question closing does. */
    if (panelOpen && leave.current && !(await leave.current())) return;
    setPanel({ ...next, n: ++panels.current } as Panel);
    setPanelOpen(true);
  };
  const loadMore = async () => {
    if (!next) return;
    const asked = listId.current;
    setMore(true);
    setMoreFailed(false);
    try {
      const p = await adminAudience.contacts({ group, status, q: term, cursor: next });
      if (asked !== listId.current) return;
      setItems((cur) => [...(cur ?? []), ...p.items]);
      setNext(p.nextCursor);
    } catch {
      /* The rows already read stay; only the button says it failed. */
      if (asked === listId.current) setMoreFailed(true);
    }
    if (asked === listId.current) setMore(false);
  };
  const exportAll = () => {
    const a = document.createElement("a");
    a.href = EXPORT_URL;
    a.download = "";
    a.click();
  };

  const filtered = Boolean(group || status || term);
  const groupName = (slug: string) => groups.find((g) => g.slug === slug)?.name ?? slug;

  /* One primary, one secondary, the rest in More (A1). */
  const actions: ControlItem[] = [
    { id: "add", icon: ICON.add, label: w.addContact, tone: "primary", showLabel: "always", priority: 3, onSelect: () => void openPanel({ kind: "add" }) },
    { id: "import", icon: ACTION_ICON.import, label: w.importCsv, showLabel: "always", priority: 2, onSelect: () => setImporting(true) },
    { id: "export", icon: ACTION_ICON.export, label: w.exportCsv, priority: 0, onSelect: exportAll },
  ];

  const columns: Column<Contact>[] = [
    { id: "email", header: w.colEmail, primary: true, cell: (c) => <Email value={c.email} /> },
    { id: "name", header: w.colName, hideBelow: "md", width: "12rem", cell: (c) => (c.name ? <bdi dir="auto" title={c.name}>{c.name}</bdi> : <Empty />) },
    { id: "lang", header: w.colLang, hideBelow: "lg", width: "6rem", cell: (c) => (c.lang ? w.langs[c.lang] : <Empty />) },
    { id: "groups", header: w.colGroups, hideBelow: "lg", width: "12rem", cell: (c) => (c.groups.length ? <span dir="auto" title={c.groups.map(groupName).join(", ")}>{c.groups.map(groupName).join(", ")}</span> : <Empty />) },
    { id: "status", header: w.colStatus, width: "4.5rem", cell: (c) => (SHOWN.has(c.status) ? <StatusGlyph kind={c.status as "pending" | "unsubscribed" | "suppressed"} /> : null) },
  ];
  /* No selection here, so only the labels the table draws matter. */
  const tableWords = { selectAll: w.cancel, selectRow: (l: string) => l, actions: w.colActions, loading: w.loading, bulkLabel: w.colActions, count: (n: number) => String(n), cancel: w.cancel, more: w.more };

  return (
    <div className="max-w-5xl space-y-6" data-testid="audience">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display-tight text-xl">{w.heading}</h2>
          <p className="a-hint">{w.intro}</p>
        </div>
        <ControlBar label={w.actionsLabel} moreLabel={w.more} items={actions} max={2} className="!gap-2" />
      </div>

      <FilterBar
        defs={defs}
        value={filters}
        onChange={setFilters}
        common={["status", "group"]}
        query={q}
        onQueryChange={setQ}
        words={{ search: w.searchLabel, clearSearch: w.clearSearch, results: fw.results, clearAll: fw.clearAll }}
      />

      <FiltersRestoredNote restored={saved.restored} onUndo={saved.undoRestore} onDismiss={saved.dismissRestored} />

      {error ? (
        <ErrorState message={error === "auth" ? w.notAuthorised : w.loadFailed} signIn={error === "auth"} onRetry={reload} />
      ) : (
        <div>
          <DataTable
            label={w.tableLabel}
            rows={items ?? []}
            columns={columns}
            rowKey={(c) => c.hash}
            rowLabel={(c) => c.email}
            words={tableWords}
            loading={!items}
            empty={<EmptyState title={filtered ? w.empty : w.emptyFirst} />}
            onOpen={(c) => void openPanel({ kind: "edit", contact: c })}
            rowActions={(c) => (
              <RowActions
                label={w.editFor(c.email)}
                moreLabel={w.more}
                actions={[{ id: "edit", icon: ACTION_ICON.edit, label: w.edit, onSelect: () => void openPanel({ kind: "edit", contact: c }) }]}
              />
            )}
          />
          {items && items.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="a-hint !mt-0 tabular-nums" role="status">{w.count(items.length)}</p>
              {next && (
                <button type="button" className="a-btn min-h-[44px]" disabled={more} onClick={() => void loadMore()}>{more ? w.loadingMore : moreFailed ? w.loadMoreFailed : w.loadMore}</button>
              )}
            </div>
          )}
        </div>
      )}

      <SweepNote />
      <Disclosure className="a-box" summary={w.groupsHeading} meta={<span className="tabular-nums">{nf.format(groups.length)}</span>}>
        <GroupsPanel groups={groups} onChange={loadGroups} />
      </Disclosure>
      <DataExport />
      <Disclosure className="a-box" summary={w.suppressionHeading}>
        <SuppressionPanel />
      </Disclosure>

      {panel?.kind === "add" && <AddContact key={`${uid}-a${panel.n}`} open={panelOpen} groups={groups} onGuard={onGuard} onClose={closePanel} onDone={refreshed} />}
      {panel?.kind === "edit" && <ContactEditor key={`${uid}-e${panel.contact.hash}-${panel.n}`} open={panelOpen} contact={panel.contact} groups={groups} onGuard={onGuard} onClose={closePanel} onDone={refreshed} />}
      {importing && <ImportDialog groups={groups} onClose={() => (setImporting(false), reload(), loadGroups())} onDone={loadGroups} />}
    </div>
  );
}
