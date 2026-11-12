import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorState } from "@/components/admin/ui";
import { ContentInvalidError, type Issue } from "@/services/adminContent";
import { adminAnnounce, type AnnounceSummary, type SenderSettings } from "@/services/adminAnnounce";
import type { Group } from "@/services/adminAudience";
import {
  adminCampaigns,
  CampaignConflictError,
  CampaignRefusedError,
  type AudienceSample,
  type Block,
  type Campaign,
  type CampaignInput,
  type CampaignLang,
  type CampaignTopic,
} from "@/services/adminCampaigns";
import Modal from "../audience/Modal";
import EmailPreview from "../previews/EmailPreview";
import BlocksEditor from "./BlocksEditor";
import { blockProblem, blocksToText, previewMail, zonedToIso } from "./mailPreview";
import Progress from "./Progress";
import { pillState } from "./status";
import { useCampaignWords } from "./words";

/*
 * One campaign. A draft is editable; anything else is shown read-only with its
 * progress. Sending and scheduling need a saved draft and a footer identity,
 * so both save first and the server has the last word (it refuses without an
 * identity or without recipients, and its sentence is shown as it came).
 */

type Form = { name: string; subject: string; preheader: string; bodyText: string; useBlocks: boolean; blocks: Block[]; groups: string[]; lang: CampaignLang; topic: "" | CampaignTopic };
const BLANK: Form = { name: "", subject: "", preheader: "", bodyText: "", useBlocks: false, blocks: [], groups: ["subscribers"], lang: "all", topic: "" };
const toForm = (c: Campaign): Form => ({
  name: c.name, subject: c.subject, preheader: c.preheader, bodyText: c.bodyText, useBlocks: Boolean(c.blocks?.length), blocks: c.blocks ?? [],
  groups: c.groups, lang: c.lang, topic: c.topic ?? "",
});
const cleanBlocks = (bs: Block[]): Block[] => bs.map((b) => (b.type === "ul" ? { ...b, items: b.items.map((i) => i.trim()).filter(Boolean) } : b));
const toInput = (f: Form): CampaignInput => {
  const blocks = f.useBlocks ? cleanBlocks(f.blocks) : null;
  return {
    name: f.name.trim(), subject: f.subject.trim(), preheader: f.preheader.trim(), bodyText: blocks ? blocksToText(blocks) : f.bodyText,
    blocks, groups: f.groups, lang: f.lang, topic: f.topic || null,
  };
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const audienceKey = (f: Form) => JSON.stringify([[...f.groups].sort(), f.lang, f.topic]);

const ZONES = ["Asia/Jerusalem", "UTC", "Europe/London", "America/New_York"];
const localZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

type Dialog = "send" | "cancel" | "delete" | null;
type Msg = { kind: "ok" | "bad"; text: string } | null;

export default function CampaignEditor({
  id, sender, groups, events, onClose, onChanged,
}: {
  id: string | "new";
  sender: SenderSettings | null;
  groups: Group[];
  events: AnnounceSummary[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const w = useCampaignWords();
  const uid = useId();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [eventId, setEventId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [busy, setBusy] = useState<"" | "save" | "test" | "go">("");
  const [msg, setMsg] = useState<Msg>(null);
  const [conflict, setConflict] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [audienceRes, setAudience] = useState<{ key: string; data: AudienceSample | "failed" } | null>(null);
  const [confirmCount, setConfirmCount] = useState<number | null>(null);
  const [when, setWhen] = useState("");
  const [zone, setZone] = useState(localZone);
  const [pvLang, setPvLang] = useState<"en" | "he">("en");
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(0);

  /* Load an existing campaign. */
  useEffect(() => {
    if (id === "new") return;
    let live = true;
    adminCampaigns.get(id).then(
      (c) => live && (setCampaign(c), setForm(toForm(c)), setPvLang(c.lang === "he" ? "he" : "en")),
      () => live && setLoadError(true),
    );
    return () => {
      live = false;
    };
  }, [id, tick]);

  const editable = id === "new" || campaign?.status === "draft";
  const dirty = id === "new" ? true : campaign ? !same(toInput(form), toInput(toForm(campaign))) : false;
  const audienceStale = Boolean(campaign) && audienceKey(form) !== audienceKey(toForm(campaign!));
  const footerOk = Boolean(sender?.footerIdentity.trim());
  const blockBad = form.useBlocks && (form.blocks.length === 0 || form.blocks.some((b) => blockProblem(b)));
  const formOk = Boolean(form.name.trim() && form.subject.trim() && form.groups.length > 0 && !blockBad);

  /* The recipient count follows the SAVED draft; the server counts, never the page. */
  const savedId = campaign?.id;
  const savedAt = campaign?.updatedAt;
  const audience = audienceRes && audienceRes.key === `${savedId}:${savedAt}` ? audienceRes.data : "loading";
  useEffect(() => {
    if (!savedId) return;
    let live = true;
    const key = `${savedId}:${savedAt}`;
    adminCampaigns.audience(savedId).then(
      (a) => live && setAudience({ key, data: a }),
      () => live && setAudience({ key, data: "failed" }),
    );
    return () => {
      live = false;
    };
  }, [savedId, savedAt]);

  const onProgress = useCallback((c: Campaign) => (setCampaign(c), onChanged()), [onChanged]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => (setForm((f) => ({ ...f, [k]: v })), setMsg(null));

  const explain = (e: unknown) => {
    if (e instanceof CampaignConflictError) return setConflict(true);
    if (e instanceof ContentInvalidError) setIssues(e.issues);
    if (e instanceof CampaignRefusedError) return setMsg({ kind: "bad", text: `${w.refused} ${e.message}` });
    setMsg({ kind: "bad", text: w.saveFailed });
  };

  const save = useCallback(async (): Promise<Campaign | null> => {
    setBusy("save");
    setIssues([]);
    setMsg(null);
    try {
      const input = toInput(form);
      const c = campaign ? await adminCampaigns.update(campaign.id, input, campaign._rev) : await adminCampaigns.create({ ...input, ...(eventId ? { eventId } : {}) });
      setCampaign(c);
      setForm(toForm(c));
      setMsg({ kind: "ok", text: w.saved });
      onChanged();
      return c;
    } catch (e) {
      explain(e);
      return null;
    } finally {
      setBusy("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, campaign, eventId]);

  const startFrom = async (eid: string) => {
    if (!eid) return;
    setMsg(null);
    try {
      const d = await adminAnnounce.get(eid);
      const lang = form.lang === "he" ? "he" : "en";
      const item = d.kit[lang].email ?? d.kit.en.email;
      setForm((f) => ({ ...f, name: f.name || d.event.title.slice(0, 120), subject: (item?.subject || d.event.title).split("\n")[0].slice(0, 200), bodyText: item?.text ?? `${d.event.title}\n\n${d.event.url}`, useBlocks: false }));
      setEventId(eid);
      setMsg({ kind: "ok", text: w.startFromFilled });
    } catch {
      setMsg({ kind: "bad", text: w.startFromFailed });
    }
  };

  const sendTest = async () => {
    const c = dirty ? await save() : campaign;
    if (!c) return;
    setBusy("test");
    try {
      const r = await adminCampaigns.test(c.id);
      setMsg(r.failed > 0 ? { kind: "bad", text: w.testFailed(r.failed) } : { kind: "ok", text: w.testSent(r.sent) });
    } catch (e) {
      if (e instanceof CampaignRefusedError) setMsg({ kind: "bad", text: `${w.refused} ${e.message}` });
      else setMsg({ kind: "bad", text: w.testError });
    } finally {
      setBusy("");
    }
  };

  /* Send now: save, count afresh, then ask. The count in the dialog is the server's. */
  const askSend = async () => {
    const c = dirty ? await save() : campaign;
    if (!c) return;
    setConfirmCount(null);
    setDialog("send");
    try {
      setConfirmCount((await adminCampaigns.audience(c.id)).count);
    } catch {
      setDialog(null);
      setMsg({ kind: "bad", text: w.audienceFailed });
    }
  };

  const run = async (op: () => Promise<Campaign>) => {
    setBusy("go");
    setMsg(null);
    try {
      const c = await op();
      setCampaign(c);
      setForm(toForm(c));
      setDialog(null);
      onChanged();
    } catch (e) {
      setDialog(null);
      explain(e);
    } finally {
      setBusy("");
    }
  };

  const scheduleIso = when ? zonedToIso(when, zone) : null;
  const past = scheduleIso !== null && Date.parse(scheduleIso) <= now;
  const doSchedule = async () => {
    const c = dirty ? await save() : campaign;
    if (!c || !scheduleIso || past) return;
    await run(() => adminCampaigns.schedule(c.id, scheduleIso));
  };

  const preview = useMemo(
    () => (sender ? previewMail({ subject: form.subject, preheader: form.preheader, bodyText: form.bodyText, blocks: form.useBlocks ? cleanBlocks(form.blocks) : null }, pvLang, sender, typeof location === "undefined" ? "example.com" : location.host) : null),
    [form, pvLang, sender],
  );
  const zones = useMemo(() => Array.from(new Set([zone, ...ZONES])), [zone]);
  const fmt = (iso: string) => new Intl.DateTimeFormat(document.documentElement.lang === "he" ? "he-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  if (loadError) return <ErrorState message={w.loadFailed} onRetry={() => (setLoadError(false), setTick((n) => n + 1))} />;
  if (id !== "new" && !campaign) return <p className="a-box a-box-row text-clay" role="status">{w.loading}</p>;

  const heading = id === "new" ? w.newHeading : editable ? w.editHeading : w.viewHeading;
  const canGo = editable && formOk && footerOk && busy === "";
  const status = campaign?.status;
  const fromLabel = sender ? [sender.fromName, sender.fromAddress].filter(Boolean).join(" ") || "—" : "—";

  return (
    <div className="max-w-5xl space-y-6" data-testid="campaign-editor">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={onClose}>← {w.back}</button>
        <h2 className="display-tight text-xl">{heading}</h2>
        {campaign && <span className="a-pill" data-state={pillState(campaign.status)}><span className="a-pill-mark" aria-hidden="true" />{w.statuses[campaign.status]}</span>}
      </div>

      {editable && !footerOk && sender && (
        <div className="a-box border-[rgb(var(--destructive-ink))] p-4" role="alert" data-testid="footer-blocker">
          <p className="font-bold">{w.footerMissingTitle}</p>
          <p className="a-hint">{w.footerMissing}</p>
          <Link className="a-btn mt-2 min-h-[44px]" to={{ search: "?tab=settings&section=sender" }}>{w.footerLink}</Link>
        </div>
      )}

      {campaign && !editable && <Progress campaign={campaign} onUpdate={onProgress} />}

      {status === "scheduled" && campaign && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="a-btn min-h-[44px]" disabled={busy !== ""} onClick={() => void run(() => adminCampaigns.schedule(campaign.id, null))}>{w.unschedule}</button>
          <button type="button" className="a-btn a-btn-danger min-h-[44px]" onClick={() => setDialog("cancel")}>{w.cancelSend}</button>
        </div>
      )}
      {status === "sending" && (
        <button type="button" className="a-btn a-btn-danger min-h-[44px]" onClick={() => setDialog("cancel")}>{w.cancelSend}</button>
      )}

      <form noValidate onSubmit={(e) => (e.preventDefault(), void save())} className="space-y-6">
        <fieldset disabled={!editable} className="min-w-0 space-y-6">
          {id === "new" && events.length > 0 && (
            <div>
              <label className="a-label" htmlFor={`${uid}-ev`}>{w.startFrom}</label>
              <select id={`${uid}-ev`} className="a-select min-h-[44px] max-w-full" value="" onChange={(e) => void startFrom(e.target.value)}>
                <option value="">{w.startFromNone}</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              <p className="a-hint">{w.startFromHint}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="a-label" htmlFor={`${uid}-n`}>{w.name}</label>
              <input id={`${uid}-n`} className="a-input min-h-[44px]" dir="auto" maxLength={120} value={form.name} onChange={(e) => set("name", e.target.value)} />
              <p className="a-hint">{w.nameHint}</p>
            </div>
            <div>
              <label className="a-label" htmlFor={`${uid}-s`}>{w.subject}</label>
              <input id={`${uid}-s`} className="a-input min-h-[44px]" dir="auto" maxLength={200} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="a-label" htmlFor={`${uid}-p`}>{w.preheader}</label>
              <input id={`${uid}-p`} className="a-input min-h-[44px]" dir="auto" maxLength={200} value={form.preheader} onChange={(e) => set("preheader", e.target.value)} />
              <p className="a-hint">{w.preheaderHint}</p>
            </div>
          </div>

          <section aria-labelledby={`${uid}-bh`} className="space-y-3">
            <h3 id={`${uid}-bh`} className="display-tight text-lg">{w.bodyHeading}</h3>
            {!form.useBlocks && (
              <div>
                <label className="a-label" htmlFor={`${uid}-b`}>{w.bodyText}</label>
                <textarea id={`${uid}-b`} className="a-textarea" rows={9} dir="auto" value={form.bodyText} onChange={(e) => set("bodyText", e.target.value)} aria-describedby={`${uid}-bhint`} />
                <p id={`${uid}-bhint`} className="a-hint">{w.bodyHint}</p>
              </div>
            )}
            <details className="a-box p-3" open={form.useBlocks}>
              <summary className="flex min-h-[44px] cursor-pointer items-center font-bold">{w.useBlocks}</summary>
              <div className="space-y-3 pt-2">
                <label className="flex min-h-[44px] items-center gap-3 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={form.useBlocks} onChange={(e) => set("useBlocks", e.target.checked)} />
                  <span>{w.useBlocks}</span>
                </label>
                <p className="a-hint !mt-0">{w.blocksHint}</p>
                {form.useBlocks && <BlocksEditor blocks={form.blocks} onChange={(b) => set("blocks", b)} />}
              </div>
            </details>
          </section>

          <section aria-labelledby={`${uid}-ah`} className="space-y-3">
            <h3 id={`${uid}-ah`} className="display-tight text-lg">{w.audienceHeading}</h3>
            <fieldset>
              <legend className="a-label">{w.groups}</legend>
              {groups.length === 0 && <p className="a-hint !mt-0">{w.groupsNone}</p>}
              <div className="flex flex-wrap gap-x-5">
                {groups.map((g) => (
                  <label key={g.slug} className="flex min-h-[44px] items-center gap-3 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={form.groups.includes(g.slug)} onChange={(e) => set("groups", e.target.checked ? [...form.groups, g.slug] : form.groups.filter((x) => x !== g.slug))} />
                    <span dir="auto">{g.name}</span>
                    <span className="tabular-nums text-clay" dir="ltr">{g.active ?? g.count}</span>
                  </label>
                ))}
              </div>
              {form.groups.length === 0 && <p className="a-error">{w.groupsRequired}</p>}
            </fieldset>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="a-label" htmlFor={`${uid}-l`}>{w.language}</label>
                <select id={`${uid}-l`} className="a-select min-h-[44px]" value={form.lang} onChange={(e) => set("lang", e.target.value as CampaignLang)}>
                  {(["all", "en", "he"] as const).map((l) => <option key={l} value={l}>{w.langs[l]}</option>)}
                </select>
              </div>
              <div>
                <label className="a-label" htmlFor={`${uid}-t`}>{w.topic}</label>
                <select id={`${uid}-t`} className="a-select min-h-[44px]" value={form.topic} onChange={(e) => set("topic", e.target.value as "" | CampaignTopic)}>
                  <option value="">{w.topics.any}</option>
                  <option value="blog">{w.topics.blog}</option>
                  <option value="releases">{w.topics.releases}</option>
                </select>
              </div>
            </div>
            <div className="a-box p-3" role="status" aria-live="polite" data-testid="audience-count">
              <p className="a-label !mt-0">{w.recipients}</p>
              {!campaign ? (
                <p className="a-hint !mt-0">{w.audienceSaveFirst}</p>
              ) : audience === "loading" ? (
                <p className="a-hint !mt-0">{w.audienceLoading}</p>
              ) : audience === "failed" ? (
                <p className="a-error !mt-0">{w.audienceFailed}</p>
              ) : (
                <>
                  <p className="text-lg font-bold tabular-nums">{audience.count === 0 ? w.recipientNone : w.recipientCount(audience.count)}</p>
                  {audience.samples.length > 0 && (
                    <p className="a-hint">
                      {w.samples}: {audience.samples.map((s, i) => <bdi key={i} dir="ltr" className="me-3">{s}</bdi>)}
                    </p>
                  )}
                </>
              )}
              {audienceStale && <p className="a-hint">{w.audienceStale}</p>}
            </div>
          </section>
        </fieldset>

        {issues.length > 0 && (
          <div role="alert">
            <p className="a-error">{w.invalid}</p>
            <ul className="list-disc ps-5">{issues.map((i) => <li key={i.path + i.message} className="a-error mt-0">{i.path ? `${i.path}: ` : ""}{i.message}</li>)}</ul>
          </div>
        )}

        {editable && (
          <section aria-labelledby={`${uid}-sch`} className="a-box space-y-3 p-4">
            <h3 id={`${uid}-sch`} className="display-tight text-lg">{w.scheduleHeading}</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="a-label" htmlFor={`${uid}-w`}>{w.scheduleAt}</label>
                <input id={`${uid}-w`} type="datetime-local" className="a-input min-h-[44px]" dir="ltr" value={when} onChange={(e) => (setWhen(e.target.value), setNow(Date.now()))} />
              </div>
              <div>
                <label className="a-label" htmlFor={`${uid}-z`}>{w.scheduleZone}</label>
                <select id={`${uid}-z`} className="a-select min-h-[44px]" dir="ltr" value={zone} onChange={(e) => (setZone(e.target.value), setNow(Date.now()))}>
                  {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <button type="button" className="a-btn min-h-[44px]" disabled={!canGo || !scheduleIso || past} onClick={() => void doSchedule()}>{w.scheduleDo}</button>
            </div>
            {past && <p className="a-error !mt-0">{w.schedulePast}</p>}
            {scheduleIso && !past && <p className="a-hint !mt-0">{w.scheduleShown(fmt(scheduleIso))}</p>}
          </section>
        )}

        {editable && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="a-btn min-h-[44px]" disabled={!formOk || busy !== "" || (id !== "new" && !dirty)}>{busy === "save" ? w.saving : w.save}</button>
            <button type="button" className="a-btn min-h-[44px]" disabled={!formOk || busy !== "" || !sender || sender.testRecipients.length === 0} onClick={() => void sendTest()}>{busy === "test" ? w.sendingTest : w.sendTest}</button>
            <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={!canGo} onClick={() => void askSend()}>{w.sendNow}</button>
            {dirty && id !== "new" && <span className="text-sm text-clay">{w.unsaved}</span>}
            {sender && sender.testRecipients.length === 0 && <span className="a-hint !mt-0">{w.testNeedsRecipients}</span>}
          </div>
        )}
        {conflict && (
          <p className="a-error" role="alert">
            {w.conflict} <button type="button" className="a-btn min-h-[44px]" onClick={() => (setConflict(false), setTick((n) => n + 1))}>{w.reload}</button>
          </p>
        )}
        <p role="status" className={msg?.kind === "bad" ? "text-sm font-bold text-[rgb(var(--destructive-ink))]" : "text-sm text-clay"}>{msg?.text}</p>
      </form>

      <section aria-labelledby={`${uid}-ph`} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id={`${uid}-ph`} className="display-tight text-lg">{w.previewHeading}</h3>
          <div className="flex items-center gap-2">
            <label className="a-label !mt-0" htmlFor={`${uid}-pl`}>{w.previewLang}</label>
            <select id={`${uid}-pl`} className="a-select min-h-[44px]" value={pvLang} onChange={(e) => setPvLang(e.target.value as "en" | "he")}>
              <option value="en">{w.previewEn}</option>
              <option value="he">{w.previewHe}</option>
            </select>
          </div>
        </div>
        <p className="a-hint !mt-0">{w.previewNote}</p>
        {preview && <EmailPreview html={preview.html} text={preview.text} subject={preview.subject} />}
      </section>

      {campaign?.status === "draft" && (
        <details className="a-box p-3">
          <summary className="flex min-h-[44px] cursor-pointer items-center font-bold">{w.deleteHeading}</summary>
          <div className="pt-2">
            <button type="button" className="a-btn a-btn-danger min-h-[44px]" onClick={() => setDialog("delete")}>{w.deleteDraft}</button>
          </div>
        </details>
      )}

      {dialog === "send" && (
        <Modal title={w.confirmHeading} titleId={`${uid}-cd`} onClose={() => setDialog(null)}>
          <div className="space-y-3" data-testid="confirm-send">
            <dl className="space-y-1 text-sm">
              <div><dt className="a-label !mt-0">{w.confirmSubject}</dt><dd dir="auto" className="font-bold">{form.subject}</dd></div>
              <div><dd dir="auto">{w.confirmFrom(fromLabel)}</dd></div>
            </dl>
            <p className="text-lg font-bold tabular-nums" role="status">{confirmCount === null ? w.confirmChecking : w.confirmCount(confirmCount)}</p>
            <p className="a-hint !mt-0 font-bold">{w.confirmFinal}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={confirmCount === null || confirmCount === 0 || busy !== ""} onClick={() => void run(() => adminCampaigns.sendNow(campaign!.id))}>
                {confirmCount === null ? w.confirmChecking : w.confirmDo(confirmCount)}
              </button>
              <button type="button" className="a-btn min-h-[44px]" onClick={() => setDialog(null)}>{w.cancel}</button>
            </div>
          </div>
        </Modal>
      )}
      {dialog === "cancel" && campaign && (
        <Modal title={w.cancelHeading} titleId={`${uid}-cc`} onClose={() => setDialog(null)}>
          <p className="a-hint !mt-0">{w.cancelBody}</p>
          <div className="flex flex-wrap gap-2 pt-4">
            <button type="button" className="a-btn a-btn-danger min-h-[44px]" disabled={busy !== ""} onClick={() => void run(() => adminCampaigns.cancel(campaign.id))}>{w.cancelDo}</button>
            <button type="button" className="a-btn min-h-[44px]" onClick={() => setDialog(null)}>{w.cancelKeep}</button>
          </div>
        </Modal>
      )}
      {dialog === "delete" && campaign && (
        <Modal title={w.deleteConfirm} titleId={`${uid}-cx`} onClose={() => setDialog(null)}>
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" className="a-btn a-btn-danger min-h-[44px]" onClick={() => void adminCampaigns.remove(campaign.id).then(() => (onChanged(), onClose()), () => (setDialog(null), setMsg({ kind: "bad", text: w.saveFailed })))}>{w.deleteDo}</button>
            <button type="button" className="a-btn min-h-[44px]" onClick={() => setDialog(null)}>{w.cancel}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
