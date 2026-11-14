import { useId, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Disclosure } from "@/components/ui/Disclosure";
import { StatusGlyph, type StatusKind } from "@/components/ui/StatusGlyph";
import { adminAudience, CONTACT_STATUSES, type Contact, type ContactLang, type ContactStatus, type Group } from "@/services/adminAudience";
import ConsentHistory from "./ConsentHistory";
import { Why } from "./ContactEditor";
import Email from "./Email";
import { whyOf } from "./why";
import { useAudienceWords } from "./words";
import { useWhen } from "./useWhen";

/* The status is drawn only where the person is not mailable: a mailable one is the normal case (the sentence says so once), and "active with every topic off" is told by the sentence alone. */
const GLYPH: Record<ReturnType<typeof whyOf>["key"], StatusKind | null> = {
  active: null,
  activeNoTopics: null,
  pending: "pending",
  unsubscribed: "unsubscribed",
  suppressed: "suppressed",
};

/*
 * One contact on a phone. What decides whether they get mail comes first: the status and why, then the consent on
 * record. Everything that edits them waits in closed sections, and Save is in the sheet's footer. The fields, the
 * payload and the erasure are those of ContactEditor.
 */
export default function ContactSheet({ contact, groups, onClose, onDone }: { contact: Contact; groups: Group[]; onClose: () => void; onDone: () => void }) {
  const w = useAudienceWords();
  const uid = useId();
  const formId = `${uid}-form`;
  const when = useWhen();
  const [name, setName] = useState(contact.name ?? "");
  const [lang, setLang] = useState<ContactLang>(contact.lang ?? "en");
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [sel, setSel] = useState<string[]>(contact.groups);
  const [topics, setTopics] = useState(contact.topics);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const run = async (op: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await op();
      onDone();
    } catch {
      setError(true);
      setBusy(false);
    }
  };
  const save = () => run(() => adminAudience.patchContact(contact.hash, { name: name.trim(), lang, groups: sel, topics, status }));
  const toggle = (slug: string) => setSel((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  const live = { ...contact, status, topics };
  const key = whyOf(live).key;
  const glyph = GLYPH[key];
  const last = contact.consentHistory?.length ? contact.consentHistory[contact.consentHistory.length - 1] : null;
  const consent = w.summaryConsent(
    when(last?.at ?? contact.consentAt),
    w.sources[last?.source ?? contact.source] ?? contact.source,
    last ? (last.confirmedAt ? w.consentConfirmedOn(when(last.confirmedAt)) : w.consentNotConfirmed) : "",
  );

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={contact.name || w.editorHeading}
      footer={
        <button type="submit" form={formId} className="a-btn a-btn-primary min-h-[44px]" disabled={busy}>
          {busy ? w.saving : w.save}
        </button>
      }
    >
      <form id={formId} className="space-y-3" onSubmit={(e) => (e.preventDefault(), void save())}>
        <p className="text-sm"><Email value={contact.email} /></p>

        <div className="a-box space-y-2 p-3 text-sm" role="status">
          {glyph && <StatusGlyph kind={glyph} size={20} withWord />}
          <p><Why c={live} /></p>
          <p className="a-hint !mt-0"><span className="font-bold">{w.consentHeading}:</span> {consent}</p>
        </div>

        <Disclosure className="a-box" summary={w.detailsHeading}>
          <div className="grid gap-3">
            <div>
              <label className="a-label" htmlFor={`${uid}-n`}>{w.name}</label>
              <input id={`${uid}-n`} className="a-input min-h-[44px]" dir="auto" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="a-label" htmlFor={`${uid}-l`}>{w.language}</label>
              <select id={`${uid}-l`} className="a-select min-h-[44px] w-full" value={lang} onChange={(e) => setLang(e.target.value as ContactLang)}>
                {(["en", "he"] as const).map((l) => <option key={l} value={l}>{w.langs[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="a-label" htmlFor={`${uid}-s`}>{w.statusLabel}</label>
              <select id={`${uid}-s`} className="a-select min-h-[44px] w-full" value={status} aria-describedby={`${uid}-sh`} onChange={(e) => setStatus(e.target.value as ContactStatus)}>
                {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{w.statuses[s]}</option>)}
              </select>
              <p id={`${uid}-sh`} className="a-hint">{w.statusHint}</p>
            </div>
          </div>
        </Disclosure>

        <Disclosure className="a-box" summary={w.topicsAndGroups}>
          <fieldset className="space-y-1">
            <legend className="a-label">{w.topicsLabel}</legend>
            {(["blog", "releases"] as const).map((t) => (
              <label key={t} className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={topics[t]} onChange={(e) => setTopics({ ...topics, [t]: e.target.checked })} />
                <span>{w.topics[t]}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="mt-3 space-y-1">
            <legend className="a-label">{w.groupsLabel}</legend>
            {groups.length === 0 && <p className="a-hint">{w.noGroups}</p>}
            {groups.map((g) => (
              <label key={g.slug} className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={sel.includes(g.slug)} onChange={() => toggle(g.slug)} />
                <span dir="auto">{g.name}</span>
              </label>
            ))}
          </fieldset>
        </Disclosure>

        <Disclosure className="a-box" summary={w.consentHistory}>
          <ConsentHistory contact={contact} heading={false} className="space-y-1 text-sm" />
        </Disclosure>

        <Disclosure className="a-box" summary={w.erase}>
          <p className="a-hint !mt-0">{w.eraseHint}</p>
          {confirm ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="a-btn min-h-[44px] !border-[rgb(var(--destructive-ink))] text-[rgb(var(--destructive-ink))]" disabled={busy} onClick={() => void run(() => adminAudience.eraseContact(contact.hash))}>{w.eraseConfirm(contact.email)}</button>
              <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => setConfirm(false)}>{w.cancel}</button>
            </div>
          ) : (
            <button type="button" className="a-btn a-btn-ghost mt-2 min-h-[44px] text-[rgb(var(--destructive-ink))]" onClick={() => setConfirm(true)}>{w.erase}</button>
          )}
        </Disclosure>

        {error && <p className="a-error" role="alert">{w.saveFailed}</p>}
      </form>
    </BottomSheet>
  );
}
