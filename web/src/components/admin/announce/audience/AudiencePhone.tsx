import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SheetPresence } from "@/components/ui/SheetPresence";
import { Download, FileUp, UserPlus } from "lucide-react";
import { EmptyState, ErrorState, LoadingRows } from "@/components/admin/ui";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Disclosure } from "@/components/ui/Disclosure";
import { FilterChips, FiltersRestoredNote } from "@/components/ui/FilterChips";
import { FilterSheet } from "@/components/ui/FilterSheet";
import type { FilterDef } from "@/components/ui/filters";
import { ICON } from "@/components/ui/icons";
import { SkeletonSwap } from "@/components/ui/SkeletonSwap";
import { ListPresence } from "@/components/ui/ListPresence";
import { RecordRow, type Fact } from "@/components/ui/RecordRow";
import { SelectionBar, SelectionHeader, type SelectionAction } from "@/components/ui/SelectionBar";
import { StatusGlyph, type StatusKind } from "@/components/ui/StatusGlyph";
import { toast } from "@/lib/toast";
import { useUndoable } from "@/lib/toast/useUndoable";
import { useSavedFilters } from "@/components/ui/useSavedFilters";
import { useSelection } from "@/components/ui/useSelection";
import { isNotAuthorised } from "@/services/authError";
import { adminAudience, CONTACT_STATUSES, EXPORT_URL, type Contact, type ContactLang, type ContactPatch, type ContactStatus, type Group } from "@/services/adminAudience";
import AddContact from "./AddContact";
import ContactSheet from "./ContactSheet";
import { toCsv } from "./csv";
import DataExport from "./DataExport";
import { fillPage } from "./fillPage";
import GroupsPanel from "./GroupsPanel";
import ImportDialog from "./ImportDialog";
import { SOURCE_ICON } from "./sourceIcon";
import SuppressionPanel from "./SuppressionPanel";
import SweepNote from "./SweepNote";
import { useSweepWords } from "./sweepWords";
import { useWhen } from "./useWhen";
import { useAudienceWords } from "./words";

type Dialog = { kind: "add" } | { kind: "import" } | { kind: "edit"; contact: Contact } | null;

/* Only what keeps a person from being mailed is drawn on a row; mailable is the normal case and draws nothing. */
const ROW_GLYPH: Partial<Record<ContactStatus, StatusKind>> = { pending: "pending", unsubscribed: "unsubscribed", suppressed: "suppressed" };

const itemClass = "flex min-h-[44px] w-full items-center gap-3 rounded-[var(--a-r-ctl)] px-3 text-start font-semibold";

/*
 * The Audience tab below 600px. The job: find a person, see whether they can be mailed and why, and fix it.
 * A row is the person (a name, else the address whole), their language and when they joined, and one glyph only
 * when something stops their mail. Detail, editing and consent are in a sheet. Search text lives in memory and is
 * never written to the address bar or to storage: the address carries only status, language and group.
 * Nothing here can make a person mailable again in bulk.
 */
export default function AudiencePhone() {
  const w = useAudienceWords();
  const sweep = useSweepWords();
  const when = useWhen();
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
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState<string[] | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [tick, setTick] = useState(0);
  const plus = useRef<HTMLButtonElement>(null);
  const lastRow = useRef<HTMLElement | null>(null);
  const undoable = useUndoable();
  const nf = new Intl.NumberFormat("en-GB");

  const defs = useMemo<FilterDef[]>(
    () => [
      { id: "status", kind: "segmented", label: w.filterStatus, options: CONTACT_STATUSES.map((s) => ({ value: s, label: w.statuses[s] })) },
      { id: "lang", kind: "segmented", label: w.language, options: (["en", "he"] as const).map((l) => ({ value: l, label: w.langs[l] })) },
      { id: "group", kind: "segmented", label: w.filterGroup, options: groups.map((g) => ({ value: g.slug, label: g.name, count: g.count })) },
    ],
    [w, groups],
  );
  const [filters, setFilters, saved] = useSavedFilters("audience", defs);
  const status = (typeof filters.status === "string" ? filters.status : "") as ContactStatus | "";
  const group = typeof filters.group === "string" ? filters.group : "";
  const lang = typeof filters.lang === "string" ? (filters.lang as ContactLang) : "";

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
    fillPage({ group, status, q: term }, lang).then(
      (p) => live && (setItems(p.items), setNext(p.nextCursor), setError(null), setMore(false), setMoreFailed(false)),
      (e: unknown) => live && setError(isNotAuthorised(e) ? "auth" : "load"),
    );
    return () => {
      live = false;
    };
  }, [groupsReady, group, status, lang, term, tick]);

  /* A reload keeps the rows on screen until the new ones arrive, so the row that opened a sheet is still there to take focus back. */
  const reload = () => (setError(null), setTick((n) => n + 1));
  const loadMore = async () => {
    if (!next) return;
    const asked = listId.current;
    setMore(true);
    setMoreFailed(false);
    try {
      const p = await fillPage({ group, status, q: term, cursor: next }, lang);
      if (asked !== listId.current) return;
      setItems((cur) => [...(cur ?? []), ...p.items]);
      setNext(p.nextCursor);
    } catch {
      /* The rows already read stay; only the button says it failed. */
      if (asked === listId.current) setMoreFailed(true);
    }
    if (asked === listId.current) setMore(false);
  };

  const visible = useMemo(() => (items ?? []).filter((c) => !hidden.has(c.hash) && (!lang || c.lang === lang)), [items, hidden, lang]);
  const selection = useSelection(useMemo(() => visible.map((c) => c.hash), [visible]));

  /* Back to what opened the sheet: the row, or the + button when the sheet came from its menu. */
  const refocus = (to: "row" | "plus") =>
    setTimeout(() => {
      const row = lastRow.current;
      (to === "row" && row?.isConnected ? row : plus.current)?.focus();
    }, 0);
  const closeEdit = () => (setDialog(null), refocus("row"));
  const closeAdd = () => (setDialog(null), refocus("plus"));
  const refreshed = () => (setDialog(null), loadGroups(), reload(), refocus("row"));

  /* ---------------------------------------------------------------- bulk */
  const chosen = (ids: string[]) => (items ?? []).filter((c) => ids.includes(c.hash));
  const settle = async (jobs: Array<Promise<unknown>>) => (await Promise.allSettled(jobs)).filter((r) => r.status === "rejected").length;
  const report = (done: number, failed: number, text: (n: number) => string, failedText: (n: number) => string) => (failed ? toast.error(failedText(failed)) : toast.success(text(done)));

  const setStatus = async (ids: string[], to: ContactStatus) => {
    const list = chosen(ids);
    const failed = await settle(list.map((c) => adminAudience.patchContact(c.hash, { status: to })));
    report(list.length - failed, failed, w.bulkStatusDone, w.bulkStatusFailed);
    reload();
  };
  const addToGroup = async (ids: string[], g: Group) => {
    const list = chosen(ids).filter((c) => !c.groups.includes(g.slug));
    const failed = await settle(list.map((c) => adminAudience.patchContact(c.hash, { groups: [...c.groups, g.slug] } satisfies ContactPatch)));
    report(ids.length - failed, failed, (n) => w.bulkGroupDone(n, g.name), w.bulkGroupFailed);
    setPick(null);
    loadGroups();
    reload();
  };
  const exportChosen = (ids: string[]) => {
    const head = [w.colEmail, w.colName, w.colLang, w.colStatus, w.colSource, w.colGroups];
    const rows = chosen(ids).map((c) => [c.email, c.name ?? "", c.lang ? w.langs[c.lang] : "", w.statuses[c.status], w.sources[c.source] ?? c.source, c.groups.join("; ")]);
    const url = URL.createObjectURL(new Blob([toCsv([head, ...rows])], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts-selected.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  /* The erasure is real and final, so it waits out the Undo window before it is asked of the server. */
  const erase = (ids: string[]) => {
    setHidden((h) => new Set([...h, ...ids]));
    const show = () => setHidden((h) => new Set([...h].filter((x) => !ids.includes(x))));
    undoable.schedule({
      message: w.erasing(ids.length),
      onUndo: show,
      commit: async () => {
        const failed = await settle(ids.map((hash) => adminAudience.eraseContact(hash)));
        if (failed) toast.error(w.bulkEraseFailed(failed));
        show();
        loadGroups();
        reload();
      },
    });
  };

  const actions: SelectionAction<string>[] = [
    { id: "group", icon: ICON.group, label: w.addToGroup, run: (ids) => setPick(ids) },
    { id: "export", icon: Download, label: w.exportSelected, run: exportChosen },
    { id: "unsub", icon: ICON.unsubscribed, label: w.unsubscribeAct, destructive: true, confirm: w.unsubscribeConfirm, run: (ids) => setStatus(ids, "unsubscribed") },
    { id: "suppress", icon: ICON.suppressed, label: w.suppressAct, destructive: true, confirm: w.suppressConfirm, run: (ids) => setStatus(ids, "suppressed") },
    { id: "delete", icon: ICON.delete, label: w.deleteAct, destructive: true, confirm: w.deleteConfirm, run: erase },
  ];

  const rowFor = (c: Contact) => {
    const title = c.name || c.email;
    const facts: Fact[] = [];
    if (c.lang) facts.push({ icon: ICON.language, text: w.langs[c.lang], label: w.language });
    const joined = when(c.createdAt ?? c.consentAt);
    if (joined) facts.push({ icon: ICON.when, text: joined, label: w.joined });
    const glyph = ROW_GLYPH[c.status];
    return (
      <RecordRow
        as="div"
        icon={SOURCE_ICON[c.source] ?? ICON.contact}
        title={title}
        facts={[facts[0], facts[1]]}
        status={glyph ? <StatusGlyph kind={glyph} /> : undefined}
        selectable={selection.on}
        selected={selection.has(c.hash)}
        openLabel={selection.on ? title : w.openContact(title)}
        onOpen={() => (selection.on ? selection.toggle(c.hash) : setDialog({ kind: "edit", contact: c }))}
        onLongPress={() => selection.enter(c.hash)}
      />
    );
  };

  const filtered = Boolean(group || status || lang || term);
  const manual = groups.filter((g) => g.kind === "manual");

  return (
    <div className="min-w-0 space-y-2" data-testid="audience">
      <h2 className="sr-only">{w.heading}</h2>

      {selection.on ? (
        <SelectionHeader selection={selection} total={visible.length} />
      ) : (
        <div className="flex items-stretch gap-2">
          <input type="search" className="a-input min-h-[44px] min-w-0 flex-1 !ps-3 text-base" dir="auto" aria-label={w.searchLabel} placeholder={w.searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
          {visible.length > 0 && <SelectionHeader selection={selection} total={visible.length} />}
          <button ref={plus} type="button" className="a-btn a-btn-primary min-h-[44px] min-w-[44px] shrink-0" aria-label={w.phoneAdd} onClick={() => setMenu(true)}>
            <ICON.add size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
          </button>
        </div>
      )}

      <FilterChips defs={defs} value={filters} onChange={setFilters} onOpenSheet={() => setSheet(true)} resultCount={visible.length} />
      <FiltersRestoredNote restored={saved.restored} onUndo={saved.undoRestore} onDismiss={saved.dismissRestored} />

      <p className="sr-only" role="status">{items ? w.count(visible.length) : ""}</p>

      <SkeletonSwap loading={!error && !items} skeleton={<LoadingRows label={w.loading} />}>
        {error ? (
          <ErrorState message={error === "auth" ? w.notAuthorised : w.loadFailed} signIn={error === "auth"} onRetry={reload} />
        ) : !items ? (
          null
        ) : visible.length === 0 && !next ? (
          <EmptyState title={filtered ? w.empty : w.emptyFirst} />
        ) : (
          <div>
            {visible.length === 0 ? (
              <EmptyState title={w.empty} />
            ) : (
              <ListPresence
                as="ul"
                items={visible}
                itemKey={(c) => c.hash}
                data-audience-list=""
                aria-label={w.tableLabel}
                className="a-box m-0 list-none overflow-hidden p-0"
                onClickCapture={(e) => (lastRow.current = (e.target as HTMLElement).closest<HTMLElement>("[data-record-row]"))}
              >
                {rowFor}
              </ListPresence>
            )}
            {next && (
              <div className="mt-3">
                <button type="button" className="a-btn min-h-[44px]" disabled={more} onClick={() => void loadMore()}>{more ? w.loadingMore : moreFailed ? w.loadMoreFailed : w.loadMore}</button>
              </div>
            )}
          </div>
        )}
      </SkeletonSwap>

      <SelectionBar selection={selection} actions={actions} />

      <div className="space-y-2 pt-2">
        <Disclosure className="a-box" summary={w.groupsHeading} meta={<span className="tabular-nums">{nf.format(groups.length)}</span>}>
          <GroupsPanel groups={groups} onChange={loadGroups} />
        </Disclosure>
        <Disclosure className="a-box" summary={w.suppressionHeading}>
          <SuppressionPanel />
        </Disclosure>
        <DataExport />
        <Disclosure className="a-box" summary={sweep.title}>
          <SweepNote bare />
        </Disclosure>
      </div>

      <BottomSheet open={menu} onClose={() => setMenu(false)} title={w.phoneAdd} snap="half" snaps={["half"]}>
        <div className="space-y-1">
          <button type="button" className={itemClass} onClick={() => setDialog({ kind: "add" })}>
            <UserPlus size={20} strokeWidth={1.75} aria-hidden="true" focusable="false" />
            {w.addContact}
          </button>
          <button type="button" className={itemClass} onClick={() => setDialog({ kind: "import" })}>
            <FileUp size={20} strokeWidth={1.75} aria-hidden="true" focusable="false" />
            {w.importCsv}
          </button>
          <a className={itemClass} href={EXPORT_URL} download title={w.exportHint}>
            <Download size={20} strokeWidth={1.75} aria-hidden="true" focusable="false" />
            {w.exportAll}
          </a>
        </div>
      </BottomSheet>

      <FilterSheet open={sheet} onClose={() => setSheet(false)} defs={defs} value={filters} onApply={(next) => (setFilters(next), setSheet(false))} />

      <BottomSheet open={pick !== null} onClose={() => setPick(null)} title={pick ? w.pickGroup(pick.length) : ""} snap="half" snaps={["half"]}>
        {manual.length === 0 ? (
          <p className="a-hint !mt-0">{w.noManualGroups}</p>
        ) : (
          <div className="space-y-1">
            {manual.map((g) => (
              <button key={g.slug} type="button" className={itemClass} dir="auto" onClick={() => pick && void addToGroup(pick, g)}>
                {g.name}
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

      <SheetPresence show={dialog?.kind === "add"}><AddContact sheet groups={groups} onClose={closeAdd} onDone={refreshed} /></SheetPresence>
      <SheetPresence show={dialog?.kind === "import"}><ImportDialog sheet groups={groups} onClose={() => (closeAdd(), reload(), loadGroups())} onDone={loadGroups} /></SheetPresence>
      <SheetPresence show={dialog?.kind === "edit"}>{dialog?.kind === "edit" && <ContactSheet contact={dialog.contact} groups={groups} onClose={closeEdit} onDone={refreshed} />}</SheetPresence>

    </div>
  );
}
