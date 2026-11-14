import { useId, useState, type ReactNode } from "react";
import type { SenderSettings, SenderWarning } from "@/services/adminAnnounce";
import { CONTACT_FIELDS, DEFAULT_SENDER, UNSUB_NOTE_MAX, contactLines, hasTextProblem, identityMissing, senderProblems, unknownPlaceholder, type SenderField, type SenderProblem } from "./defaults";
import { Disclosure } from "@/components/ui/Disclosure";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { useSenderWords } from "./words";
import { useBudgetWords } from "./budgetWords";
import BudgetMeter from "./BudgetMeter";

/*
 * Settings > Advanced > Sender & delivery. It edits the WHOLE sender object in
 * the settings draft: the page saves the object as it stands, because the
 * server fills a missing field with its default. Empty From and Reply-To mean
 * "use the server's own"; every field has its own reset.
 *
 * On a phone (`phone`) the same fields are shown without their help
 * paragraphs: the label gets an info button, only errors stay visible, the
 * checkboxes are switches, and `part` picks which third of the section a
 * Settings group shows (identity, limits, or the subscriber texts).
 */

export type SenderPart = "all" | "identity" | "limits" | "texts";

const fillSample = (tpl: string, name: string, site: string) => tpl.replace(/\{(name|site|days|link)\}/g, (_, k: string) => (k === "name" ? name : k === "site" ? site : k === "days" ? "7" : `https://${site}/…`));

export default function SenderSection({ sender, onChange, warnings, phone = false, part = "all" }: { sender: SenderSettings; onChange: (fn: (s: SenderSettings) => void) => void; warnings: SenderWarning[]; phone?: boolean; part?: SenderPart }) {
  const w = useSenderWords();
  const bw = useBudgetWords();
  const uid = useId();
  const problems = senderProblems(sender);
  const [tests, setTests] = useState<string | null>(null);
  const testText = tests ?? sender.testRecipients.join("\n");
  const site = typeof location === "undefined" ? "example.com" : location.host;

  const err = (f: SenderField) => {
    const p: SenderProblem | undefined = problems[f];
    if (p === "noLink") return f.startsWith("unsub") ? w.noLinkNote : w.noLinkConfirm;
    if (p === "unknown") return w.unknownPlaceholder(unknownPlaceholder(sender[f as keyof SenderSettings] as string) ?? "");
    const contact = CONTACT_FIELDS.find((c) => c.f === f);
    if (p === "address" && contact) return w[contact.bad];
    if (p === "long") return w.noteTooLong(UNSUB_NOTE_MAX);
    if (p === "unsubVars") return w.noteVars;
    if (p === "monthBelowDay") return bw.badMonth;
    if (p === "name") return w.badName;
    if (p === "time") return w.badTime;
    return p ? (p === "empty" ? w.fieldEmpty : p === "address" ? w.badAddress : p === "number" ? w.badNumber : p === "list" ? w.badList : w.invalidZone) : "";
  };
  /* A field's label; on a phone the hint hides behind an info button beside it. */
  const lab = (id: string, text: string, help?: string) =>
    phone ? (
      <div className="flex items-center justify-between gap-2">
        <label className="a-label !mt-0" htmlFor={id}>{text}</label>
        {help && <InfoPopover label={text} text={help} />}
      </div>
    ) : (
      <label className="a-label" htmlFor={id}>{text}</label>
    );
  /* Under a field: the error, or the hint (on a phone the hint is behind the info button, so only an empty anchor stays for aria-describedby). */
  const note = (id: string, bad: string | false | undefined, hint: string) =>
    bad ? <p id={id} className="a-error">{bad}</p> : phone ? <span id={id} hidden /> : <p id={id} className="a-hint">{hint}</p>;
  const reset = (label: string, show: boolean, env: boolean, fn: () => void) =>
    show ? (
      <button type="button" className="a-btn a-btn-ghost min-h-[44px]" aria-label={env ? w.resetEnvFor(label) : w.resetDefaultFor(label)} onClick={fn}>
        {env ? w.resetEnv : w.resetDefault}
      </button>
    ) : null;
  const text = (f: "fromName" | "fromAddress" | "replyTo", label: string, hint: string, opts: { type?: string; max: number; dir?: "ltr" | "auto" }) => {
    const id = `${uid}-${f}`;
    const warn = warnings.filter((x) => x.field === f);
    return (
      <div data-setting-id={f}>
        {lab(id, label, `${hint} ${w.envHint}`)}
        <div className="flex flex-wrap items-start gap-2">
          <input id={id} type={opts.type ?? "text"} className="a-input min-h-[44px] min-w-0 flex-1 basis-56" dir={opts.dir ?? "auto"} maxLength={opts.max} autoComplete="off" value={sender[f]} aria-invalid={Boolean(problems[f])} aria-describedby={`${id}-h`} onChange={(e) => onChange((s) => void (s[f] = e.target.value))} />
          {reset(label, sender[f] !== "", true, () => onChange((s) => void (s[f] = "")))}
        </div>
        {note(`${id}-h`, err(f), `${hint} ${w.envHint}`)}
        {warn.map((x) => <p key={x.code} className="a-hint font-bold" role="status">{w.warningLabel}: {x.message}</p>)}
      </div>
    );
  };
  const num = (f: "throttlePerHour" | "dailyCap" | "maxPerContact30d" | "pendingTtlDays" | "dailyLimit" | "monthlyLimit", label: string, hint: string, max: number, min = 1) => {
    const id = `${uid}-${f}`;
    return (
      <div data-setting-id={f}>
        {lab(id, label, hint)}
        <div className="flex flex-wrap items-start gap-2">
          <input id={id} type="number" inputMode="numeric" min={min} max={max} className="a-input min-h-[44px] w-32 tabular-nums" dir="ltr" value={Number.isNaN(sender[f]) ? "" : sender[f]} aria-invalid={Boolean(problems[f])} aria-describedby={`${id}-h`} onChange={(e) => onChange((s) => void (s[f] = e.target.value === "" ? NaN : Number(e.target.value)))} />
          {reset(label, sender[f] !== DEFAULT_SENDER[f], false, () => onChange((s) => void (s[f] = DEFAULT_SENDER[f])))}
        </div>
        {note(`${id}-h`, err(f), hint)}
      </div>
    );
  };
  /* A ratio stored as 0 to 1, shown and typed as a whole percent. */
  const pct = (f: "safety" | "reserveShare", label: string, hint: string, min: number, max: number) => {
    const id = `${uid}-${f}`;
    const v = sender[f];
    return (
      <div data-setting-id={f}>
        {lab(id, label, hint)}
        <div className="flex flex-wrap items-start gap-2">
          <input id={id} type="number" inputMode="numeric" min={min} max={max} className="a-input min-h-[44px] w-32 tabular-nums" dir="ltr" value={Number.isNaN(v) ? "" : Math.round(v * 100)} aria-invalid={Boolean(problems[f])} aria-describedby={`${id}-h`} onChange={(e) => onChange((s) => void (s[f] = e.target.value === "" ? NaN : Number(e.target.value) / 100))} />
          {reset(label, v !== DEFAULT_SENDER[f], false, () => onChange((s) => void (s[f] = DEFAULT_SENDER[f])))}
        </div>
        {note(`${id}-h`, problems[f] ? bw.badNumber : "", hint)}
      </div>
    );
  };
  const check = (key: string, label: string, hint: string, v: boolean, fn: (v: boolean) => void, def?: boolean) => {
    const id = `${uid}-${key}`;
    return phone ? (
      <div>
        <SettingsRow kind="switch" id={key} label={label} info={hint} checked={v} onChange={fn} />
        {def !== undefined && v !== def && <div className="px-4 pb-2">{reset(label, true, false, () => fn(def))}</div>}
      </div>
    ) : (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-[44px] items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={v} aria-describedby={`${id}-h`} onChange={(e) => fn(e.target.checked)} />
          <span>{label}</span>
        </label>
        {def !== undefined && reset(label, v !== def, false, () => fn(def))}
      </div>
      <p id={`${id}-h`} className="a-hint !mt-0 ps-8">{hint}</p>
    </div>
    );
  };
  const tpl = (f: "confirmSubjectEn" | "confirmSubjectHe" | "confirmBodyEn" | "confirmBodyHe" | "unsubscribeNoteEn" | "unsubscribeNoteHe", label: string, rows: number) => {
    const id = `${uid}-${f}`;
    const he = f.endsWith("He");
    const sample = fillSample(sender[f], he ? w.sampleName : "Dana", site);
    return (
      <div data-setting-id={f}>
        {lab(id, label)}
        <div className="flex flex-wrap items-start gap-2">
          {rows === 1 ? (
            <input id={id} className="a-input min-h-[44px] min-w-0 flex-1 basis-56" dir={he ? "rtl" : "ltr"} lang={he ? "he" : "en"} maxLength={2000} value={sender[f]} aria-invalid={Boolean(problems[f])} onChange={(e) => onChange((s) => void (s[f] = e.target.value))} />
          ) : (
            <textarea id={id} className="a-textarea min-w-0 flex-1 basis-56" rows={rows} dir={he ? "rtl" : "ltr"} lang={he ? "he" : "en"} maxLength={2000} value={sender[f]} aria-invalid={Boolean(problems[f])} aria-describedby={problems[f] ? `${id}-e` : undefined} onChange={(e) => onChange((s) => void (s[f] = e.target.value))} />
          )}
          {reset(label, sender[f] !== DEFAULT_SENDER[f], false, () => onChange((s) => void (s[f] = DEFAULT_SENDER[f])))}
        </div>
        {problems[f] && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="a-error" id={`${id}-e`} role="alert">{err(f)}</p>
            {problems[f] === "noLink" && (
              <button type="button" className="a-btn min-h-[44px]" onClick={() => onChange((s) => void (s[f] = `${s[f].trimEnd()} {link}`.trim()))}>{w.insertLink}</button>
            )}
          </div>
        )}
        <div className="a-box mt-2 p-3" dir={he ? "rtl" : "ltr"} lang={he ? "he" : "en"}>
          <p className="a-label !mt-0" dir="auto">{w.livePreview}</p>
          <p className="whitespace-pre-wrap break-words text-sm" data-testid={`preview-${f}`}>{sample}</p>
        </div>
      </div>
    );
  };

  const q = sender.quietHours;
  const lacks = identityMissing(sender);
  const nameSet = !lacks.includes("name");
  const emailSet = !lacks.includes("email");
  const footerSet = lacks.length === 0;
  const senderBad = Boolean(problems.fromName || problems.fromAddress || problems.replyTo);
  const limitsBad = Boolean(problems.throttlePerHour || problems.dailyCap || problems.maxPerContact30d || problems.pendingTtlDays || problems.quietHours || problems.dailyLimit || problems.monthlyLimit || problems.safety || problems.reserveShare);
  const textsBad = hasTextProblem(sender);
  const idBad = Boolean(problems.identityEmail || CONTACT_FIELDS.some((c) => problems[c.f]));
  const ready = footerSet && !idBad && !senderBad && !limitsBad && !textsBad;
  const mark = (ok: boolean) => (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true" className={ok ? "" : "font-bold text-[rgb(var(--destructive-ink))]"}>{ok ? "✓" : "✗"}</span>
      <span className="sr-only">{ok ? w.okWord : w.fixWord}</span>
    </span>
  );
  const sec = (title: string, summary: ReactNode, body: ReactNode, o: { open?: boolean; bad?: boolean; testid?: string } = {}) =>
    /* A group page that holds one section needs no expander of its own: its title is the section. */
    phone && part === "texts" ? (
      <div className="space-y-4" data-testid={o.testid}>{body}</div>
    ) : (
    <Disclosure
      className="a-box"
      summary={title}
      meta={<span className={o.bad ? "font-bold text-[rgb(var(--destructive-ink))]" : undefined}>{summary}</span>}
      open={phone ? (o.bad ? true : undefined) : o.open}
      testid={o.testid}
    >
      <div className="space-y-4 pb-2">{body}</div>
    </Disclosure>
    );
  const quietText = q ? `${q.from}–${q.to}` : "";
  const showId = part === "all" || part === "identity";
  const showLimits = part === "all" || part === "limits";
  const showTexts = part === "all" || part === "texts";
  /* What still blocks sending, one line each; a phone lists only these. */
  const blockers = [!nameSet && w.ckFooter, !emailSet && w.ckEmail, senderBad && w.ckSender, limitsBad && w.ckLimits, textsBad && w.ckTexts].filter(Boolean) as string[];

  return (
    <section aria-labelledby={`${uid}-h`} className="space-y-4" data-testid="sender-section">
      {phone ? (
        <h3 id={`${uid}-h`} className="sr-only">{w.heading}</h3>
      ) : (
        <div>
          <h3 id={`${uid}-h`} className="display-tight text-lg">{w.heading}</h3>
          <p className="a-hint !mt-0">{w.intro}</p>
        </div>
      )}

      {showId && !footerSet && (
        <div className="a-box border-[rgb(var(--destructive-ink))] p-4" role="alert" data-testid="footer-required">
          <p className="font-bold">{w.footerRequiredTitle}</p>
          <p className="a-hint !mt-0" role="note">{w.footerRequired(lacks.map((k) => (k === "name" ? w.idName : w.idEmail)).join(w.idAndLabel))}</p>
        </div>
      )}

      {showId && phone && (
        <div className="a-box p-3" data-testid="ready">
          <p className="font-bold" role="status">{ready ? "✓ " : "✗ "}{ready ? w.readyYes : w.readyNo}</p>
          {blockers.length > 0 && (
            <ul className="mt-1 text-sm">
              {blockers.map((b) => <li key={b}>{mark(false)} {b}</li>)}
            </ul>
          )}
        </div>
      )}

      {showId && !phone && (
      <div className="a-box p-3" data-testid="ready">
        <p className="font-bold" role="status">{ready ? "✓ " : "✗ "}{w.readyHeading} {ready ? w.readyYes : w.readyNo}</p>
        <ul className="mt-1 text-sm">
          <li>{mark(nameSet)} {w.ckFooter}</li>
          <li>{mark(emailSet)} {w.ckEmail}</li>
          <li>{mark(!senderBad)} {w.ckSender}</li>
          <li>{mark(!limitsBad)} {w.ckLimits}</li>
          <li>{mark(!textsBad)} {w.ckTexts}</li>
          <li>{mark(sender.testRecipients.length > 0)} {w.ckTests} <span className="text-clay">({w.ckTestsHint})</span></li>
        </ul>
      </div>
      )}

      {showId && sec(
        w.secSender,
        <>{sender.fromName || sender.fromAddress ? <bdi>{w.sumSender(sender.fromName, sender.fromAddress)}</bdi> : w.sumSenderDefault} {mark(!senderBad)}</>,
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {text("fromName", w.fromName, w.fromNameHint, { max: 80 })}
          {text("fromAddress", w.fromAddress, w.fromAddressHint, { type: "email", max: 254, dir: "ltr" })}
          <div className="md:col-span-2">{text("replyTo", w.replyTo, w.replyToHint, { type: "email", max: 254, dir: "ltr" })}</div>
        </div>,
        { open: true, bad: senderBad, testid: "sec-sender" },
      )}

      {showId && sec(
        w.secFooter,
        <>{footerSet ? w.sumFooterSet : w.sumFooterMissing} {mark(footerSet)}</>,
        <>
          <div data-setting-id="footerIdentity">
            {lab(`${uid}-footer`, w.footer, w.footerHint)}
            <textarea id={`${uid}-footer`} className="a-textarea" rows={2} maxLength={500} dir="auto" required aria-required="true" aria-invalid={!nameSet} aria-describedby={`${uid}-footer-h`} value={sender.footerIdentity} onChange={(e) => onChange((s) => void (s.footerIdentity = e.target.value))} />
            {note(`${uid}-footer-h`, false, w.footerHint)}
          </div>
          <div data-setting-id="identityEmail">
            {lab(`${uid}-idmail`, w.idEmail, w.idEmailHint)}
            <input id={`${uid}-idmail`} type="email" className="a-input min-h-[44px] w-full" dir="ltr" maxLength={254} autoComplete="off" required aria-required="true" aria-invalid={!emailSet} aria-describedby={`${uid}-idmail-h`} value={sender.identityEmail} onChange={(e) => onChange((s) => void (s.identityEmail = e.target.value))} />
            {note(`${uid}-idmail-h`, problems.identityEmail ? w.badAddress : "", w.idEmailHint)}
          </div>
          <div data-setting-id="identityPostal">
            {lab(`${uid}-idpostal`, w.idPostal, w.idPostalHint)}
            <input id={`${uid}-idpostal`} className="a-input min-h-[44px] w-full" dir="auto" maxLength={300} autoComplete="off" aria-describedby={`${uid}-idpostal-h`} value={sender.identityPostal} onChange={(e) => onChange((s) => void (s.identityPostal = e.target.value))} />
            {note(`${uid}-idpostal-h`, false, w.idPostalHint)}
          </div>
          {CONTACT_FIELDS.map(({ f, label: l, hint: h, type }) => (
            <div key={f} data-setting-id={f}>
              {lab(`${uid}-${f}`, w[l], w[h])}
              <input id={`${uid}-${f}`} type={type} className="a-input min-h-[44px] w-full" dir="ltr" maxLength={f === "identityPhone" ? 40 : 200} autoComplete="off" aria-invalid={Boolean(problems[f])} aria-describedby={`${uid}-${f}-h`} value={sender[f]} onChange={(e) => onChange((s) => void (s[f] = e.target.value))} />
              {note(`${uid}-${f}-h`, err(f), w[h])}
            </div>
          ))}
          <div className="a-box p-3" data-testid="footer-preview">
            <p className="a-label !mt-0">{w.footerPreview}</p>
            {contactLines(sender).length ? (
              <p className="whitespace-pre-wrap break-words text-sm" dir="auto">{contactLines(sender).map((l, i) => <span key={i} className="block"><bdi>{l}</bdi></span>)}</p>
            ) : (
              <p className={phone ? "text-sm text-clay" : "a-hint !mt-0"}>{w.footerPreviewEmpty}</p>
            )}
            {!phone && <p className="a-hint">{w.footerPreviewHint}</p>}
          </div>
          <fieldset className="min-w-0" data-testid="label-mode" data-setting-id="labelMode">
            <legend className="a-label">{w.labelHeading}</legend>
            {phone ? <InfoPopover label={w.labelHeading} text={w.labelHint} /> : <p className="a-hint !mt-0">{w.labelHint}</p>}
            {([["hebrew", w.labelHebrew], ["all", w.labelAll], ["off", w.labelOff]] as const).map(([m, label]) => (
              <label key={m} className="flex min-h-[44px] items-center gap-3 text-sm">
                <input type="radio" name={`${uid}-label`} className="h-5 w-5" value={m} checked={sender.labelMode === m} onChange={() => onChange((s) => void (s.labelMode = m))} />
                <span>{label}</span>
              </label>
            ))}
            {sender.labelMode === "off" && <p className="a-hint" role="status">{w.labelOffWarn}</p>}
          </fieldset>
        </>,
        { open: true, bad: !footerSet, testid: "sec-footer" },
      )}

      {showId && sec(
        w.secTests,
        <>{w.sumTests(sender.testRecipients.length)}</>,
        <div data-setting-id="testRecipients">
          {lab(`${uid}-tests`, w.test, w.testHint)}
          <textarea
            id={`${uid}-tests`} className="a-textarea" rows={3} dir="ltr" autoComplete="off" spellCheck={false} value={testText} aria-invalid={Boolean(problems.testRecipients)} aria-describedby={`${uid}-tests-h`}
            onChange={(e) => (setTests(e.target.value), onChange((s) => void (s.testRecipients = e.target.value.split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter(Boolean))))}
            onBlur={() => setTests(null)}
          />
          {note(`${uid}-tests-h`, err("testRecipients"), w.testHint)}
        </div>,
        { open: true, testid: "sec-tests" },
      )}

      {showLimits && sec(
        w.secLimits,
        <>{w.sumLimits(sender.throttlePerHour, sender.dailyCap, quietText)}, {w.sumPerPerson(sender.maxPerContact30d)}{sender.autoDraftCampaign ? `, ${w.sumAuto}` : ""} {mark(!limitsBad)}</>,
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {num("throttlePerHour", w.throttle, w.throttleHint, 3600)}
            {num("dailyCap", w.cap, w.capHint, 10000)}
            {num("maxPerContact30d", w.perPerson, w.perPersonHint, 31, 0)}
            {num("pendingTtlDays", w.pendingTtl, w.pendingTtlHint, 30, 2)}
          </div>
          {check("warmup", w.warmup, w.warmupHint, sender.warmup !== false, (v) => onChange((s) => void (s.warmup = v)))}
          <fieldset className="space-y-2" data-setting-id="quietHours">
            <legend className="a-label">{w.quiet}</legend>
            {check("quiet", w.quietOn, w.quietHint, Boolean(q), (v) => onChange((s) => (v ? void (s.quietHours = { from: "22:00", to: "07:00", tz: "Asia/Jerusalem" }) : void delete s.quietHours)))}
            {q && (
              <div className="flex flex-wrap items-end gap-3 ps-8">
                <div>
                  <label className="a-label" htmlFor={`${uid}-qf`}>{w.quietFrom}</label>
                  <input id={`${uid}-qf`} type="time" className="a-input min-h-[44px]" dir="ltr" value={q.from} onChange={(e) => onChange((s) => void (s.quietHours!.from = e.target.value))} />
                </div>
                <div>
                  <label className="a-label" htmlFor={`${uid}-qt`}>{w.quietTo}</label>
                  <input id={`${uid}-qt`} type="time" className="a-input min-h-[44px]" dir="ltr" value={q.to} onChange={(e) => onChange((s) => void (s.quietHours!.to = e.target.value))} />
                </div>
                <div>
                  <label className="a-label" htmlFor={`${uid}-qz`}>{w.quietZone}</label>
                  <input id={`${uid}-qz`} className="a-input min-h-[44px]" dir="ltr" autoComplete="off" list={`${uid}-zones`} value={q.tz} aria-invalid={Boolean(problems.quietHours)} onChange={(e) => onChange((s) => void (s.quietHours!.tz = e.target.value))} />
                  <datalist id={`${uid}-zones`}>{["Asia/Jerusalem", "UTC", "Europe/London", "America/New_York"].map((z) => <option key={z} value={z} />)}</datalist>
                  {note(`${uid}-qz-h`, err("quietHours"), w.quietZoneHint)}
                </div>
              </div>
            )}
          </fieldset>
          {check("autoDraft", w.autoDraft, w.autoDraftHint, sender.autoDraftCampaign, (v) => onChange((s) => void (s.autoDraftCampaign = v)), DEFAULT_SENDER.autoDraftCampaign)}
        </>,
        { bad: limitsBad, testid: "sec-limits" },
      )}

      {showLimits && sec(
        bw.secBudget,
        <>{bw.sumBudget(sender.dailyLimit, sender.monthlyLimit)}</>,
        <>
          {phone ? <InfoPopover label={bw.secBudget} text={bw.intro} /> : <p className="a-hint !mt-0">{bw.intro}</p>}
          <BudgetMeter phone={phone} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {num("dailyLimit", bw.dailyLimit, bw.dailyLimitHint, 100000)}
            {num("monthlyLimit", bw.monthlyLimit, bw.monthlyLimitHint, 1000000)}
            {pct("safety", bw.safety, bw.safetyHint, 50, 100)}
            {pct("reserveShare", bw.reserve, bw.reserveHint, 0, 50)}
          </div>
        </>,
        { open: true, bad: Boolean(problems.dailyLimit || problems.monthlyLimit || problems.safety || problems.reserveShare), testid: "sec-budget" },
      )}

      {showTexts && sec(
        w.secTexts,
        <>{textsBad ? w.sumTextsBad : w.sumTexts} {mark(!textsBad)}</>,
        <>
          {phone ? <InfoPopover label={w.secTexts} text={w.textsHint} /> : <p className="a-hint !mt-0">{w.textsHint}</p>}
          {tpl("confirmSubjectEn", w.confirmSubjectEn, 1)}
          {tpl("confirmBodyEn", w.confirmBodyEn, 7)}
          {tpl("unsubscribeNoteEn", w.unsubEn, 2)}
          {tpl("confirmSubjectHe", w.confirmSubjectHe, 1)}
          {tpl("confirmBodyHe", w.confirmBodyHe, 7)}
          {tpl("unsubscribeNoteHe", w.unsubHe, 2)}
        </>,
        { open: textsBad, bad: textsBad, testid: "sec-texts" },
      )}
    </section>
  );
}
