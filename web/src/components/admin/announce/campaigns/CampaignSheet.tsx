import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { LifecycleStepper, type LifecycleBranch, type LifecycleStep } from "@/components/ui/Journey";
import { MiniBar } from "@/components/ui/MiniBar";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { useLang, INTL } from "@/components/dashboard/i18n";
import { numberIn } from "@/i18n/words";
import { hasTextProblem, identityMissing } from "../sender/defaults";
import type { SenderSettings } from "@/services/adminAnnounce";
import type { Group } from "@/services/adminAudience";
import { adminCampaigns, CampaignRefusedError, type Campaign } from "@/services/adminCampaigns";
import { createPayload } from "./helpers";
import { usePhoneCampaignWords } from "./phoneWords";
import { useCampaignWords } from "./words";
import styles from "./CampaignSheet.module.css";

/*
 * One campaign, one sheet. The row said which one and whether it needs the
 * owner; this says the rest, one level deep, and holds every action.
 *
 * Sending is never fired from here. "Send now" and "Schedule" open the
 * composer, whose review step counts the audience, asks with that count and
 * carries it to the server (which refuses if it no longer matches), and asks
 * about the monthly limit. Cancel and resume keep their existing confirm
 * words and ask inside this sheet, never in a second one.
 */

type Confirm = "cancel" | "resume" | null;
type Msg = { kind: "ok" | "bad"; text: string } | null;

const STEPS = ["draft", "scheduled", "sending", "sent"] as const;

/** Where a campaign sits on the draft > scheduled > sending > sent line, and the side branch it is on. */
function lifecycle(c: Campaign): { current: (typeof STEPS)[number]; branch?: LifecycleBranch } {
  switch (c.status) {
    case "draft":
    case "scheduled":
    case "sending":
    case "sent":
      return { current: c.status };
    case "paused":
      return { current: "sending", branch: "paused" };
    case "failed":
      return { current: "sending", branch: "failed" };
    case "canceled":
      return { current: c.startedAt ? "sending" : c.sendAt ? "scheduled" : "draft", branch: "canceled" };
  }
}

export default function CampaignSheet({
  campaign, sender, groups, onClose, onChanged, onOpen, onNotice,
}: {
  campaign: Campaign | null;
  sender: SenderSettings | null;
  groups: Group[];
  onClose: () => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
  onNotice: (text: string) => void;
}) {
  const w = useCampaignWords();
  const p = usePhoneCampaignWords();
  const lang = useLang();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  /* A new campaign opens clean: no confirm or message left from the last one. */
  const [shownId, setShownId] = useState<string | null>(null);
  if ((campaign?.id ?? null) !== shownId) {
    setShownId(campaign?.id ?? null);
    setConfirm(null);
    setMsg(null);
    setBusy(false);
  }

  const fmt = (iso: string) => new Intl.DateTimeFormat(INTL[lang], { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  const close = () => {
    setConfirm(null);
    onClose();
  };

  const c = campaign;
  const done = c ? c.counters.sent + c.counters.failed + c.counters.suppressed + (c.counters.capped ?? 0) : 0;
  const lc = c ? lifecycle(c) : null;
  const steps: LifecycleStep[] = STEPS.map((id) => ({
    id,
    label: w.statuses[id],
    detail: !c ? undefined : id === "scheduled" && c.sendAt ? fmt(c.sendAt) : id === "sent" && c.finishedAt ? fmt(c.finishedAt) : undefined,
  }));

  const act = async (op: () => Promise<unknown>, fail: (e: unknown) => string, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await op();
      onChanged();
      if (ok) onNotice(ok);
      close();
    } catch (e) {
      setConfirm(null);
      setMsg({ kind: "bad", text: fail(e) });
    } finally {
      setBusy(false);
    }
  };
  const refused = (e: unknown, fallback: string) => (e instanceof CampaignRefusedError ? `${w.refused} ${e.message}` : fallback);

  const sendTest = async () => {
    if (!c) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminCampaigns.test(c.id);
      setMsg(r.failed > 0 ? { kind: "bad", text: w.testFailed(r.failed) } : { kind: "ok", text: w.testSent(r.sent) });
      onChanged();
    } catch (e) {
      setMsg({ kind: "bad", text: refused(e, w.testError) });
    } finally {
      setBusy(false);
    }
  };

  const duplicate = () =>
    c &&
    act(
      () =>
        adminCampaigns.create(
          createPayload({ name: p.copyOf(c.name), subject: c.subject, preheader: c.preheader, bodyText: c.bodyText, blocks: c.blocks, groups: c.groups, lang: c.lang, topic: c.topic }),
        ),
      () => p.copyFailed,
      p.copied,
    );

  /* What stands between a draft and Send, from what the sheet already holds. The composer counts the audience. */
  const lacks = sender ? identityMissing(sender) : [];
  const problems: string[] = [];
  if (c?.status === "draft") {
    if (!c.subject.trim()) problems.push(w.readySubject);
    if (c.groups.length === 0) problems.push(w.readyGroups);
    if (sender && lacks.length > 0) problems.push(w.readyFooter(lacks.map((k) => (k === "name" ? w.idName : w.idEmail)).join(w.idAnd)));
    if (sender && hasTextProblem(sender)) problems.push(w.readyUnsubNote);
  }
  const canTest = Boolean(sender && sender.testRecipients.length > 0 && c?.subject.trim() && c.groups.length > 0);
  const groupNames = c ? c.groups.map((slug) => groups.find((g) => g.slug === slug)?.name ?? slug).join(", ") : "";
  const num = (n: number) => numberIn(lang, n);

  const secondary = (label: string, run: () => void, opts: { danger?: boolean; disabled?: boolean } = {}) => (
    <button type="button" className={`a-btn min-h-[44px] ${opts.danger ? "a-btn-danger" : ""} ${styles.action}`} disabled={busy || opts.disabled} onClick={run}>
      {label}
    </button>
  );

  /* The footer carries the one thing most likely wanted next, by status. */
  let footer: React.ReactNode = null;
  let extra: React.ReactNode = null;
  if (c && !confirm) {
    const view = secondary(p.openCampaign, () => onOpen(c.id));
    const copy = secondary(p.duplicate, () => void duplicate());
    const cancel = secondary(w.cancelSend, () => setConfirm("cancel"), { danger: true });
    if (c.status === "draft") {
      footer = <button type="button" className="a-btn a-btn-primary min-h-[44px]" onClick={() => onOpen(c.id)}>{w.sendNow}</button>;
      extra = (
        <>
          {secondary(w.schedule, () => onOpen(c.id))}
          {secondary(w.sendTest, () => void sendTest(), { disabled: !canTest })}
          {sender && sender.testRecipients.length === 0 && <p className="a-hint !mt-0">{p.needsTestRecipient}</p>}
          {secondary(p.openDraft, () => onOpen(c.id))}
          {copy}
        </>
      );
    } else if (c.status === "scheduled") {
      footer = (
        <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={busy} onClick={() => void act(() => adminCampaigns.schedule(c.id, null), () => w.saveFailed)}>
          {w.unschedule}
        </button>
      );
      extra = <>{cancel}{copy}{view}</>;
    } else if (c.status === "sending") {
      footer = <button type="button" className="a-btn a-btn-danger min-h-[44px]" onClick={() => setConfirm("cancel")}>{w.cancelSend}</button>;
      extra = <>{copy}{view}</>;
    } else if (c.status === "paused") {
      footer = <button type="button" className="a-btn a-btn-primary min-h-[44px]" onClick={() => setConfirm("resume")}>{w.resume}</button>;
      extra = <>{cancel}{copy}{view}</>;
    } else {
      footer = <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={busy} onClick={() => void duplicate()}>{p.duplicate}</button>;
      extra = view;
    }
  }
  if (c && confirm === "cancel") {
    footer = (
      <>
        <button type="button" className="a-btn min-h-[44px]" onClick={() => setConfirm(null)}>{w.cancelKeep}</button>
        <button type="button" className="a-btn a-btn-danger min-h-[44px]" disabled={busy} onClick={() => void act(() => adminCampaigns.cancel(c.id), (e) => refused(e, w.saveFailed))}>{w.cancelDo}</button>
      </>
    );
  }
  if (c && confirm === "resume") {
    footer = (
      <>
        <button type="button" className="a-btn min-h-[44px]" onClick={() => setConfirm(null)}>{w.cancel}</button>
        <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={busy} onClick={() => void act(() => adminCampaigns.resume(c.id), (e) => refused(e, w.saveFailed))}>{w.resumeDo}</button>
      </>
    );
  }

  return (
    <BottomSheet
      open={c !== null}
      onClose={close}
      title={confirm === "cancel" ? w.cancelHeading : confirm === "resume" ? w.resumeHeading : (c?.name ?? "")}
      footer={footer}
    >
      {c && lc && confirm === "cancel" && <p className={styles.body} data-testid="sheet-confirm">{w.cancelBody}</p>}
      {c && lc && confirm === "resume" && <p className={styles.body} data-testid="sheet-confirm">{w.resumeBody}</p>}
      {c && lc && !confirm && (
        <div className={styles.body} data-testid="campaign-sheet">
          <StatusGlyph kind={c.status} withWord />

          <LifecycleStepper steps={steps} current={lc.current} branch={lc.branch} label={p.stepperLabel} />

          {c.status === "paused" && (
            <div role="status" className={styles.alert} data-testid="paused-banner">
              <p className={styles.alertTitle}>{w.pausedTitle}</p>
              {c.pausedReason && <p>{w.pausedReasons[c.pausedReason]}</p>}
              <p>{w.pausedKept}</p>
            </div>
          )}

          <dl className={styles.facts}>
            <dt>{p.subject}</dt>
            <dd dir="auto">{c.subject || "—"}</dd>
            <dt>{p.groupsLabel}</dt>
            <dd dir="auto">{groupNames || "—"}</dd>
            {c.status === "scheduled" && c.sendAt && (
              <>
                <dt>{p.whenLabel}</dt>
                <dd>{fmt(c.sendAt)}</dd>
              </>
            )}
            {c.status !== "draft" && c.counters.queued > 0 && (
              <>
                <dt>{p.toLabel}</dt>
                <dd dir="ltr" className={styles.num}>{num(c.counters.queued)}</dd>
              </>
            )}
          </dl>

          {c.status !== "draft" && c.status !== "scheduled" && c.counters.queued > 0 && (
            <section aria-label={p.countersLabel} className={styles.counts}>
              <MiniBar
                total={c.counters.queued}
                height={8}
                label={w.of(done, c.counters.queued)}
                parts={[
                  { value: c.counters.sent, tone: "ok" },
                  { value: c.counters.failed, tone: "danger" },
                  { value: c.counters.suppressed + (c.counters.capped ?? 0), tone: "muted" },
                ]}
              />
              <dl className={styles.facts}>
                <dt>{w.sent}</dt>
                <dd dir="ltr" className={styles.num}>{num(c.counters.sent)}</dd>
                <dt>{w.failed}</dt>
                <dd dir="ltr" className={styles.num}>{num(c.counters.failed)}</dd>
                <dt>{p.skipped}</dt>
                <dd dir="ltr" className={styles.num}>{num(c.counters.suppressed + (c.counters.capped ?? 0))}</dd>
              </dl>
            </section>
          )}

          {c.status === "draft" && (
            <section aria-label={p.readyHeading} data-testid="readiness">
              {problems.length > 0 ? (
                <>
                  <p className={styles.alertTitle}>{p.readyHeading}</p>
                  <ul className={styles.list}>{problems.map((t) => <li key={t}>{t}</li>)}</ul>
                </>
              ) : (
                <p className="a-hint !mt-0">{w.readyOk}</p>
              )}
              <p className="a-hint">{c.testedAt ? p.tested(fmt(c.testedAt)) : p.notTested}</p>
            </section>
          )}

          <p role="status" className={msg?.kind === "bad" ? styles.bad : styles.ok}>{msg?.text}</p>

          <div className={styles.actions} role="group" aria-label={p.actions}>{extra}</div>
        </div>
      )}
    </BottomSheet>
  );
}
