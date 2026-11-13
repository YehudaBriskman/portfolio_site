import { useCallback, useEffect, useState } from "react";
import { adminAudience, type LedgerState } from "@/services/adminAudience";
import { useLedgerWords } from "./ledgerWords";
import { useWhen } from "./useWhen";

/*
 * Shown over the Audience and Campaigns tabs only when something needs the
 * owner: the never-mail ledger cannot be read (sending is held), or its guard
 * repaired contacts since the owner last confirmed (typically after a restore).
 * Counts only; nothing here names a person. Renders nothing otherwise, and
 * nothing while the state is unknown, so it never flashes.
 */
export default function LedgerBanner() {
  const w = useLedgerWords();
  const when = useWhen();
  const [s, setS] = useState<LedgerState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => void adminAudience.ledger().then(setS, () => setS(null)), []);
  useEffect(load, [load]);

  const ack = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await adminAudience.acknowledgeLedger();
      load();
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  if (!s) return null;
  const open = s.report && !s.report.acknowledgedAt ? s.report : null;
  if (s.ready && !open) return null;

  return (
    <div className="a-box mb-4 border-[rgb(var(--destructive-ink))] p-4" role="alert" data-testid="ledger-banner">
      {!s.ready ? (
        <>
          <p className="font-bold">{w.downTitle}</p>
          <p className="a-hint">{w.downBody}</p>
        </>
      ) : (
        open && (
          <>
            <p className="font-bold">{w.repairedTitle}</p>
            <p className="a-hint tabular-nums">{w.repairedBody(open.repaired.unsubscribed, open.repaired.suppressed, open.repaired.erased)}</p>
            <p className="a-hint tabular-nums">{w.repairedAt(when(open.at))}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" className="a-btn min-h-[44px]" disabled={busy} onClick={() => void ack()}>{busy ? w.acknowledging : w.acknowledge}</button>
              {failed && <span className="a-error" role="status">{w.acknowledgeFailed}</span>}
            </div>
          </>
        )
      )}
    </div>
  );
}
