import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { adminAudience, type ContactLang, type Group } from "@/services/adminAudience";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SidePanel, useUnsavedGuard } from "@/components/ui/SidePanel";
import type { GuardHook } from "./ContactEditor";
import { consentNoteOk, emailOk } from "./rules";
import { useAudienceWords } from "./words";

/*
 * `sheet` is the phone layout: the same form and the same rules in a bottom sheet, the actions in its footer.
 * Wide, it is a side panel (A21) that asks before it drops what was typed.
 */
export default function AddContact({ groups, onClose, onDone, sheet = false, open = true, onGuard }: { groups: Group[]; onClose: () => void; onDone: () => void; sheet?: boolean; open?: boolean; onGuard?: GuardHook }) {
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
  const [asking, setAsking] = useState(false);
  const answer = useRef<((go: boolean) => void) | null>(null);
  const dirty = email !== "" || name !== "" || note !== "" || lang !== "en" || sel.length > 0;
  const ask = () => new Promise<boolean>((resolve) => ((answer.current = resolve), setAsking(true)));
  const settle = (go: boolean) => (setAsking(false), answer.current?.(go), (answer.current = null));
  const guard = useUnsavedGuard(dirty && !busy, ask);
  useEffect(() => {
    if (!onGuard || sheet) return;
    onGuard(guard);
    return () => onGuard(null, guard);
  }, [onGuard, guard, sheet]);

  const submit = async () => {
    setTried(true);
    if (!emailOk(email) || !consentNoteOk(note)) return;
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="a-label" htmlFor={`${uid}-e`}>{w.addEmail}</label>
          <input id={`${uid}-e`} type="email" dir="ltr" autoComplete="off" required aria-invalid={tried && !emailOk(email)} aria-describedby={tried && !emailOk(email) ? `${uid}-eh` : undefined} className="a-input min-h-[44px] text-start" value={email} onChange={(e) => setEmail(e.target.value)} />
          {tried && !emailOk(email) && <p id={`${uid}-eh`} className="a-error">{w.rowInvalid}</p>}
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
        <textarea id={`${uid}-c`} className="a-textarea" rows={3} dir="auto" required maxLength={500} aria-invalid={tried && !consentNoteOk(note)} aria-describedby={`${uid}-ch`} value={note} onChange={(e) => setNote(e.target.value)} />
        <p id={`${uid}-ch`} className={tried && !consentNoteOk(note) ? "a-error" : "a-hint"}>{tried && !consentNoteOk(note) ? w.consentNoteRequired : w.consentNoteHint}</p>
      </div>
      {error && <p className="a-error" role="alert">{w.saveFailed}</p>}
    </>
  );
  const footer = (
    <>
      <button type="submit" form={formId} className="a-btn a-btn-primary min-h-[44px]" disabled={busy}>{busy ? w.saving : w.add}</button>
      <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={sheet ? onClose : () => void guard().then((ok) => ok && onClose())}>{w.cancel}</button>
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
    <>
      <SidePanel
        open={open}
        onOpenChange={(o) => !o && onClose()}
        beforeClose={guard}
        title={w.addHeading}
        footer={<div className="flex flex-wrap gap-2">{footer}</div>}
      >
        <form id={formId} className="space-y-4" noValidate onSubmit={onSubmit}>
          {fields}
        </form>
      </SidePanel>
      <ConfirmDialog open={asking} title={w.guardTitle} confirm={w.guardDiscard} cancel={w.guardKeep} tone="neutral" onConfirm={() => settle(true)} onCancel={() => settle(false)}>
        {w.guardBody}
      </ConfirmDialog>
    </>
  );
}
