import { useId } from "react";
import { ICON } from "@/components/ui/icons";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { SettingsList, type SettingsGroupDef } from "@/components/ui/SettingsList";
import { SettingsRow } from "@/components/ui/SettingsRow";
import type { SettingsItem } from "@/components/ui/settingsKit";
import { ANNOUNCE_CHANNELS, NOTIFY_EVENTS, type AnnounceKind, type AnnounceSettings, type SenderWarning } from "@/services/adminAnnounce";
import { hashtagOk, HASHTAGS_MAX } from "./sender/rules";
import { CONTACT_FIELDS, DEFAULT_SENDER, hasTextProblem, identityMissing, senderProblems } from "./sender/defaults";
import { DEFAULT_NOTIFY } from "./notify/defaults";
import NotifySection from "./notify/NotifySection";
import SenderSection from "./sender/SenderSection";
import { useNotifyWords } from "./notify/words";
import { useSenderWords } from "./sender/words";
import { useBudgetWords } from "./sender/budgetWords";
import { useSettingsPanelWords } from "./settingsWords";
import { useAnnounceWords } from "./words";

/*
 * Marketing > Settings below 600px (#678): the same document as the desktop
 * form, shown as a list of groups. Each group is one row with ONE live summary
 * line and opens as a half sheet (two switches) or a page (anything with a
 * text field or more than four controls). Help text is behind an info button;
 * only a warning or an error is ever printed under a control. Every edit goes
 * through the panel's `change`, so Save, Discard, the revision check and the
 * saved document are the ones the desktop form uses.
 */

/* A summary is a plain string, so a name or address inside a Hebrew line is isolated with Unicode controls: left-to-right for tags and addresses, first-strong for names. */
const ltr = (t: string) => `\u2066${t}\u2069`;
const isolate = (t: string) => `\u2068${t}\u2069`;

export const UTM_TOKEN = /^[a-z0-9_.-]{1,40}$/;
const GROUP_IDS = ["mail", "channels", "wording", "sender", "limits", "texts", "notices", "advanced"] as const;
export const isGroupId = (v: string | null): v is (typeof GROUP_IDS)[number] => GROUP_IDS.includes(v as never);

export interface PhoneSettingsProps {
  /** The draft with the hashtag text parsed in: what Save would send. */
  working: AnnounceSettings;
  tagText: string;
  onTagText: (v: string) => void;
  change: (fn: (d: AnnounceSettings) => void) => void;
  /** After a group reset: clear the typed hashtag text, then edit. */
  resetWording: () => void;
  resetAdvanced: () => void;
  warnings: SenderWarning[];
  openId: string | null;
  onOpenChange: (id: string | null) => void;
}

function Reset({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const sw = useSettingsPanelWords();
  return (
    <div className="px-4 py-3">
      <button type="button" className="a-btn a-btn-ghost min-h-[44px]" disabled={disabled} onClick={onClick}>
        {sw.resetSection}
      </button>
    </div>
  );
}

/* A field's label with its help behind an info button. */
function FieldHead({ id, text, help }: { id: string; text: string; help?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="a-label !mt-0" htmlFor={id}>{text}</label>
      {help && <InfoPopover label={text} text={help} />}
    </div>
  );
}

const hasSenderProblem = (s: AnnounceSettings["sender"]) => {
  const p = senderProblems(s);
  return Boolean(p.fromName || p.fromAddress || p.replyTo || p.identityEmail || CONTACT_FIELDS.some((c) => p[c.f]) || p.testRecipients || identityMissing(s).length > 0);
};
const hasLimitProblem = (s: AnnounceSettings["sender"]) => {
  const p = senderProblems(s);
  return Boolean(p.throttlePerHour || p.dailyCap || p.maxPerContact30d || p.pendingTtlDays || p.quietHours || p.dailyLimit || p.monthlyLimit || p.safety || p.reserveShare);
};

export default function PhoneSettings({ working, tagText, onTagText, change, resetWording, resetAdvanced, warnings, openId, onOpenChange }: PhoneSettingsProps) {
  const w = useAnnounceWords();
  const sw = useSettingsPanelWords();
  const snd = useSenderWords();
  const bw = useBudgetWords();
  const nw = useNotifyWords();
  const uid = useId();

  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? (list.includes(v) ? list : [...list, v]) : list.filter((x) => x !== v));
  const utm = working.advanced.utm;
  const sourceBad = utm.source !== "" && !UTM_TOKEN.test(utm.source);
  const badTags = working.hashtags.filter((t) => !hashtagOk(t));
  const tagsBad = badTags.length > 0 || working.hashtags.length > HASHTAGS_MAX;
  const sample = (() => {
    try {
      const u = new URL("https://example.com/notes/hello");
      u.searchParams.set("utm_source", utm.source || "announce");
      u.searchParams.set("utm_medium", utm.mediumByChannel.linkedin || "linkedin");
      return u.href;
    } catch {
      return "";
    }
  })();

  const sw8 = (id: string, label: string, checked: boolean, onChange: (v: boolean) => void, info?: string) => (
    <SettingsRow key={id} kind="switch" id={id} label={label} info={info} checked={checked} onChange={onChange} />
  );

  const item = (id: string, label: string, info?: string): SettingsItem => ({ id, label, info });

  /* ----- groups ----- */
  const mail = (
    <>
      {sw8("mail", sw.swEvents, working.email.enabled, (v) => change((d) => void (d.email.enabled = v)), `${w.emailEnabled}. ${w.emailHint}`)}
      {sw8("notify", sw.swAlerts, working.notify.enabled, (v) => change((d) => void (d.notify.enabled = v)), `${nw.master}. ${nw.masterHint}`)}
      <Reset
        disabled={!working.email.enabled && !working.notify.enabled}
        onClick={() =>
          change((d) => {
            d.email.enabled = false;
            d.notify.enabled = false;
          })
        }
      />
    </>
  );

  const channels = (
    <>
      {ANNOUNCE_CHANNELS.map((c) =>
        sw8(`channel-${c}`, w.channels[c], working.channels.includes(c), (v) => change((d) => void (d.channels = ANNOUNCE_CHANNELS.filter((x) => (x === c ? v : d.channels.includes(x)))))),
      )}
      <Reset
        disabled={working.channels.length === ANNOUNCE_CHANNELS.length}
        onClick={() => change((d) => void (d.channels = [...ANNOUNCE_CHANNELS]))}
      />
    </>
  );

  const wording = (
    <>
      <div className="px-4 py-3" data-setting-id="hashtags">
        <FieldHead id={`${uid}-tags`} text={w.hashtags} help={w.hashtagsHint} />
        <input id={`${uid}-tags`} className="a-input" dir="auto" value={tagText} onChange={(e) => onTagText(e.target.value)} aria-invalid={tagsBad} aria-describedby={tagsBad ? `${uid}-tags-h` : undefined} autoComplete="off" />
        {tagsBad && <p id={`${uid}-tags-h`} className="a-error">{w.hashtagsBad(badTags.join(" ") || tagText)}</p>}
      </div>
      <div className="px-4 py-3" data-setting-id="signature">
        <FieldHead id={`${uid}-sig`} text={w.signature} help={w.signatureHint} />
        <textarea id={`${uid}-sig`} className="a-textarea" rows={2} maxLength={300} dir="auto" value={working.signature} onChange={(e) => change((d) => void (d.signature = e.target.value))} />
      </div>
      <Reset disabled={working.hashtags.length === 0 && tagText === "" && working.signature === ""} onClick={resetWording} />
    </>
  );

  const senderNode = (part: "identity" | "limits" | "texts") => (
    <div className="space-y-3 p-3">
      <SenderSection sender={working.sender} warnings={warnings} phone part={part} onChange={(fn) => change((d) => fn(d.sender))} />
    </div>
  );

  const notices = (
    <div className="px-1 py-1">
      <NotifySection phone notify={working.notify} onChange={(fn) => change((d) => fn(d.notify))} />
      <Reset
        disabled={JSON.stringify({ ...working.notify, enabled: false }) === JSON.stringify({ ...structuredClone(DEFAULT_NOTIFY), enabled: false })}
        onClick={() => change((d) => void (d.notify = { ...structuredClone(DEFAULT_NOTIFY), enabled: d.notify.enabled }))}
      />
    </div>
  );

  const advanced = (
    <>
      {sw8("record", sw.recordLabel, working.enabled, (v) => change((d) => void (d.enabled = v)), w.enabledHint)}
      <fieldset disabled={!working.email.enabled} className="min-w-0">
        <legend className="sr-only">{w.emailEvents}</legend>
        {(["post", "release"] as AnnounceKind[]).map((k) =>
          sw8(`event-${k}`, `${w.emailEvents}: ${w.kinds[k]}`, working.email.events.includes(k), (v) => change((d) => void (d.email.events = toggle(d.email.events, k, v)))),
        )}
      </fieldset>
      {sw8("utm", sw.utmEnabled, utm.enabled, (v) => change((d) => void (d.advanced.utm.enabled = v)), sw.utmEnabledHint)}
      <fieldset disabled={!utm.enabled} className="min-w-0 space-y-3 px-4 py-3">
        <legend className="sr-only">{sw.utmHeading}</legend>
        <div data-setting-id="utm-source">
          <FieldHead id={`${uid}-src`} text={sw.utmSource} help={sw.utmSourceHint} />
          <input id={`${uid}-src`} className="a-input" dir="ltr" value={utm.source} maxLength={40} aria-invalid={sourceBad} aria-describedby={sourceBad ? `${uid}-src-h` : undefined} autoComplete="off" onChange={(e) => change((d) => void (d.advanced.utm.source = e.target.value))} />
          {sourceBad && <p id={`${uid}-src-h`} className="a-error">{sw.utmSourceHint}</p>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="a-label !mt-0">{sw.utmMediumHeading}</p>
          <InfoPopover label={sw.utmMediumHeading} text={sw.utmMediumHint} />
        </div>
        <div className="grid gap-3">
          {ANNOUNCE_CHANNELS.map((c) => (
            <div key={c} data-setting-id={`utm-medium-${c}`}>
              <label className="a-label !mt-0" htmlFor={`${uid}-m-${c}`}>{sw.utmMedium(w.channels[c])}</label>
              <input
                id={`${uid}-m-${c}`}
                className="a-input"
                dir="ltr"
                maxLength={40}
                placeholder={c}
                value={utm.mediumByChannel[c] ?? ""}
                autoComplete="off"
                onChange={(e) => change((d) => (e.target.value === "" ? void delete d.advanced.utm.mediumByChannel[c] : void (d.advanced.utm.mediumByChannel[c] = e.target.value)))}
              />
            </div>
          ))}
        </div>
        <p className="text-sm text-clay">
          {sw.utmExample}: <bdi dir="ltr" className="break-all">{sample}</bdi>
        </p>
      </fieldset>
      <Reset disabled={false} onClick={resetAdvanced} />
    </>
  );

  /* ----- search items: what each group's fields are called and say ----- */
  const senderItems = [
    item("fromName", snd.fromName, `${snd.fromNameHint} ${snd.envHint}`),
    item("fromAddress", snd.fromAddress, `${snd.fromAddressHint} ${snd.envHint}`),
    item("replyTo", snd.replyTo, `${snd.replyToHint} ${snd.envHint}`),
    item("footerIdentity", snd.footer, snd.footerHint),
    item("identityEmail", snd.idEmail, snd.idEmailHint),
    item("identityPostal", snd.idPostal, snd.idPostalHint),
    ...CONTACT_FIELDS.map((c) => item(c.f, snd[c.label], snd[c.hint])),
    item("labelMode", snd.labelHeading, snd.labelHint),
    item("testRecipients", snd.test, snd.testHint),
  ];
  const limitItems = [
    item("throttlePerHour", snd.throttle, snd.throttleHint),
    item("dailyCap", snd.cap, snd.capHint),
    item("maxPerContact30d", snd.perPerson, snd.perPersonHint),
    item("pendingTtlDays", snd.pendingTtl, snd.pendingTtlHint),
    item("quiet", snd.quietOn, snd.quietHint),
    item("autoDraft", snd.autoDraft, snd.autoDraftHint),
    item("dailyLimit", bw.dailyLimit, bw.dailyLimitHint),
    item("monthlyLimit", bw.monthlyLimit, bw.monthlyLimitHint),
    item("safety", bw.safety, bw.safetyHint),
    item("reserveShare", bw.reserve, bw.reserveHint),
  ];
  const textLabels = { confirmSubjectEn: snd.confirmSubjectEn, confirmSubjectHe: snd.confirmSubjectHe, confirmBodyEn: snd.confirmBodyEn, confirmBodyHe: snd.confirmBodyHe, unsubscribeNoteEn: snd.unsubEn, unsubscribeNoteHe: snd.unsubHe };
  const textItems = (Object.keys(textLabels) as Array<keyof typeof textLabels>).map((k) => item(k, textLabels[k], snd.textsHint));

  const groups: SettingsGroupDef<AnnounceSettings>[] = [
    {
      id: "mail",
      icon: ICON.email,
      title: sw.gMail,
      controls: 2,
      items: [item("mail", sw.swEvents, `${w.emailEnabled}. ${w.emailHint}`), item("notify", sw.swAlerts, `${nw.master}. ${nw.masterHint}`)],
      summary: (d) => sw.sumMail(d.email.enabled, d.notify.enabled),
      render: () => mail,
    },
    {
      id: "channels",
      icon: ICON.channels,
      title: sw.gChannels,
      controls: ANNOUNCE_CHANNELS.length,
      items: ANNOUNCE_CHANNELS.map((c) => item(`channel-${c}`, w.channels[c], w.channelsHeading)),
      summary: (d) => {
        const on = ANNOUNCE_CHANNELS.filter((c) => d.channels.includes(c));
        return on.length === 0 ? sw.sumChannelsNone : on.length <= 3 ? on.map((c) => w.channels[c]).join(", ") : sw.sumChannelsSome(on.length, ANNOUNCE_CHANNELS.length);
      },
      render: () => channels,
    },
    {
      id: "wording",
      icon: ICON.everyday,
      title: sw.gWording,
      controls: 2,
      hasText: true,
      items: [item("hashtags", w.hashtags, w.hashtagsHint), item("signature", w.signature, w.signatureHint)],
      summary: (d) => {
        const shown = d.hashtags.slice(0, 3).map((t) => `#${t.replace(/^#/, "")}`).join(" ");
        return `${d.hashtags.length ? sw.sumTags(ltr(shown), d.hashtags.length - 3) : sw.sumNoTags} · ${d.signature.trim() ? sw.sumSignature : sw.sumNoSignature}`;
      },
      warning: () => (tagsBad ? sw.warnTags : null),
      render: () => wording,
    },
    {
      id: "sender",
      icon: ICON.senderDelivery,
      title: snd.heading,
      controls: 12,
      hasText: true,
      items: senderItems,
      summary: (d) => (d.sender.fromName || d.sender.fromAddress ? [d.sender.fromName && isolate(d.sender.fromName), d.sender.fromAddress && ltr(d.sender.fromAddress)].filter(Boolean).join(" ") : sw.sumSenderNone),
      warning: (d) => (hasSenderProblem(d.sender) ? sw.warnSender : null),
      render: () => senderNode("identity"),
    },
    {
      id: "limits",
      icon: ICON.sendingLimits,
      title: sw.gLimits,
      controls: 10,
      hasText: true,
      items: limitItems,
      summary: (d) => snd.sumLimits(d.sender.throttlePerHour, d.sender.dailyCap, d.sender.quietHours ? `${d.sender.quietHours.from}–${d.sender.quietHours.to}` : ""),
      warning: (d) => (hasLimitProblem(d.sender) ? sw.warnLimits : null),
      render: () => senderNode("limits"),
    },
    {
      id: "texts",
      icon: ICON.note,
      title: sw.gTexts,
      controls: 6,
      hasText: true,
      items: textItems,
      summary: (d) => ((Object.keys(textLabels) as Array<keyof typeof textLabels>).some((f) => d.sender[f] !== DEFAULT_SENDER[f]) ? sw.sumTextsEdited : sw.sumTextsDefault),
      warning: (d) => (hasTextProblem(d.sender) ? sw.warnTexts : null),
      render: () => senderNode("texts"),
    },
    {
      id: "notices",
      icon: ICON.alerts,
      title: sw.gNotices,
      controls: NOTIFY_EVENTS.length + 2,
      hasText: true,
      items: [
        ...NOTIFY_EVENTS.map((k) => item(`notice-${k}`, sw.evShort[k], `${nw.ev[k]} ${nw.events}`)),
        item("notice-digest", sw.swDigest, `${nw.digestOn}. ${nw.digestHint}`),
        ...(working.notify.digest.enabled ? [item("notice-hour", nw.digestHour, nw.digestHourHint)] : []),
        item("notice-lang", nw.lang),
      ],
      summary: (d) => {
        const n = NOTIFY_EVENTS.filter((k) => d.notify.events[k].on).length;
        return d.notify.enabled ? sw.sumNotices(n, NOTIFY_EVENTS.length) : sw.sumNoticesOff;
      },
      render: () => notices,
    },
    {
      id: "advanced",
      icon: ICON.advanced,
      title: sw.advancedHeading,
      controls: 8,
      hasText: true,
      items: [
        item("record", sw.recordLabel, `${w.enabledHint} ${sw.recordKeywords}`),
        ...(["post", "release"] as AnnounceKind[]).map((k) => item(`event-${k}`, `${w.emailEvents}: ${w.kinds[k]}`, sw.emailEventsKeywords)),
        item("utm", sw.utmEnabled, `${sw.utmEnabledHint} ${sw.utmKeywords}`),
        item("utm-source", `${sw.utmHeading}: ${sw.utmSource}`, sw.utmSourceHint),
        ...ANNOUNCE_CHANNELS.map((c) => item(`utm-medium-${c}`, sw.utmMedium(w.channels[c]), sw.utmMediumHint)),
      ],
      summary: (d) => sw.sumAdvanced(d.advanced.utm.enabled, d.enabled),
      warning: () => (sourceBad ? sw.warnAdvanced : null),
      render: () => advanced,
    },
  ];

  return <SettingsList groups={groups} value={working} openId={openId} onOpenChange={onOpenChange} />;
}
