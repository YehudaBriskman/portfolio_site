import { useId, useMemo, useState } from "react";
import { Modal } from "@/components/admin/MediaGrid";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Disclosure } from "@/components/ui/Disclosure";
import { usePhone } from "@/hooks/usePhone";
import type { PostContent } from "@/services/admin";
import { changedFields, counts, diffLines } from "./diff";
import DiffView from "./DiffView";
import type { EditorWords } from "./words";
import styles from "./NoteEditor.module.css";

/*
 * Publish is a decision, so it is made looking at what it changes (#250):
 * every field that differs from the published note, a line diff of the body,
 * and a one-line "what changed" for readers, which the reader shows beside
 * the Updated date.
 *
 * On a phone (under 600px) it is a sheet that answers one question first,
 * "what changes": one sentence, then the body's diff, and the field list and
 * the reader note and scope behind closed Disclosures. The controls and the
 * Publish rules are the same ones; only the order and the surface differ.
 */


function show(v: unknown, empty: string): string {
  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return empty;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(", ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== null && x !== "" && x !== false)
      .map(([k, x]) => `${k}: ${typeof x === "string" && x.length > 80 ? `${x.slice(0, 80)}…` : String(x)}`)
      .join("; ") || empty;
  }
  return String(v);
}

/* One language or both (#305): the server keeps the other one as it is live. */
export type PublishScope = "both" | "en" | "he";
const SCOPES: readonly PublishScope[] = ["both", "en", "he"];

export default function ReviewDialog({
  open,
  onClose,
  published,
  next,
  words,
  busy,
  error,
  onPublish,
}: {
  open: boolean;
  onClose: () => void;
  /** The note as readers see it now; null on a first publish. */
  published: PostContent | null;
  next: PostContent;
  words: EditorWords;
  busy: boolean;
  error: string | null;
  onPublish: (changeNote: string, scope: PublishScope) => void;
}) {
  const [note, setNote] = useState("");
  const [scope, setScope] = useState<PublishScope>("both");
  const noteId = useId();
  const helpId = useId();
  const phone = usePhone();
  const fields = useMemo(() => (published ? changedFields(published, next) : []), [published, next]);
  const lines = useMemo(() => (published ? diffLines(published.body, next.body) : null), [published, next.body]);
  const tally = lines ? counts(lines) : null;
  const bodyChanged = published ? published.body !== next.body : true;
  const nothing = published !== null && !bodyChanged && fields.length === 0;

  const buttons = (
    <>
      <button type="button" className="a-btn" onClick={onClose}>
        {words.cancel}
      </button>
      <button
        type="button"
        className="a-btn a-btn-primary"
        disabled={busy}
        onClick={() => onPublish(note.trim(), published ? scope : "both")}
      >
        {busy ? words.publishing : words.publish}
      </button>
    </>
  );

  const fieldList = (
    <ul className={styles.changes}>
      {fields.map((k) => (
        <li key={k} className={styles.change}>
          <span className={styles.changeName}>{words.fieldNames[k] ?? k}</span>
          <span className={styles.changeValue}>
            <span className="sr-only">{`${words.removed}: `}</span>
            <span className="text-clay line-through">{show(published?.[k], words.empty)}</span>
            {" → "}
            <span className="sr-only">{`${words.added}: `}</span>
            <span>{show(next[k], words.empty)}</span>
          </span>
        </li>
      ))}
    </ul>
  );

  const bodyDiff = published && bodyChanged && (
    <section aria-labelledby={`${noteId}-b`}>
      <h3 id={`${noteId}-b`} className="a-label">
        {tally && !phone ? words.bodyChanges(tally.added, tally.removed) : words.body}
      </h3>
      {lines ? <DiffView lines={lines} words={words} labelledBy={`${noteId}-b`} /> : <p className="text-sm text-clay">{words.tooLong}</p>}
    </section>
  );

  const noteField = published && (
    <div>
      <label className="a-label" htmlFor={noteId}>
        {words.whatChanged}
      </label>
      <input id={noteId} className="a-input" value={note} maxLength={200} aria-describedby={helpId} onChange={(e) => setNote(e.target.value)} />
      <span id={helpId} className="a-hint">
        {words.whatChangedHelp}
      </span>
    </div>
  );

  const scopeField = published && (
    <fieldset>
      <legend className="a-label">{words.publishWhat}</legend>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {SCOPES.map((v) => (
          <label key={v} className={`flex items-center gap-2 text-sm${phone ? " min-h-[44px]" : ""}`}>
            <input type="radio" name={`${noteId}-scope`} value={v} checked={scope === v} onChange={() => setScope(v)} />
            {v === "both" ? words.scopeBoth : v === "en" ? words.scopeEn : words.scopeHe}
          </label>
        ))}
      </div>
      {scope !== "both" && <p className="a-hint">{scope === "en" ? words.scopeEnHelp : words.scopeHeHelp}</p>}
    </fieldset>
  );

  const errorLine = error && (
    <p role="alert" className="text-sm text-[rgb(var(--destructive-ink))]">
      {error}
    </p>
  );

  if (phone) {
    const summary =
      published === null
        ? words.reviewFirstSummary
        : nothing
          ? words.noChanges
          : [bodyChanged && tally ? words.bodyChanges(tally.added, tally.removed) : "", fields.length > 0 ? words.otherFields(fields.length) : ""]
              .filter(Boolean)
              .join(". ");
    return (
      <BottomSheet open={open} onClose={onClose} title={words.reviewTitle} snap="full" snaps={["half", "full"]} footer={<div className="flex gap-2">{buttons}</div>}>
        <div className={styles.review}>
          <p data-review-summary="" className="text-sm font-semibold">
            {summary}
          </p>
          {errorLine}
          {bodyDiff}
          {fields.length > 0 && (
            <Disclosure className="a-box" summary={words.fieldsChanged} meta={<span className="tabular-nums">{fields.length}</span>}>
              {fieldList}
            </Disclosure>
          )}
          {published && (
            <Disclosure className="a-box" summary={words.reviewOptions} meta={scope === "both" ? undefined : scope === "en" ? words.scopeEn : words.scopeHe}>
              <div className="space-y-4">
                {noteField}
                {scopeField}
              </div>
            </Disclosure>
          )}
        </div>
      </BottomSheet>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={words.reviewTitle} footer={buttons}>
      <div className={styles.review}>
        {published === null ? (
          <p className="text-sm text-bone">{words.firstPublish}</p>
        ) : nothing ? (
          <p className="text-sm text-bone">{words.noChanges}</p>
        ) : null}

        {fields.length > 0 && (
          <section aria-labelledby={`${noteId}-f`}>
            <h3 id={`${noteId}-f`} className="a-label">
              {words.fieldsChanged}
            </h3>
            {fieldList}
          </section>
        )}

        {bodyDiff}
        {noteField}
        {scopeField}
        {errorLine}
      </div>
    </Modal>
  );
}
