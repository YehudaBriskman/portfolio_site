import { useId, useState } from "react";
import { adminAudience, type ContactLang, type Group } from "@/services/adminAudience";
import Modal from "./Modal";
import { useAudienceWords } from "./words";

export default function AddContact({ groups, onClose, onDone }: { groups: Group[]; onClose: () => void; onDone: () => void }) {
  const w = useAudienceWords();
  const uid = useId();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState<ContactLang>("en");
  const [sel, setSel] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [tried, setTried] = useState(false);

  const submit = async () => {
    setTried(true);
    if (!email.trim() || !note.trim()) return;
    setBusy(true);
    setError(false);
    try {
      await adminAudience.addContact({ email: email.trim(), name: name.trim() || undefined, lang, groups: sel, consentNote: note.trim() });
      onDone();
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <Modal title={w.addHeading} titleId={`${uid}-h`} onClose={onClose}>
      <form className="space-y-4" noValidate onSubmit={(e) => (e.preventDefault(), void submit())}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="a-label" htmlFor={`${uid}-e`}>{w.addEmail}</label>
            <input id={`${uid}-e`} type="email" dir="ltr" autoComplete="off" required aria-invalid={tried && !email.trim()} className="a-input min-h-[44px] text-start" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="a-label" htmlFor={`${uid}-n`}>{w.name}</label>
            <input id={`${uid}-n`} className="a-input min-h-[44px]" dir="auto" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="a-label" htmlFor={`${uid}-l`}>{w.language}</label>
            <select id={`${uid}-l`} className="a-select min-h-[44px]" value={lang} onChange={(e) => setLang(e.target.value as ContactLang)}>
              {(["en", "he"] as const).map((l) => <option key={l} value={l}>{w.langs[l]}</option>)}
            </select>
          </div>
        </div>
        {groups.length > 0 && (
          <fieldset className="space-y-1">
            <legend className="a-label">{w.groupsLabel}</legend>
            {groups.map((g) => (
              <label key={g.slug} className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={sel.includes(g.slug)} onChange={() => setSel((s) => (s.includes(g.slug) ? s.filter((x) => x !== g.slug) : [...s, g.slug]))} />
                <span dir="auto">{g.name}</span>
              </label>
            ))}
          </fieldset>
        )}
        <div>
          <label className="a-label" htmlFor={`${uid}-c`}>{w.consentNote} <span className="text-clay">({w.required})</span></label>
          <textarea id={`${uid}-c`} className="a-textarea" rows={3} dir="auto" required maxLength={500} aria-invalid={tried && !note.trim()} aria-describedby={`${uid}-ch`} value={note} onChange={(e) => setNote(e.target.value)} />
          <p id={`${uid}-ch`} className={tried && !note.trim() ? "a-error" : "a-hint"}>{tried && !note.trim() ? w.consentNoteRequired : w.consentNoteHint}</p>
        </div>
        {error && <p className="a-error" role="alert">{w.saveFailed}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="a-btn a-btn-primary min-h-[44px]" disabled={busy}>{busy ? w.saving : w.add}</button>
          <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={onClose}>{w.cancel}</button>
        </div>
      </form>
    </Modal>
  );
}
