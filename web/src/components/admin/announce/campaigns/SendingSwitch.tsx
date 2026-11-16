import { useCallback, useEffect, useState } from "react";
import { adminCampaigns, type SendingState } from "@/services/adminCampaigns";
import Modal from "../audience/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { ICON } from "@/components/ui/icons";
import { useCampaignWords } from "./words";
import { docLang, formatWhen } from "@/lib/safeTime";

/*
 * The kill switch. Pausing is one click to a confirm (a quiet button, not a red
 * fill beside the page's own action) and the confirm names the outcome. Resuming asks first, because it lets everything
 * queued go out. SEND_ENABLED not being on is shown but cannot be lifted from here.
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
  const [pausing, setPausing] = useState(false);

  const load = useCallback(() => adminCampaigns.sending().then((v) => (setState(v), setFailed(false)), () => setFailed(true)), []);
  useEffect(() => void load(), [load]);

  const set = async (paused: boolean) => {
    setBusy(true);
    try {
      setState(await adminCampaigns.setPaused(paused));
      setFailed(false);
      setAsking(false);
      setPausing(false);
      onChange?.();
    } catch {
      setFailed(true);
      setAsking(false);
      setPausing(false);
    } finally {
      setBusy(false);
    }
  };
  const when = (iso: string) => formatWhen(iso, docLang(), { dateStyle: "medium", timeStyle: "short" });

  if (failed)
    return (
      <div className="a-box flex flex-wrap items-center justify-between gap-3 border-[rgb(var(--destructive-ink))] p-4" role="alert" data-testid="sending-failed">
        <p className="font-bold">{w.switchFailed}</p>
        <button type="button" className="a-btn min-h-[44px]" onClick={() => void load()}>{w.retry}</button>
      </div>
    );
  if (!state) return null;

  return (
    <div data-testid="sending-switch" className={compact ? "space-y-2 pb-2" : "space-y-3"}>
      {state.envDisabled && (
        <div className={`a-box border-[rgb(var(--destructive-ink))] p-4`} role="alert" data-testid="sending-env-off">
          <p className="font-bold">{w.switchEnvTitle}</p>
          <p className="a-hint">{w.switchEnvBody}</p>
        </div>
      )}
      {state.settingsHold && (
        <div className={`a-box border-[rgb(var(--destructive-ink))] p-4`} role="alert" data-testid="sending-settings-hold">
          <p className="font-bold">{state.settingsHold}</p>
        </div>
      )}
      {state.paused ? (
        <div className={`a-box flex flex-wrap items-center justify-between gap-3 border-[rgb(var(--destructive-ink))] p-4`} role="status" data-testid="sending-paused">
          <div className="min-w-0">
            <p className="font-bold">{w.switchPausedTitle}</p>
            {state.pausedAt && <p className="a-hint !mt-0">{w.switchPausedBody(when(state.pausedAt))}</p>}
          </div>
          <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={busy} onClick={() => setAsking(true)}>{w.switchResume}</button>
        </div>
      ) : (
        !state.envDisabled && (
          compact ? (
            <button type="button" className="a-btn a-btn-ghost min-h-[44px]" disabled={busy} onClick={() => setPausing(true)}><Icon icon={ICON.paused} size={16} />{w.switchPause}</button>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="a-hint !mt-0" role="status" data-testid="sending-on">{w.switchOn}</p>
              <button type="button" className="a-btn a-btn-ghost min-h-[44px]" disabled={busy} onClick={() => setPausing(true)}><Icon icon={ICON.paused} size={16} />{w.switchPause}</button>
            </div>
          )
        )
      )}
      <ConfirmDialog
        open={pausing}
        title={w.switchPausedTitle}
        confirm={w.switchPause}
        cancel={w.switchKeep}
        tone="neutral"
        busy={busy}
        onConfirm={() => void set(true)}
        onCancel={() => setPausing(false)}
      >
        {w.switchPauseBody}
      </ConfirmDialog>
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
