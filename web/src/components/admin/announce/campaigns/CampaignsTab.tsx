import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, EmptyState, ErrorState, LoadingRows } from "@/components/admin/ui";
import { SkeletonSwap } from "@/components/ui/SkeletonSwap";
import { ControlBar, type ControlItem } from "@/components/ui/ControlBar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ICON } from "@/components/ui/icons";
import { identityMissing } from "../sender/defaults";
import { adminAnnounce, type AnnounceSummary, type SenderSettings } from "@/services/adminAnnounce";
import { adminAudience, type Group } from "@/services/adminAudience";
import { adminCampaigns, type Campaign } from "@/services/adminCampaigns";
import styles from "./CampaignsTab.module.css";
import CampaignEditor from "./CampaignEditor";
import CampaignsPhone from "./CampaignsPhone";
import { usePhone } from "@/hooks/usePhone";
import SendingSwitch from "./SendingSwitch";
import { useCampaignWords } from "./words";
import { docLang, formatWhen } from "@/lib/safeTime";

const nf = new Intl.NumberFormat("en-GB");
const LIST_POLL_MS = 10000;
/* What needs a look comes first; a status is said once, as the group heading. */
const ORDER = ["sending", "paused", "scheduled", "draft", "failed", "sent", "canceled"];
const rank = (c: Campaign) => ORDER.indexOf(c.status);

/*
 * The Campaigns tab. Daily: the list (what is sending, what is scheduled) and
 * a new campaign. One campaign opens in place of the list. Nothing is sent from
 * here without a confirm that states how many people get it.
 */
export default function CampaignsTab() {
  const w = useCampaignWords();
  const phone = usePhone();
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<"load" | "auth" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sender, setSender] = useState<SenderSettings | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<AnnounceSummary[]>([]);
  const [tick, setTick] = useState(0);
  const [compile, setCompile] = useState<"idle" | "busy" | "nothing" | "failed">("idle");

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
  /* Compile an issue: a DRAFT from what happened since the last one, opened for review. Nothing is sent or scheduled. */
  const compileIssue = async () => {
    setCompile("busy");
    try {
      const c = await adminCampaigns.compile();
      if (!c) return setCompile("nothing");
      setCompile("idle");
      changed();
      setOpen(c.id);
    } catch {
      setCompile("failed");
    }
  };
  const actions: ControlItem[] = [
    { id: "compile", icon: ICON.note, label: compile === "busy" ? w.compiling : w.compileIssue, showLabel: "always", priority: 2, disabled: compile === "busy", onSelect: () => void compileIssue() },
    { id: "new", icon: ICON.add, label: w.newCampaign, tone: "primary", showLabel: "always", priority: 3, onSelect: () => setOpen("new") },
  ];
  const actionBar = <ControlBar className={styles.actions} label={w.actionsLabel} moreLabel={w.more} items={actions} max={2} />;
  const compileNote = compile === "nothing" ? <p className="a-hint !mt-0" role="status">{w.compileNothing}</p> : compile === "failed" ? <p className="a-error !mt-0" role="status">{w.compileFailed}</p> : null;
  const when = (iso: string) => formatWhen(iso, docLang(), { dateStyle: "medium", timeStyle: "short" });

  if (open)
    return <CampaignEditor key={open} id={open} sender={sender} groups={groups} events={events} onClose={() => (setOpen(null), changed())} onChanged={changed} />;

  const dash = (c: Campaign, n: number) => (c.status === "draft" ? <Empty /> : nf.format(n));
  const whenOf = (c: Campaign) => (c.status === "scheduled" && c.sendAt ? w.scheduledFor(when(c.sendAt)) : c.finishedAt ? w.finishedAt(when(c.finishedAt)) : w.updatedAt(when(c.updatedAt)));
  const columns: Column<Campaign>[] = [
    {
      id: "name", header: w.colName, primary: true,
      cell: (c) => (
        <span dir="auto" title={c.subject}>{c.name}</span>
      ),
    },
    { id: "sent", header: w.colSent, align: "num", width: "6rem", hideBelow: "sm", cell: (c) => dash(c, c.counters.sent) },
    { id: "failed", header: w.colFailed, align: "num", width: "6rem", hideBelow: "md", cell: (c) => dash(c, c.counters.failed) },
    { id: "skipped", header: w.colSkipped, align: "num", width: "6rem", hideBelow: "md", cell: (c) => dash(c, c.counters.suppressed) },
    { id: "when", header: w.colWhen, width: "13rem", hideBelow: "lg", cell: whenOf },
  ];
  /* No selection and no row actions here, so only the labels the table draws matter. */
  const tableWords = { selectAll: w.cancel, selectRow: (l: string) => l, actions: w.actionsLabel, loading: w.loading, bulkLabel: w.actionsLabel, count: (n: number) => String(n), cancel: w.cancel, more: w.more };

  const noFooter = sender !== null && identityMissing(sender).length > 0;
  return (
    <div className={`max-w-5xl ${phone ? "space-y-4" : "space-y-6"}`} data-testid="campaigns">
      {phone ? (
        /* The tab already says Campaigns, so the heading is for screen readers. */
        <>
          <h2 className="sr-only">{w.heading}</h2>
          {actionBar}
          {compileNote}
          <SendingSwitch compact />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="display-tight text-xl">{w.heading}</h2>
              <p className="a-hint">{w.intro}</p>
            </div>
            {actionBar}
          </div>
          {compileNote}

          <SendingSwitch />
        </>
      )}

      {noFooter && (
        <div className="a-box border-[rgb(var(--destructive-ink))] p-4" role="alert" data-testid="footer-blocker">
          <p className="font-bold">{w.footerMissingTitle}</p>
          <p className="a-hint">{w.footerMissing}</p>
          <Link className="a-btn mt-2 min-h-[44px]" to={{ search: "?tab=settings&section=sender" }}>{w.footerLink}</Link>
        </div>
      )}

      <SkeletonSwap loading={!error && !items} skeleton={<LoadingRows label={w.loading} />}>
        {error ? (
          <ErrorState message={error === "auth" ? w.notAuthorised : w.loadFailed} onRetry={() => (setItems(null), setError(null), changed())} />
        ) : !items ? (
          null
        ) : items.length === 0 ? (
          <EmptyState title={w.empty} />
        ) : phone ? (
          <CampaignsPhone items={items} sender={sender} groups={groups} onOpen={setOpen} onChanged={changed} />
        ) : (
          <div>
            <p className="a-hint !mt-0 mb-2 tabular-nums" role="status">{w.count(items.length)}</p>
            <DataTable
              label={w.tableLabel}
              rows={[...items].sort((x, y) => rank(x) - rank(y))}
              columns={columns}
              rowKey={(c) => c.id}
              rowLabel={(c) => c.name}
              words={tableWords}
              onOpen={(c) => setOpen(c.id)}
              groupBy={(c) => c.status}
              groupLabel={(k, rows) => `${w.statuses[k as Campaign["status"]]} · ${rows.length}`}
            />
          </div>
        )}
      </SkeletonSwap>
    </div>
  );
}
