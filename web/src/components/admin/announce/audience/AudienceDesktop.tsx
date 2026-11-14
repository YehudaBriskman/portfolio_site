import { useCallback, useEffect, useId, useRef, useState } from "react";
import { EmptyState, ErrorState, LoadingRows, Empty } from "@/components/admin/ui";
import { adminAudience, CONTACT_STATUSES, EXPORT_URL, type Contact, type ContactStatus, type Group } from "@/services/adminAudience";
import { isNotAuthorised } from "@/services/authError";
import { Disclosure } from "@/components/ui/Disclosure";
import AddContact from "./AddContact";
import ContactEditor, { Why } from "./ContactEditor";
import Email from "./Email";
import GroupsPanel from "./GroupsPanel";
import ImportDialog from "./ImportDialog";
import DataExport from "./DataExport";
import SweepNote from "./SweepNote";
import SuppressionPanel from "./SuppressionPanel";
import { useAudienceWords } from "./words";

type Dialog = { kind: "add" } | { kind: "import" } | { kind: "edit"; contact: Contact } | null;

/*
 * The Audience tab on a wide screen (600px and up; AudiencePhone is the narrow one). Daily on top: find a person, see why they are or are not
 * mailable, edit them. Weekly: add, import, export. Rare, collapsed: groups and
 * the suppression list. Nothing here sends mail.
 */
export default function AudienceDesktop() {
  const w = useAudienceWords();
  const uid = useId();
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<Contact[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<"load" | "auth" | null>(null);
  const [more, setMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  /* Which list is on screen: a "Load more" answered after the search or a filter changed is for a list that is gone. */
  const listId = useRef(0);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [group, setGroup] = useState("");
  const [status, setStatus] = useState<ContactStatus | "">("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const loadGroups = useCallback(() => void adminAudience.groups().then(setGroups, () => {}), []);
  useEffect(loadGroups, [loadGroups]);

  useEffect(() => {
    let live = true;
    listId.current += 1;
    adminAudience.contacts({ group, status, q: term }).then(
      (p) => live && (setItems(p.items), setNext(p.nextCursor), setError(null), setMore(false), setMoreFailed(false)),
      (e: unknown) => live && setError(isNotAuthorised(e) ? "auth" : "load"),
    );
    return () => {
      live = false;
    };
  }, [group, status, term, tick]);

  const reload = () => (setItems(null), setError(null), setTick((n) => n + 1));
  const refreshed = () => (setDialog(null), loadGroups(), reload());
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

  const filtered = Boolean(group || status || term);
  const groupName = (slug: string) => groups.find((g) => g.slug === slug)?.name ?? slug;
  const nf = new Intl.NumberFormat("en-GB");

  return (
    <div className="max-w-5xl space-y-6" data-testid="audience">
      <div>
        <h2 className="display-tight text-xl">{w.heading}</h2>
        <p className="a-hint">{w.intro}</p>
      </div>

      <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-[minmax(14rem,2fr)_1fr_1fr_auto]" data-testid="audience-filters">
        <div className="a-search col-span-2 md:col-span-1">
          <label className="a-label" htmlFor={`${uid}-q`}>{w.searchLabel}</label>
          <input id={`${uid}-q`} type="search" className="a-input min-h-[44px] !ps-3" dir="auto" placeholder={w.searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div data-filter className="min-w-0">
          <label className="a-label" htmlFor={`${uid}-g`}>{w.filterGroup}</label>
          <select id={`${uid}-g`} className="a-select min-h-[44px] w-full" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">{w.all}</option>
            {groups.map((g) => <option key={g.slug} value={g.slug}>{`${g.name} (${nf.format(g.count)})`}</option>)}
          </select>
        </div>
        <div data-filter className="min-w-0">
          <label className="a-label" htmlFor={`${uid}-s`}>{w.filterStatus}</label>
          <select id={`${uid}-s`} className="a-select min-h-[44px] w-full" value={status} onChange={(e) => setStatus(e.target.value as ContactStatus | "")}>
            <option value="">{w.all}</option>
            {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{w.statuses[s]}</option>)}
          </select>
        </div>
        <div className="col-span-2 flex flex-wrap gap-2 md:col-span-1">
          <button type="button" className="a-btn a-btn-primary min-h-[44px]" onClick={() => setDialog({ kind: "add" })}>{w.addContact}</button>
          <button type="button" className="a-btn min-h-[44px]" onClick={() => setDialog({ kind: "import" })}>{w.importCsv}</button>
          <a className="a-btn min-h-[44px]" href={EXPORT_URL} download title={w.exportHint}>{w.exportCsv}</a>
        </div>
      </div>

      {error ? (
        <ErrorState message={error === "auth" ? w.notAuthorised : w.loadFailed} signIn={error === "auth"} onRetry={reload} />
      ) : !items ? (
        <LoadingRows label={w.loading} />
      ) : items.length === 0 ? (
        <EmptyState title={filtered ? w.empty : w.emptyFirst} />
      ) : (
        <div>
          <p className="a-hint !mt-0 mb-2 tabular-nums" role="status">{w.count(items.length)}</p>
          <div className="a-box overflow-x-auto">
            <table className="a-table" aria-label={w.tableLabel}>
              <thead>
                <tr>
                  <th scope="col" className="!px-2 !text-start sm:!px-4">{w.colEmail}</th>
                  <th scope="col" className="!text-start hidden md:table-cell">{w.colName}</th>
                  <th scope="col" className="!px-2 !text-start sm:!px-4">{w.colStatus}</th>
                  <th scope="col" className="!text-start hidden lg:table-cell">{w.colLang}</th>
                  <th scope="col" className="!text-start hidden lg:table-cell">{w.colGroups}</th>
                  <th scope="col" className="!px-2 !text-end sm:!px-4"><span className="sr-only">{w.colActions}</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.hash}>
                    <td className="min-w-0 max-w-[18rem] !px-2 sm:!px-4">
                      <span className="a-row-title block text-sm"><Email value={c.email} /></span>
                      <span className="a-row-meta !mt-0.5 text-sm"><Why c={c} /></span>
                    </td>
                    <td className="hidden min-w-0 max-w-[14rem] text-start [overflow-wrap:anywhere] md:table-cell">{c.name ? <bdi dir="auto">{c.name}</bdi> : <Empty />}</td>
                    <td className="a-fit !px-2 text-sm sm:!px-4">{w.statuses[c.status]}</td>
                    <td className="a-fit hidden lg:table-cell text-sm">{c.lang ? w.langs[c.lang] : ""}</td>
                    <td className="hidden min-w-0 max-w-[14rem] text-sm [overflow-wrap:anywhere] lg:table-cell" dir="auto">{c.groups.length ? c.groups.map(groupName).join(", ") : <Empty />}</td>
                    <td className="a-fit !px-2 !text-end sm:!px-4">
                      <button type="button" className="a-btn min-h-[44px] min-w-[44px]" aria-label={w.editFor(c.email)} onClick={() => setDialog({ kind: "edit", contact: c })}>{w.edit}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {next && (
            <div className="mt-3">
              <button type="button" className="a-btn min-h-[44px]" disabled={more} onClick={() => void loadMore()}>{more ? w.loadingMore : moreFailed ? w.loadMoreFailed : w.loadMore}</button>
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

      {dialog?.kind === "add" && <AddContact groups={groups} onClose={() => setDialog(null)} onDone={refreshed} />}
      {dialog?.kind === "import" && <ImportDialog groups={groups} onClose={() => (setDialog(null), reload(), loadGroups())} onDone={loadGroups} />}
      {dialog?.kind === "edit" && <ContactEditor contact={dialog.contact} groups={groups} onClose={() => setDialog(null)} onDone={refreshed} />}
    </div>
  );
}
