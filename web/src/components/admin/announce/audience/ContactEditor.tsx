import { useId, useState } from "react";
import { adminAudience, CONTACT_STATUSES, type Contact, type ContactLang, type ContactStatus, type Group } from "@/services/adminAudience";
import ConsentHistory from "./ConsentHistory";
import Email from "./Email";
import Modal from "./Modal";
import { FOOTER } from "./modalFooter";
import { whyOf } from "./why";
import { useAudienceWords } from "./words";
import { useWhen } from "./useWhen";

export function Why({ c }: { c: Pick<Contact, "status" | "topics" | "unsubscribedAt"> }) {
  const w = useAudienceWords();
  const when = useWhen();
  const k = whyOf(c).key;
  const text = k === "unsubscribed" ? w.whyUnsubscribed(when(c.unsubscribedAt)) : k === "active" ? w.whyActive : k === "activeNoTopics" ? w.whyActiveNoTopics : k === "pending" ? w.whyPending : w.whySuppressed;
  return <span data-why={k}>{text}</span>;
}

/* One contact: name, language, groups, topics, status; and the erasure. */
export default function ContactEditor({ contact, groups, onClose, onDone }: { contact: Contact; groups: Group[]; onClose: () => void; onDone: () => void }) {
  const w = useAudienceWords();
  const uid = useId();
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

  return (
    <Modal title={w.editorHeading} titleId={`${uid}-h`} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), void save())}>
        <p className="text-sm"><Email value={contact.email} /></p>
        <p className="a-hint !mt-0" role="status"><Why c={live} /></p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="a-label" htmlFor={`${uid}-n`}>{w.name}</label>
            <input id={`${uid}-n`} className="a-input min-h-[44px]" dir="auto" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="a-label" htmlFor={`${uid}-l`}>{w.language}</label>
            <select id={`${uid}-l`} className="a-select min-h-[44px]" value={lang} onChange={(e) => setLang(e.target.value as ContactLang)}>
              {(["en", "he"] as const).map((l) => <option key={l} value={l}>{w.langs[l]}</option>)}
            </select>
          </div>
          <div>
            <label className="a-label" htmlFor={`${uid}-s`}>{w.statusLabel}</label>
            <select id={`${uid}-s`} className="a-select min-h-[44px]" value={status} aria-describedby={`${uid}-sh`} onChange={(e) => setStatus(e.target.value as ContactStatus)}>
              {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{w.statuses[s]}</option>)}
            </select>
            <p id={`${uid}-sh`} className="a-hint">{w.statusHint}</p>
          </div>
        </div>

        <fieldset className="space-y-1">
          <legend className="a-label">{w.topicsLabel}</legend>
          {(["blog", "releases"] as const).map((t) => (
            <label key={t} className="flex min-h-[44px] items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={topics[t]} onChange={(e) => setTopics({ ...topics, [t]: e.target.checked })} />
              <span>{w.topics[t]}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="a-label">{w.groupsLabel}</legend>
          {groups.length === 0 && <p className="a-hint">{w.noGroups}</p>}
          {groups.map((g) => (
            <label key={g.slug} className="flex min-h-[44px] items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={sel.includes(g.slug)} onChange={() => toggle(g.slug)} />
              <span dir="auto">{g.name}</span>
            </label>
          ))}
        </fieldset>

        <ConsentHistory contact={contact} />

        {error && <p className="a-error" role="alert">{w.saveFailed}</p>}
        <div data-modal-footer className={`${FOOTER} flex flex-wrap items-center gap-2`}>
          <button type="submit" className="a-btn a-btn-primary min-h-[44px]" disabled={busy}>{busy ? w.saving : w.save}</button>
          <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={onClose}>{w.cancel}</button>
        </div>

        <div className="border-t border-[rgb(var(--rule-firm)/.4)] pb-4 pt-3">
          <p className="a-hint !mt-0">{w.eraseHint}</p>
          {confirm ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="a-btn min-h-[44px] !border-[rgb(var(--destructive-ink))] text-[rgb(var(--destructive-ink))]" disabled={busy} onClick={() => void run(() => adminAudience.eraseContact(contact.hash))}>{w.eraseConfirm(contact.email)}</button>
              <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => setConfirm(false)}>{w.cancel}</button>
            </div>
          ) : (
            <button type="button" className="a-btn a-btn-ghost mt-2 min-h-[44px] text-[rgb(var(--destructive-ink))]" onClick={() => setConfirm(true)}>{w.erase}</button>
          )}
        </div>
      </form>
    </Modal>
  );
}
