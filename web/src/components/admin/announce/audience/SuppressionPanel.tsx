import { useCallback, useEffect, useId, useState } from "react";
import { adminAudience, type Suppressed } from "@/services/adminAudience";
import { Empty } from "@/components/admin/ui";
import Email from "./Email";
import { useAudienceWords } from "./words";
import { useWhen } from "./useWhen";

/* Rare: addresses that are never mailed. Loaded when its section is opened. */
export default function SuppressionPanel() {
  const w = useAudienceWords();
  const when = useWhen();
  const uid = useId();
  const [items, setItems] = useState<Suppressed[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(() => {
    adminAudience.suppression().then(
      (r) => (setItems(r), setFailed(false)),
      () => setFailed(true),
    );
  }, []);
  useEffect(load, [load]);

  const run = async (op: () => Promise<unknown>, done?: () => void) => {
    try {
      await op();
      done?.();
      load();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="space-y-3">
      <p className="a-hint !mt-0">{w.suppressionHint}</p>
      {failed && <p className="a-error" role="alert">{w.loadFailed}</p>}
      {items && items.length === 0 && <p className="a-hint">{w.suppressionEmpty}</p>}
      {items && items.length > 0 && (
        <ul className="space-y-2" aria-label={w.suppressionHeading}>
          {items.map((s) => (
            <li key={s.hash} className="a-box flex flex-wrap items-center gap-2 p-2 ps-4">
              <div className="min-w-0 flex-1 basis-48 text-sm">{s.email ? <Email value={s.email} /> : <Empty label={w.hashOnly} />}
                {s.since && !Number.isNaN(Date.parse(s.since)) && <p className="a-hint !mt-0.5 tabular-nums">{w.suppressedSince(when(s.since))}</p>}
              </div>
              {confirm === s.hash ? (
                <>
                  <p className="a-hint !mt-0 basis-full">{w.suppressRemoveHint}</p>
                  <button type="button" className="a-btn min-h-[44px] !border-[rgb(var(--destructive-ink))] text-[rgb(var(--destructive-ink))]" onClick={() => void run(() => adminAudience.unsuppress(s.hash), () => setConfirm(null))}>{w.suppressRemoveShort}</button>
                  <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => setConfirm(null)}>{w.cancel}</button>
                </>
              ) : (
                <button type="button" className="a-btn a-btn-ghost min-h-[44px]" aria-label={w.suppressRemove(s.email ?? w.hashOnly)} onClick={() => setConfirm(s.hash)}>{w.suppressRemoveShort}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => (e.preventDefault(), email.trim() && void run(() => adminAudience.suppress(email.trim()), () => setEmail("")))}>
        <div className="min-w-0 flex-1 basis-56">
          <label className="a-label" htmlFor={`${uid}-e`}>{w.suppressAdd}</label>
          <input id={`${uid}-e`} type="email" dir="ltr" autoComplete="off" className="a-input min-h-[44px] text-start" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="a-btn min-h-[44px]" disabled={!email.trim()}>{w.suppressRun}</button>
      </form>
    </div>
  );
}
