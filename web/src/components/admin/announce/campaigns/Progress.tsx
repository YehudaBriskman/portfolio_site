import { useEffect } from "react";
import { adminCampaigns, type Campaign } from "@/services/adminCampaigns";
import { useCampaignWords } from "./words";
import BudgetPlan from "./BudgetPlan";
import { docLang, formatWhen } from "@/lib/safeTime";

const POLL_MS = 5000;
const nf = new Intl.NumberFormat("en-GB");

/*
 * Counters of a campaign that is waiting, sending or finished. While it is
 * waiting or sending the page re-reads it every few seconds; the numbers are
 * the server's, never extrapolated. Numerals are tabular and left-to-right.
 */
export default function Progress({ campaign, onUpdate }: { campaign: Campaign; onUpdate: (c: Campaign) => void }) {
  const w = useCampaignWords();
  const live = campaign.status === "sending" || campaign.status === "scheduled";
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void adminCampaigns.get(campaign.id).then(onUpdate, () => {}), POLL_MS);
    return () => clearInterval(t);
  }, [live, campaign.id, onUpdate]);

  const c = campaign.counters;
  const done = c.sent + c.failed + c.suppressed + (c.capped ?? 0);
  const when = (iso: string | null) => formatWhen(iso, docLang(), { dateStyle: "medium", timeStyle: "short" });
  const cells: Array<[string, number]> = [[w.queued, c.queued], [w.sent, c.sent], [w.failed, c.failed], [w.suppressed, c.suppressed], ...(c.capped ? ([[w.capped, c.capped]] as Array<[string, number]>) : [])];
  return (
    <section className="a-box space-y-3 p-4" aria-label={w.progressHeading} data-testid="progress">
      <h3 className="display-tight text-lg">{w.progressHeading}</h3>
      <p className="a-hint !mt-0" role="status">{campaign.status === "sending" ? w.progressSending : campaign.status === "scheduled" ? w.progressWaiting : campaign.status === "paused" ? w.progressPaused : w.progressDone}</p>
      <dl className={`grid grid-cols-2 gap-3 ${cells.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
        {cells.map(([label, n]) => (
          <div key={label}>
            <dt className="a-label !mt-0">{label}</dt>
            <dd className="text-xl font-bold tabular-nums" dir="ltr" style={{ textAlign: "left" }}>{nf.format(n)}</dd>
          </div>
        ))}
      </dl>
      {c.queued > 0 && (
        <div>
          <progress className="h-3 w-full" max={c.queued} value={Math.min(done, c.queued)} aria-label={w.of(done, c.queued)} />
          <p className="a-hint tabular-nums">{w.of(done, c.queued)}</p>
        </div>
      )}
      {(campaign.status === "sending" || campaign.status === "paused") && c.queued > done && <BudgetPlan remaining={c.queued - done} />}
      {(campaign.startedAt || campaign.finishedAt) && (
        <p className="a-hint !mt-0">
          {campaign.startedAt && <span className="me-4">{w.started}: <time dateTime={campaign.startedAt}>{when(campaign.startedAt)}</time></span>}
          {campaign.finishedAt && <span>{w.finished}: <time dateTime={campaign.finishedAt}>{when(campaign.finishedAt)}</time></span>}
        </p>
      )}
    </section>
  );
}
