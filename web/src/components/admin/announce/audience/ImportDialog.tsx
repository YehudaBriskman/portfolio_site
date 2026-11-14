import { useId, useMemo, useState, type FormEvent } from "react";
import { adminAudience, type Group, type ImportResult } from "@/services/adminAudience";
import { BottomSheet } from "@/components/ui/BottomSheet";
import Email from "./Email";
import Modal from "./Modal";
import { FOOTER } from "./modalFooter";
import { previewCsv } from "./csv";
import { useAudienceWords } from "./words";

// The server refuses a csv longer than this many characters.
const MAX_CHARS = 900_000;
const SHOWN = 5;

/* `sheet` is the phone layout: the same form and the same consent rule in a bottom sheet, the actions in its footer. */
export default function ImportDialog({ groups, onClose, onDone, sheet = false }: { groups: Group[]; onClose: () => void; onDone: () => void; sheet?: boolean }) {
  const w = useAudienceWords();
  const uid = useId();
  const formId = `${uid}-form`;
  const [csv, setCsv] = useState("");
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState("");
  const [group, setGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const rows = useMemo(() => previewCsv(csv), [csv]);
  const ok = rows.filter((r) => r.valid).length;
  const tooBig = csv.length > MAX_CHARS;
  const ready = consent && note.trim().length >= 3 && ok > 0 && !tooBig && !busy;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_CHARS) return setError(w.importTooBig);
    setError(null);
    setCsv(await f.text());
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await adminAudience.importCsv({ csv, consentNote: note.trim(), consentConfirmed: true, ...(group ? { group } : {}) }));
      onDone();
    } catch {
      setError(w.saveFailed);
    }
    setBusy(false);
  };

  const fields = (
    <>
      <p className="a-hint !mt-0">{w.importHint}</p>
      <div>
        <label className="a-label" htmlFor={`${uid}-f`}>{w.chooseFile}</label>
        <input id={`${uid}-f`} type="file" accept=".csv,text/csv,text/plain" className="a-input min-h-[44px]" onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
      <div>
        <label className="a-label" htmlFor={`${uid}-t`}>{w.orPaste}</label>
        <textarea id={`${uid}-t`} className="a-textarea font-mono text-sm" dir="ltr" rows={4} aria-label={w.csvLabel} value={csv} onChange={(e) => setCsv(e.target.value)} />
      </div>

      <section aria-labelledby={`${uid}-p`} className="a-box p-3">
        <h4 id={`${uid}-p`} className="a-label">{w.previewHeading}</h4>
        {rows.length === 0 ? (
          <p className="a-hint !mt-0">{w.previewEmpty}</p>
        ) : (
          <>
            <p className="text-sm tabular-nums" role="status">{w.previewCount(ok, rows.length - ok)}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {rows.slice(0, SHOWN).map((r, i) => (
                <li key={i} className="flex flex-wrap gap-x-3">
                  <span className="min-w-0"><Email value={r.email} /></span>
                  <span className="text-clay" dir="auto">{r.name}</span>
                  {!r.valid && <span className="a-error !mt-0">{w.rowInvalid}</span>}
                </li>
              ))}
            </ul>
            {rows.length > SHOWN && <p className="a-hint">{w.previewMore(rows.length - SHOWN)}</p>}
          </>
        )}
      </section>

      {groups.length > 0 && (
        <div>
          <label className="a-label" htmlFor={`${uid}-g`}>{w.importGroup}</label>
          <select id={`${uid}-g`} className="a-select min-h-[44px]" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">{w.importNoGroup}</option>
            {groups.filter((g) => g.kind === "manual").map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="a-label" htmlFor={`${uid}-n`}>{w.importConsentNote} <span className="text-clay">({w.required})</span></label>
        <textarea id={`${uid}-n`} className="a-textarea" rows={2} dir="auto" maxLength={500} aria-describedby={`${uid}-nh`} value={note} onChange={(e) => setNote(e.target.value)} />
        <p id={`${uid}-nh`} className="a-hint">{w.importConsentNoteHint}</p>
      </div>
      <label className="flex min-h-[44px] items-start gap-2 text-sm font-bold">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{w.importConsent}</span>
      </label>

      {(tooBig || error) && <p className="a-error" role="alert">{tooBig ? w.importTooBig : error}</p>}
    </>
  );
  const footer = result ? (
    <button type="button" className="a-btn a-btn-primary min-h-[44px]" onClick={onClose}>{w.close}</button>
  ) : (
    <>
      <button type="submit" form={formId} className="a-btn a-btn-primary min-h-[44px]" disabled={!ready}>{busy ? w.importing : w.importRun}</button>
      <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={onClose}>{w.cancel}</button>
    </>
  );
  const onSubmit = (e: FormEvent) => (e.preventDefault(), ready && void run());
  const summary = result && (
    <div className="space-y-3">
      <p className="text-sm font-bold" role="status">{w.importDone(result.added, result.skipped)}</p>
      {result.invalid.length > 0 && (
        <div>
          <p className="a-hint !mt-0">{w.importInvalid(result.invalid.length)}</p>
          <ul className="list-disc ps-5 text-sm">
            {result.invalid.slice(0, 10).map((r, i) => <li key={i} dir="auto">{typeof r === "string" ? r : [r.row, r.value, r.reason].filter(Boolean).join(" · ")}</li>)}
          </ul>
        </div>
      )}
    </div>
  );

  if (sheet) {
    return (
      <BottomSheet open onClose={onClose} title={w.importHeading} snap="full" footer={<div className="flex flex-wrap gap-2">{footer}</div>}>
        {result ? summary : <form id={formId} className="space-y-4" onSubmit={onSubmit}>{fields}</form>}
      </BottomSheet>
    );
  }
  return (
    <Modal title={w.importHeading} titleId={`${uid}-h`} onClose={onClose}>
      {result ? (
        <div className="space-y-3">
          {summary}
          {footer}
        </div>
      ) : (
        <form id={formId} className="space-y-4" onSubmit={onSubmit}>
          {fields}
          <div data-modal-footer className={`${FOOTER} flex flex-wrap gap-2`}>
            {footer}
          </div>
        </form>
      )}
    </Modal>
  );
}
