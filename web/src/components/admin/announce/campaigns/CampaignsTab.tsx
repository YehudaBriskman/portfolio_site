import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, EmptyState, ErrorState, LoadingRows } from "@/components/admin/ui";
import { identityMissing } from "../sender/defaults";
import { adminAnnounce, type AnnounceSummary, type SenderSettings } from "@/services/adminAnnounce";
import { adminAudience, type Group } from "@/services/adminAudience";
import { adminCampaigns, type Campaign } from "@/services/adminCampaigns";
import CampaignEditor from "./CampaignEditor";
import { pillState } from "./status";
import { useCampaignWords } from "./words";

const nf = new Intl.NumberFormat("en-GB");
const LIST_POLL_MS = 10000;

/*
 * The Campaigns tab. Daily: the list (what is sending, what is scheduled) and
 * a new campaign. One campaign opens in place of the list. Nothing is sent from
 * here without a confirm that states how many people get it.
 */
export default function CampaignsTab() {
  const w = useCampaignWords();
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<"load" | "auth" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sender, setSender] = useState<SenderSettings | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<AnnounceSummary[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    adminCampaigns.list().then(
      (l) => live && (setItems(l), setError(null)),
      (e: unknown) => live && setError(e instanceof Error && e.message === "not-authorised" ? "auth" : "load"),
    );
    return () => {
      live = false;
    };
  }, [tick]);

  useEffect(() => {
    void adminAnnounce.settings().then((v) => setSender(v.settings.sender), () => {});
    void adminAudience.groups().then(setGroups, () => {});
    void adminAnnounce.inbox().then((r) => setEvents(r.items), () => {});
  }, []);

  /* Refresh the list while anything is going out. */
  const busy = items?.some((c) => c.status === "sending" || c.status === "scheduled");
  useEffect(() => {
    if (!busy || open) return;
    const t = setInterval(() => setTick((n) => n + 1), LIST_POLL_MS);
    return () => clearInterval(t);
  }, [busy, open]);

  const changed = useCallback(() => setTick((n) => n + 1), []);
  const when = (iso: string) => new Intl.DateTimeFormat(document.documentElement.lang === "he" ? "he-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  if (open)
    return <CampaignEditor key={open} id={open} sender={sender} groups={groups} events={events} onClose={() => (setOpen(null), changed())} onChanged={changed} />;

  const noFooter = sender !== null && identityMissing(sender).length > 0;
  return (
    <div className="max-w-5xl space-y-6" data-testid="campaigns">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="display-tight text-xl">{w.heading}</h2>
          <p className="a-hint">{w.intro}</p>
        </div>
        <button type="button" className="a-btn a-btn-primary min-h-[44px]" onClick={() => setOpen("new")}>{w.newCampaign}</button>
      </div>

      {noFooter && (
        <div className="a-box border-[rgb(var(--destructive-ink))] p-4" role="alert" data-testid="footer-blocker">
          <p className="font-bold">{w.footerMissingTitle}</p>
          <p className="a-hint">{w.footerMissing}</p>
          <Link className="a-btn mt-2 min-h-[44px]" to={{ search: "?tab=settings&section=sender" }}>{w.footerLink}</Link>
        </div>
      )}

      {error ? (
        <ErrorState message={error === "auth" ? w.notAuthorised : w.loadFailed} onRetry={() => (setItems(null), setError(null), changed())} />
      ) : !items ? (
        <LoadingRows label={w.loading} />
      ) : items.length === 0 ? (
        <EmptyState title={w.empty} />
      ) : (
        <div>
          <p className="a-hint !mt-0 mb-2 tabular-nums" role="status">{w.count(items.length)}</p>
          <div className="a-box overflow-x-auto">
            <table className="a-table" aria-label={w.tableLabel}>
              <thead>
                <tr>
                  <th scope="col" className="!text-start">{w.colName}</th>
                  <th scope="col" className="!text-start">{w.colStatus}</th>
                  <th scope="col" className="hidden sm:table-cell" style={{ textAlign: "right" }}>{w.colSent}</th>
                  <th scope="col" className="hidden md:table-cell" style={{ textAlign: "right" }}>{w.colFailed}</th>
                  <th scope="col" className="hidden md:table-cell" style={{ textAlign: "right" }}>{w.colSkipped}</th>
                  <th scope="col" className="!text-start hidden lg:table-cell">{w.colWhen}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td className="min-w-0 max-w-[20rem]">
                      <button type="button" className="block min-h-[44px] w-full text-start" aria-label={w.open(c.name)} onClick={() => setOpen(c.id)}>
                        <span className="a-row-title block text-sm" dir="auto">{c.name}</span>
                        <span className="a-row-meta !mt-0.5 block truncate text-xs" dir="auto">{c.subject}</span>
                        <span className="a-row-meta !mt-0.5 block text-xs lg:hidden">{c.status === "scheduled" && c.sendAt ? w.scheduledFor(when(c.sendAt)) : c.finishedAt ? w.finishedAt(when(c.finishedAt)) : w.updatedAt(when(c.updatedAt))}</span>
                      </button>
                    </td>
                    <td className="a-fit text-sm">
                      <span className="a-pill" data-state={pillState(c.status)}><span className="a-pill-mark" aria-hidden="true" />{w.statuses[c.status]}</span>
                    </td>
                    <td className="hidden tabular-nums sm:table-cell" style={{ textAlign: "right" }} dir="ltr">{c.status === "draft" ? <Empty /> : nf.format(c.counters.sent)}</td>
                    <td className="hidden tabular-nums md:table-cell" style={{ textAlign: "right" }} dir="ltr">{c.status === "draft" ? <Empty /> : nf.format(c.counters.failed)}</td>
                    <td className="hidden tabular-nums md:table-cell" style={{ textAlign: "right" }} dir="ltr">{c.status === "draft" ? <Empty /> : nf.format(c.counters.suppressed)}</td>
                    <td className="hidden text-sm lg:table-cell">
                      {c.status === "scheduled" && c.sendAt ? w.scheduledFor(when(c.sendAt)) : c.finishedAt ? w.finishedAt(when(c.finishedAt)) : w.updatedAt(when(c.updatedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
