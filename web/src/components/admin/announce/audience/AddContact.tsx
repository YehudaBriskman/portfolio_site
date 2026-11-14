import { useId, useState, type FormEvent } from "react";
import { adminAudience, type ContactLang, type Group } from "@/services/adminAudience";
import { BottomSheet } from "@/components/ui/BottomSheet";
import Modal from "./Modal";
import { FOOTER } from "./modalFooter";
import { useAudienceWords } from "./words";

/* `sheet` is the phone layout: the same form and the same rules in a bottom sheet, the actions in its footer. */
export default function AddContact({ groups, onClose, onDone, sheet = false }: { groups: Group[]; onClose: () => void; onDone: () => void; sheet?: boolean }) {
  const w = useAudienceWords();
  const uid = useId();
  const formId = `${uid}-form`;
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

  const fields = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="a-label" htmlFor={`${uid}-e`}>{w.addEmail}</label>
          <input id={`${uid}-e`} type="email" dir="ltr" autoComplete="off" required aria-invalid={tried && !email.trim()} className="a-input min-h-[44px] text-start" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
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
    </>
  );
  const footer = (
    <>
      <button type="submit" form={formId} className="a-btn a-btn-primary min-h-[44px]" disabled={busy}>{busy ? w.saving : w.add}</button>
      <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={onClose}>{w.cancel}</button>
    </>
  );
  const onSubmit = (e: FormEvent) => (e.preventDefault(), void submit());

  if (sheet) {
    return (
      <BottomSheet open onClose={onClose} title={w.addHeading} snap="full" footer={<div className="flex flex-wrap gap-2">{footer}</div>}>
        <form id={formId} className="space-y-4" noValidate onSubmit={onSubmit}>
          {fields}
        </form>
      </BottomSheet>
    );
  }
  return (
    <Modal title={w.addHeading} titleId={`${uid}-h`} onClose={onClose}>
      <form id={formId} className="space-y-4" noValidate onSubmit={onSubmit}>
        {fields}
        <div data-modal-footer className={`${FOOTER} flex flex-wrap gap-2`}>
          {footer}
        </div>
      </form>
    </Modal>
  );
}
