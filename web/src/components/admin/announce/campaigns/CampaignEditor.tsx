import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { hasTextProblem, identityMissing } from "../sender/defaults";
import { Link } from "react-router-dom";
import { ErrorState } from "@/components/admin/ui";
import { DisclosureButton } from "@/components/ui/Disclosure";
import { ContentInvalidError, type Issue } from "@/services/adminContent";
import { adminAnnounce, type AnnounceSummary, type SenderSettings } from "@/services/adminAnnounce";
import type { Group } from "@/services/adminAudience";
import {
  adminCampaigns,
  CampaignConflictError,
  CampaignRefusedError,
  type CapChoice,
  type CapInfo,
  type AudienceSample,
  type Block,
  type Campaign,
  type CampaignInput,
  type CampaignLang,
  type CampaignTopic,
} from "@/services/adminCampaigns";
import Modal from "../audience/Modal";
import BudgetPlan from "./BudgetPlan";
import EmailPreview from "../previews/EmailPreview";
import BlocksEditor from "./BlocksEditor";
import { blockProblem, blocksToText, cleanBlocks, createPayload, toInput, zonedToIso, type Form } from "./helpers";
import Progress from "./Progress";
import { pillState } from "./status";
import { Disclosure } from "@/components/ui/Disclosure";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { ICON } from "@/components/ui/icons";
import { Journey } from "@/components/ui/Journey";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { usePhone } from "@/hooks/usePhone";
import { usePhoneCampaignWords } from "./phoneWords";
import { useCampaignWords } from "./words";

/*
 * One campaign. A draft is editable; anything else is shown read-only with its
 * progress. Sending and scheduling need a saved draft and a footer identity,
 * so both save first and the server has the last word (it refuses without an
 * identity or without recipients, and its sentence is shown as it came).
 */

const BLANK: Form = { name: "", subject: "", preheader: "", bodyText: "", useBlocks: false, blocks: [], groups: ["subscribers"], lang: "all", topic: "" };
const toForm = (c: Campaign): Form => ({
  name: c.name, subject: c.subject, preheader: c.preheader, bodyText: c.bodyText, useBlocks: Boolean(c.blocks?.length), blocks: c.blocks ?? [],
  groups: c.groups, lang: c.lang, topic: c.topic ?? "",
});
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

type Dialog = "send" | "cap" | "cancel" | "delete" | "resume" | null;
type Mode = "now" | "later";
type PreviewState = { key: string; data: { subject: string; html: string; text: string } | "failed" };
const DEBOUNCE_MS = 450;
type Msg = { kind: "ok" | "bad"; text: string } | null;


/* A numbered step: the number is part of the heading, so the order is read as well as seen. */
function Step({ n, title, labelId, children }: { n: number; title: string; labelId: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={labelId} className="space-y-3 border-t border-[rgb(var(--rule-firm)/.5)] pt-5 lg:col-start-1">
      <h3 id={labelId} className="display-tight flex items-center gap-3 text-lg">
        <span aria-hidden="true" className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[rgb(var(--ink))] text-sm text-[rgb(var(--paper))]">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

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
  const pw = usePhoneCampaignWords();
  const phone = usePhone();
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
  const [capInfo, setCapInfo] = useState<CapInfo | null>(null);
  const [audienceRes, setAudienceRes] = useState<{ key: string; data: AudienceSample | "failed" } | null>(null);
  const [previewRes, setPreviewRes] = useState<PreviewState | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("now");
  const [when, setWhen] = useState("");
  const [zone, setZone] = useState(localZone);
  const [pvLang, setPvLang] = useState<"en" | "he">("en");
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(0);

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

  /* Once a campaign has been saved its status decides, whatever id the editor was opened with. */
  const editable = campaign ? campaign.status === "draft" : id === "new";
  const dirty = campaign ? !same(toInput(form), toInput(toForm(campaign))) : id === "new";
  const lacks = sender ? identityMissing(sender) : [];
  const footerOk = lacks.length === 0;
  const blockBad = form.useBlocks && (form.blocks.length === 0 || form.blocks.some((b) => blockProblem(b)));

  /* The count follows what is ticked now, saved or not: the server counts, never the page. */
  const akey = audienceKey(form);
  useEffect(() => {
    if (form.groups.length === 0) return;
    let live = true;
    const t = setTimeout(() => {
      adminCampaigns.audienceOf({ groups: form.groups, lang: form.lang, topic: form.topic || null }).then(
        (a) => live && setAudienceRes({ key: akey, data: a }),
        () => live && setAudienceRes({ key: akey, data: "failed" }),
      );
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [akey]);
  const audience = form.groups.length === 0 ? "none" : audienceRes && audienceRes.key === akey ? audienceRes.data : "loading";
  const recipients = typeof audience === "object" ? audience.count : null;
  const overCap = typeof audience === "object" && audience.cap ? audience.overCap ?? 0 : 0;

  /* The preview is the server's own render of the draft, so it is what would be sent. Blocks it would refuse are left out until fixed. */
  const pvBody = useMemo(
    () => ({
      subject: form.subject, preheader: form.preheader.trim(),
      bodyText: form.useBlocks ? blocksToText(cleanBlocks(form.blocks)) : form.bodyText,
      blocks: form.useBlocks ? cleanBlocks(form.blocks).filter((b) => !blockProblem(b)) : null,
      lang: pvLang,
    }),
    [form.subject, form.preheader, form.bodyText, form.useBlocks, form.blocks, pvLang],
  );
  const pkey = JSON.stringify(pvBody);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      adminCampaigns.preview(pvBody).then(
        (d) => live && setPreviewRes({ key: pkey, data: d }),
        () => live && setPreviewRes({ key: pkey, data: "failed" }),
      );
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkey]);
  const pv = previewRes && previewRes.data !== "failed" ? previewRes.data : null;
  const pvStale = !previewRes || previewRes.key !== pkey;

  const scheduleIso = mode === "later" && when ? zonedToIso(when, zone) : null;
  const missing = mode === "later" && Boolean(when) && scheduleIso === null && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when);
  const past = scheduleIso !== null && Date.parse(scheduleIso) <= now;

  /* What stands between the owner and Send, in words, in the order of the steps. */
  const problems: string[] = [];
  if (!form.subject.trim()) problems.push(w.readySubject);
  if (form.groups.length === 0) problems.push(w.readyGroups);
  if (blockBad) problems.push(w.readyBlocks);
  if (recipients === 0) problems.push(w.readyAudience);
  if (mode === "later" && (!scheduleIso || past)) problems.push(w.readyTime);
  if (!footerOk && sender) problems.push(w.readyFooter(lacks.map((k) => (k === "name" ? w.idName : w.idEmail)).join(w.idAnd)));
  if (sender && hasTextProblem(sender)) problems.push(w.readyUnsubNote);
  const formOk = Boolean(form.subject.trim() && form.groups.length > 0 && !blockBad);
  const canGo = editable && problems.length === 0 && busy === "";

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
      const c = campaign ? await adminCampaigns.update(campaign.id, input, campaign._rev) : await adminCampaigns.create({ ...createPayload(input), ...(eventId ? { eventId } : {}) });
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
      setForm((f) => ({ ...f, subject: (item?.subject || d.event.title).split("\n")[0].slice(0, 200), bodyText: item?.text ?? `${d.event.title}\n\n${d.event.url}`, useBlocks: false }));
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

  /* Send or schedule: save, then ask. The count in the dialog is the server's count of what is ticked. */
  const ask = async () => {
    setNow(Date.now());
    const c = dirty ? await save() : campaign;
    if (c) setDialog("send");
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
      /* The limit is a question, not an error: the owner picks, and the same send is asked again with the choice. */
      if (e instanceof CampaignRefusedError && e.cap) {
        setCapInfo(e.cap);
        setDialog("cap");
      } else {
        setDialog(null);
        explain(e);
      }
    } finally {
      setBusy("");
    }
  };
  /* The count on the confirm button is the count sent along: the server refuses if the audience no longer matches it. */
  const dispatch = (c: Campaign, choice: CapChoice = {}) => () => {
    const withCount = { ...choice, ...(recipients !== null ? { confirmCount: recipients } : {}) };
    return later && scheduleIso ? adminCampaigns.schedule(c.id, scheduleIso, withCount) : adminCampaigns.sendNow(c.id, withCount);
  };

  const zones = useMemo(() => Array.from(new Set([zone, ...ZONES])), [zone]);
  const fmt = (iso: string) => new Intl.DateTimeFormat(document.documentElement.lang === "he" ? "he-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  if (loadError) return <ErrorState message={w.loadFailed} onRetry={() => (setLoadError(false), setTick((n) => n + 1))} />;
  if (id !== "new" && !campaign) return <p className="a-box a-box-row text-clay" role="status">{w.loading}</p>;

  const heading = !campaign ? w.newHeading : editable ? w.editHeading : w.viewHeading;
  const status = campaign?.status;
  const fromLabel = sender ? [sender.fromName, sender.fromAddress].filter(Boolean).join(" ") || "—" : "—";
  const later = mode === "later";

  const previewBox = (
    <aside aria-labelledby={`${uid}-ph`} className="space-y-2 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:self-start" data-testid="preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${uid}-ph`} className="display-tight text-lg">{w.previewHeading}</h3>
        <DisclosureButton className="!w-auto lg:!hidden" expanded={previewOpen} controls={`${uid}-pb`} onToggle={() => setPreviewOpen((o) => !o)}>{previewOpen ? w.hidePreview : w.showPreview}</DisclosureButton>
      </div>
      <div id={`${uid}-pb`} className={`space-y-2 ${previewOpen ? "" : "hidden"} lg:block`}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="a-label !mt-0" htmlFor={`${uid}-pl`}>{w.previewLang}</label>
          <select id={`${uid}-pl`} className="a-select min-h-[44px]" value={pvLang} onChange={(e) => setPvLang(e.target.value as "en" | "he")}>
            <option value="en">{w.previewEn}</option>
            <option value="he">{w.previewHe}</option>
          </select>
        </div>
        {previewRes?.data === "failed" && <p className="a-error !mt-0" role="status">{w.previewFailed}</p>}
        {pvStale && previewRes?.data !== "failed" && <p className="a-hint !mt-0" role="status">{w.previewLoading}</p>}
        {pv && <EmailPreview html={pv.html} text={pv.text} subject={pv.subject} />}
        <p className="a-hint !mt-0">{w.previewNote}</p>
      </div>
    </aside>
  );

  return (
    <div className="max-w-6xl space-y-5" data-testid="campaign-editor">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={onClose}><ArrowLeft aria-hidden="true" className="a-mirror" />{w.back}</button>
        <h2 className="display-tight text-xl">{heading}</h2>
        {campaign && (phone
          ? <StatusGlyph kind={campaign.status} withWord />
          : <span className="a-pill" data-state={pillState(campaign.status)}><span className="a-pill-mark" aria-hidden="true" />{w.statuses[campaign.status]}</span>)}
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
      {status === "paused" && campaign && (
        <div className="a-box border-[rgb(var(--destructive-ink))] p-4" role="alert" data-testid="paused-banner">
          <p className="font-bold">{w.pausedTitle}</p>
          <p className="a-hint">{campaign.pausedReason ? w.pausedReasons[campaign.pausedReason] : ""}</p>
          <p className="a-hint">{w.pausedKept}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="a-btn a-btn-primary min-h-[44px]" onClick={() => setDialog("resume")}>{w.resume}</button>
            <button type="button" className="a-btn a-btn-danger min-h-[44px]" onClick={() => setDialog("cancel")}>{w.cancelSend}</button>
          </div>
        </div>
      )}
      {status === "sending" && <button type="button" className="a-btn a-btn-danger min-h-[44px]" onClick={() => setDialog("cancel")}>{w.cancelSend}</button>}

      <form noValidate onSubmit={(e) => (e.preventDefault(), void save())}>
        <fieldset disabled={!editable} className="min-w-0">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
            <Step n={1} title={w.step1} labelId={`${uid}-s1`}>
              {!campaign && id === "new" && events.length > 0 && (
                <div>
                  <span className="flex items-center justify-between gap-2"><label className="a-label" htmlFor={`${uid}-ev`}>{w.startFrom}</label>{phone && <InfoPopover label={w.startFrom} text={w.startFromHint} />}</span>
                  <select id={`${uid}-ev`} className="a-select min-h-[44px] max-w-full" value="" onChange={(e) => void startFrom(e.target.value)}>
                    <option value="">{w.startFromNone}</option>
                    {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                  </select>
                  {!phone && <p className="a-hint">{w.startFromHint}</p>}
                </div>
              )}
              <div>
                <label className="a-label" htmlFor={`${uid}-s`}>{w.subject}</label>
                <input id={`${uid}-s`} className="a-input min-h-[44px]" dir="auto" maxLength={200} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
              </div>
              {!phone && (
                <div>
                  <label className="a-label" htmlFor={`${uid}-p`}>{w.preheader}</label>
                  <input id={`${uid}-p`} className="a-input min-h-[44px]" dir="auto" maxLength={200} value={form.preheader} onChange={(e) => set("preheader", e.target.value)} aria-describedby={`${uid}-phint`} />
                  <p id={`${uid}-phint`} className="a-hint">{w.preheaderHint}</p>
                </div>
              )}
              {!form.useBlocks && (
                <div>
                  <span className="flex items-center justify-between gap-2"><label className="a-label" htmlFor={`${uid}-b`}>{w.bodyText}</label>{phone && <InfoPopover label={w.bodyText} text={w.bodyHint} />}</span>
                  <textarea id={`${uid}-b`} className="a-textarea" rows={9} dir="auto" value={form.bodyText} onChange={(e) => set("bodyText", e.target.value)} aria-describedby={phone ? undefined : `${uid}-bhint`} />
                  {!phone && <p id={`${uid}-bhint`} className="a-hint">{w.bodyHint}</p>}
                </div>
              )}
              <Disclosure className="a-box" summary={w.blocksHeading} open={form.useBlocks}>
                <div className="space-y-3">
                  <label className="flex min-h-[44px] items-center gap-3 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={form.useBlocks} onChange={(e) => set("useBlocks", e.target.checked)} />
                    <span>{w.useBlocks}</span>
                  </label>
                  <p className="a-hint !mt-0">{w.blocksHint}</p>
                  {form.useBlocks && <BlocksEditor blocks={form.blocks} onChange={(b) => set("blocks", b)} />}
                </div>
              </Disclosure>
              <Disclosure className="a-box" summary={phone ? pw.moreOptions : w.ownName}>
                {phone && (
                  <div>
                    <label className="a-label" htmlFor={`${uid}-p`}>{w.preheader}</label>
                    <input id={`${uid}-p`} className="a-input min-h-[44px]" dir="auto" maxLength={200} value={form.preheader} onChange={(e) => set("preheader", e.target.value)} />
                  </div>
                )}
                <div>
                  <label className="a-label" htmlFor={`${uid}-n`}>{w.internalName}</label>
                  <input id={`${uid}-n`} className="a-input min-h-[44px]" dir="auto" maxLength={120} value={form.name} onChange={(e) => set("name", e.target.value)} aria-describedby={`${uid}-nh`} />
                  <p id={`${uid}-nh`} className="a-hint">{w.internalNameHint}</p>
                </div>
              </Disclosure>
            </Step>

            {previewBox}

            <Step n={2} title={w.step2} labelId={`${uid}-s2`}>
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
                  <span className="flex items-center justify-between gap-2"><label className="a-label" htmlFor={`${uid}-t`}>{w.topic}</label>{phone && <InfoPopover label={w.topic} text={w.topicHint} />}</span>
                  <select id={`${uid}-t`} className="a-select min-h-[44px]" value={form.topic} onChange={(e) => set("topic", e.target.value as "" | CampaignTopic)} aria-describedby={phone ? undefined : `${uid}-th`}>
                    <option value="">{w.topics.any}</option>
                    <option value="blog">{w.topics.blog}</option>
                    <option value="releases">{w.topics.releases}</option>
                  </select>
                </div>
              </div>
              {!phone && <p id={`${uid}-th`} className="a-hint !mt-0">{w.topicHint}</p>}
              <div className="a-box p-3" role="status" aria-live="polite" data-testid="audience-count">
                <p className="a-label !mt-0">{w.recipients}</p>
                {audience === "none" ? (
                  <p className="a-hint !mt-0">{w.groupsRequired}</p>
                ) : audience === "loading" ? (
                  <p className="a-hint !mt-0">{w.audienceLoading}</p>
                ) : audience === "failed" ? (
                  <p className="a-error !mt-0">{w.audienceFailed}</p>
                ) : (
                  <>
                    <p className="text-lg font-bold tabular-nums">{audience.count === 0 ? w.recipientNone : w.recipientCount(audience.count)}</p>
                    {audience.samples.length > 0 && (
                      <p className="a-hint">{w.samples}: {audience.samples.map((s, i) => <bdi key={i} dir="ltr" className="me-3">{s}</bdi>)}</p>
                    )}
                  </>
                )}
              </div>
            </Step>

            <Step n={3} title={w.step3} labelId={`${uid}-s3`}>
              <div role="group" aria-label={w.whenMode} className="a-seg">
                <button type="button" className="min-h-[44px]" aria-pressed={!later} onClick={() => (setMode("now"), setNow(Date.now()))}>{w.modeNow}</button>
                <button type="button" className="min-h-[44px]" aria-pressed={later} onClick={() => (setMode("later"), setNow(Date.now()))}>{w.modeLater}</button>
              </div>
              {later && (
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
                </div>
              )}
              {later && past && <p className="a-error !mt-0">{w.schedulePast}</p>}
              {later && missing && <p className="a-error !mt-0">{w.scheduleMissing}</p>}
              {later && scheduleIso && !past && <p className="a-hint !mt-0">{w.scheduleShown(fmt(scheduleIso))}</p>}
            </Step>

            <Step n={4} title={w.step4} labelId={`${uid}-s4`}>
              {phone ? (
                <div className="space-y-3" data-testid="review">
                  <p dir="auto" className="min-w-0 break-words text-sm"><span className="font-bold">{w.reviewSubject}: </span>{form.subject || "—"}</p>
                  <Journey
                    from={{ icon: ICON.from, label: fromLabel }}
                    to={{ icon: ICON.to, label: recipients === null ? "—" : w.recipientCount(recipients) }}
                    via={<><ICON.when size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" /> {later ? (scheduleIso && !past ? fmt(scheduleIso) : "—") : w.reviewNow}</>}
                  />
                </div>
              ) : (
              <dl className="a-box grid grid-cols-1 gap-x-4 gap-y-2 p-3 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="font-bold">{w.reviewSubject}</dt>
                <dd dir="auto" className="min-w-0 break-words">{form.subject || "—"}</dd>
                <dt className="font-bold">{w.reviewFrom}</dt>
                <dd dir="auto" className="min-w-0 break-words">{fromLabel}</dd>
                <dt className="font-bold">{w.reviewTo}</dt>
                <dd className="tabular-nums">{recipients === null ? "—" : w.recipientCount(recipients)}</dd>
                <dt className="font-bold">{w.reviewWhen}</dt>
                <dd>{later ? (scheduleIso && !past ? fmt(scheduleIso) : "—") : w.reviewNow}</dd>
              </dl>
              )}
              {editable && (
                <div role="status" data-testid="readiness">
                  {problems.length > 0 ? (
                    <>
                      <p className="a-label !mt-0">{w.readyTitle}</p>
                      <ul className="list-disc ps-5 text-sm">{problems.map((p) => <li key={p} className="a-error mt-0">{p}</li>)}</ul>
                    </>
                  ) : (
                    <p className="a-hint !mt-0 font-bold">{w.readyOk}</p>
                  )}
                  {recipients !== null && recipients > 0 && <BudgetPlan remaining={recipients} />}
                  {overCap > 0 && recipients !== null && typeof audience === "object" && <p className="a-hint font-bold" data-testid="ready-cap">{w.readyCap(overCap, recipients, audience.cap ?? 0)}</p>}
                </div>
              )}
              {issues.length > 0 && (
                <div role="alert">
                  <p className="a-error">{w.invalid}</p>
                  <ul className="list-disc ps-5">{issues.map((i) => <li key={i.path + i.message} className="a-error mt-0">{i.path ? `${i.path}: ` : ""}{i.message}</li>)}</ul>
                </div>
              )}
            </Step>
          </div>
        </fieldset>

        {editable && (
          <div className="sticky bottom-0 z-10 -mx-1 mt-6 border-t border-[rgb(var(--rule-firm)/.7)] bg-[rgb(var(--paper))] px-1 py-3" data-testid="action-bar">
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="a-btn min-h-[44px]" disabled={!formOk || busy !== "" || (campaign !== null && !dirty)}>{busy === "save" ? w.saving : w.save}</button>
              <button type="button" className="a-btn min-h-[44px]" disabled={!formOk || busy !== "" || !sender || sender.testRecipients.length === 0} onClick={() => void sendTest()}>{busy === "test" ? w.sendingTest : w.sendTest}</button>
              <button type="button" className="a-btn a-btn-primary min-h-[44px] ms-auto" disabled={!canGo} onClick={() => void ask()}>{later ? w.actionSchedule : w.sendNow}</button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4" aria-live="polite">
              {dirty && campaign && <span className="text-sm text-clay">{w.unsaved}</span>}
              {sender && sender.testRecipients.length === 0 && <span className="a-hint !mt-0">{w.testNeedsRecipients}</span>}
              <span role="status" className={msg?.kind === "bad" ? "text-sm font-bold text-[rgb(var(--destructive-ink))]" : "text-sm text-clay"}>{msg?.text}</span>
            </div>
            {conflict && (
              <p className="a-error" role="alert">
                {w.conflict} <button type="button" className="a-btn min-h-[44px]" onClick={() => (setConflict(false), setTick((n) => n + 1))}>{w.reload}</button>
              </p>
            )}
          </div>
        )}
      </form>

      {campaign?.status === "draft" && (
        <Disclosure className="a-box" summary={w.deleteHeading}>
          <button type="button" className="a-btn a-btn-danger min-h-[44px]" onClick={() => setDialog("delete")}>{w.deleteDraft}</button>
        </Disclosure>
      )}

      {dialog === "send" && campaign && (
        <Modal title={later ? w.scheduleConfirmHeading : w.confirmHeading} titleId={`${uid}-cd`} onClose={() => setDialog(null)}>
          <div className="space-y-3" data-testid="confirm-send">
            <dl className="space-y-1 text-sm">
              <div><dt className="a-label !mt-0">{w.confirmSubject}</dt><dd dir="auto" className="font-bold">{form.subject}</dd></div>
              <div><dd dir="auto">{w.confirmFrom(fromLabel)}</dd></div>
            </dl>
            <p className="text-lg font-bold tabular-nums" role="status">{recipients === null ? w.confirmChecking : w.confirmCount(recipients)}</p>
            {later && scheduleIso ? <p className="a-hint !mt-0 font-bold">{w.scheduleConfirmBody(fmt(scheduleIso))}</p> : <p className="a-hint !mt-0 font-bold">{w.confirmFinal}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={recipients === null || recipients === 0 || busy !== ""}
                onClick={() => void run(dispatch(campaign))}
              >
                {recipients === null ? w.confirmChecking : later ? w.scheduleConfirmDo(recipients) : w.confirmDo(recipients)}
              </button>
              <button type="button" className="a-btn min-h-[44px]" onClick={() => setDialog(null)}>{w.cancel}</button>
            </div>
          </div>
        </Modal>
      )}
      {dialog === "cap" && campaign && capInfo && (
        <Modal title={w.capHeading} titleId={`${uid}-cp`} onClose={() => setDialog(null)}>
          <div className="space-y-3" data-testid="cap-block">
            <p className="font-bold tabular-nums" role="status">{w.capBody(capInfo.capped, capInfo.total, capInfo.max)}</p>
            <p className="a-hint !mt-0">{w.capSkipHint}</p>
            <p className="a-hint !mt-0">{w.capOverrideHint}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={busy !== "" || capInfo.total === capInfo.capped} onClick={() => void run(dispatch(campaign, { skipCapped: true }))}>{w.capSkip(capInfo.total - capInfo.capped)}</button>
              <button type="button" className="a-btn a-btn-danger min-h-[44px]" disabled={busy !== ""} onClick={() => void run(dispatch(campaign, { overrideCap: true }))}>{w.capOverride}</button>
              <button type="button" className="a-btn min-h-[44px]" onClick={() => setDialog(null)}>{w.cancel}</button>
            </div>
          </div>
        </Modal>
      )}
      {dialog === "resume" && campaign && (
        <Modal title={w.resumeHeading} titleId={`${uid}-rs`} onClose={() => setDialog(null)}>
          <p className="a-hint !mt-0">{w.resumeBody}</p>
          <div className="flex flex-wrap gap-2 pt-4">
            <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={busy !== ""} onClick={() => void run(() => adminCampaigns.resume(campaign.id))}>{w.resumeDo}</button>
            <button type="button" className="a-btn min-h-[44px]" onClick={() => setDialog(null)}>{w.cancel}</button>
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
