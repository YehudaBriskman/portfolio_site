import { useEffect, useState } from "react";
import { adminCampaigns, type ReadinessView } from "@/services/adminCampaigns";
import { useReadinessWords } from "./readinessWords";

/*
 * Settings > Sender & delivery: the send-readiness checklist. Statuses come
 * from the server (DNS for the saved From domain only). Unknown is never shown
 * as a failure. Status is words, not colour alone.
 */
export default function ReadinessCard() {
  const w = useReadinessWords();
  const [state, setState] = useState<ReadinessView | "failed" | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    adminCampaigns.readiness().then((r) => live && setState(Array.isArray(r?.items) ? r : "failed"), () => live && setState("failed"));
    return () => {
      live = false;
    };
  }, [n]);
  if (state === null) return <p className="a-hint !mt-0" role="status">{w.checking}</p>;
  if (state === "failed") return <p className="a-error !mt-0" role="alert">{w.failed}</p>;
  const d = state.domain ?? "";
  const fixText: Record<string, string> = {
    spf: w.fixSpf(d), dkim: w.fixDkim, dmarc: w.fixDmarc, domainMatch: w.fixDomainMatch, replyTo: w.fixReplyTo,
    identity: w.fixIdentity, testRecipient: w.fixTestRecipient, webhook: w.fixWebhook,
  };
  const label: Record<string, string> = { spf: w.spf, dkim: w.dkim, dmarc: w.dmarc, domainMatch: w.domainMatch, replyTo: w.replyTo, identity: w.identity, testRecipient: w.testRecipient, webhook: w.webhook };
  const word = (s: string) => (s === "ok" ? w.ok : s === "fix" ? w.fix : w.unknown);
  return (
    <div className="a-box space-y-3 p-3" data-testid="readiness-card">
      <p className="a-label !mt-0">{w.title}</p>
      <p className="a-hint !mt-0">{w.intro}</p>
      <p className="a-hint !mt-0" data-testid="readiness-domain">{state.domain ? w.domain(state.domain) : w.noDomain}</p>
      <ul className="space-y-2 text-sm">
        {state.items.map((i) => (
          <li key={i.id} data-testid={`ready-${i.id}`} data-status={i.status}>
            <span className="font-bold">{word(i.status)}</span>
            {" - "}
            {label[i.id]}
            {i.status === "fix" && <span className="a-error mt-0 block">{fixText[i.id]}</span>}
            {i.status === "fix" && i.id === "dmarc" && (
              <code dir="ltr" className="mt-1 block break-all rounded bg-[rgb(var(--ink)/0.06)] p-2 text-start text-xs" data-testid="dmarc-record">{w.dmarcName(d)}<br />{w.dmarcValue(d)}</code>
            )}
            {i.status === "unknown" && (i.id === "spf" || i.id === "dkim" || i.id === "dmarc") && <span className="a-hint mt-0 block">{w.unknownDns}</span>}
          </li>
        ))}
      </ul>
      <p className="a-hint !mt-0">{w.caution}</p>
      <button type="button" className="a-btn min-h-[44px]" onClick={() => (setState(null), setN((x) => x + 1))}>{w.recheck}</button>
    </div>
  );
}
