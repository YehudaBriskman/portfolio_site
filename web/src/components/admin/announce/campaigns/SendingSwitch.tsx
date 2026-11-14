import { useCallback, useEffect, useState } from "react";
import { adminCampaigns, type SendingState } from "@/services/adminCampaigns";
import Modal from "../audience/Modal";
import { useCampaignWords } from "./words";

/*
 * The kill switch. Pausing is one click, no confirm: stopping is always safe and
 * must never be hard to reach. Resuming asks first, because it lets everything
 * queued go out. SEND_ENABLED=false is shown but cannot be lifted from here.
 *
 * `compact` (phones) draws the calm state as the button alone, in the row of the
 * page's own controls: a normal state draws nothing but the way to stop it. A
 * warning still takes a full line.
 */
export default function SendingSwitch({ onChange, compact = false }: { onChange?: () => void; compact?: boolean }) {
  const w = useCampaignWords();
  const [state, setState] = useState<SendingState | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  const load = useCallback(() => adminCampaigns.sending().then((v) => (setState(v), setFailed(false)), () => setFailed(true)), []);
  useEffect(() => void load(), [load]);

  const set = async (paused: boolean) => {
    setBusy(true);
    try {
      setState(await adminCampaigns.setPaused(paused));
      setFailed(false);
      setAsking(false);
      onChange?.();
    } catch {
      setFailed(true);
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };
  const when = (iso: string) => new Intl.DateTimeFormat(document.documentElement.lang === "he" ? "he-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  if (failed)
    return (
      <div className="a-box flex flex-wrap items-center justify-between gap-3 border-[rgb(var(--destructive-ink))] p-4" role="alert" data-testid="sending-failed">
        <p className="font-bold">{w.switchFailed}</p>
        <button type="button" className="a-btn min-h-[44px]" onClick={() => void load()}>{w.retry}</button>
      </div>
    );
  if (!state) return null;

  return (
    <div data-testid="sending-switch" className={compact ? "contents" : "space-y-3"}>
      {state.envDisabled && (
        <div className={`a-box border-[rgb(var(--destructive-ink))] p-4 ${compact ? "basis-full" : ""}`} role="alert" data-testid="sending-env-off">
          <p className="font-bold">{w.switchEnvTitle}</p>
          <p className="a-hint">{w.switchEnvBody}</p>
        </div>
      )}
      {state.settingsHold && (
        <div className={`a-box border-[rgb(var(--destructive-ink))] p-4 ${compact ? "basis-full" : ""}`} role="alert" data-testid="sending-settings-hold">
          <p className="font-bold">{state.settingsHold}</p>
        </div>
      )}
      {state.paused ? (
        <div className={`a-box flex flex-wrap items-center justify-between gap-3 border-[rgb(var(--destructive-ink))] p-4 ${compact ? "basis-full" : ""}`} role="status" data-testid="sending-paused">
          <div className="min-w-0">
            <p className="font-bold">{w.switchPausedTitle}</p>
            {state.pausedAt && <p className="a-hint !mt-0">{w.switchPausedBody(when(state.pausedAt))}</p>}
          </div>
          <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={busy} onClick={() => setAsking(true)}>{w.switchResume}</button>
        </div>
      ) : (
        !state.envDisabled && (
          compact ? (
            <button type="button" className="a-btn a-btn-danger min-h-[44px]" disabled={busy} onClick={() => void set(true)}>{w.switchPause}</button>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="a-hint !mt-0" role="status" data-testid="sending-on">{w.switchOn}</p>
              <button type="button" className="a-btn a-btn-danger min-h-[44px]" disabled={busy} onClick={() => void set(true)}>{w.switchPause}</button>
            </div>
          )
        )
      )}
      {asking && (
        <Modal title={w.switchResumeHeading} titleId="sending-resume" onClose={() => setAsking(false)}>
          <div className="space-y-3" data-testid="sending-resume-confirm">
            <p className="a-hint !mt-0">{w.switchResumeBody}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={busy} onClick={() => void set(false)}>{w.switchResumeDo}</button>
              <button type="button" className="a-btn min-h-[44px]" onClick={() => setAsking(false)}>{w.cancel}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
