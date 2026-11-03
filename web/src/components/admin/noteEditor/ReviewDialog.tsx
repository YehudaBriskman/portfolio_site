import { useId, useMemo, useState } from "react";
import { Modal } from "@/components/admin/MediaGrid";
import type { PostContent } from "@/services/admin";
import { changedFields, counts, diffLines, hunks } from "./diff";
import type { EditorWords } from "./words";
import styles from "./NoteEditor.module.css";

/*
 * Publish is a decision, so it is made looking at what it changes (#250):
 * every field that differs from the published note, a line diff of the body,
 * and a one-line "what changed" for readers, which the reader shows beside
 * the Updated date.
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
  onPublish: (changeNote: string) => void;
}) {
  const [note, setNote] = useState("");
  const noteId = useId();
  const helpId = useId();
  const fields = useMemo(() => (published ? changedFields(published, next) : []), [published, next]);
  const lines = useMemo(() => (published ? diffLines(published.body, next.body) : null), [published, next.body]);
  const tally = lines ? counts(lines) : null;
  const bodyChanged = published ? published.body !== next.body : true;
  const nothing = published !== null && !bodyChanged && fields.length === 0;

  return (
    <Modal open={open} onClose={onClose} title={words.reviewTitle}>
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
          </section>
        )}

        {published && bodyChanged && (
          <section aria-labelledby={`${noteId}-b`}>
            <h3 id={`${noteId}-b`} className="a-label">
              {tally ? words.bodyChanges(tally.added, tally.removed) : words.body}
            </h3>
            {lines ? (
              <div className={styles.diff} role="group" aria-labelledby={`${noteId}-b`} tabIndex={0}>
                {hunks(lines).map((h, i) =>
                  h.kind === "skip" ? (
                    <div key={i} className={styles.skip}>
                      {words.skipped(h.count)}
                    </div>
                  ) : (
                    h.lines.map((l, j) => {
                      const Tag = l.kind === "add" ? "ins" : l.kind === "del" ? "del" : "div";
                      return (
                        <Tag key={`${i}-${j}`} className={styles.line} data-kind={l.kind}>
                          <span aria-hidden="true">{l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}</span>
                          <span>
                            {l.kind !== "same" && <span className="sr-only">{`${l.kind === "add" ? words.added : words.removed}: `}</span>}
                            {l.text || " "}
                          </span>
                        </Tag>
                      );
                    })
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-clay">{words.tooLong}</p>
            )}
          </section>
        )}

        {published && (
          <div>
            <label className="a-label" htmlFor={noteId}>
              {words.whatChanged}
            </label>
            <input
              id={noteId}
              className="a-input"
              value={note}
              maxLength={200}
              aria-describedby={helpId}
              onChange={(e) => setNote(e.target.value)}
            />
            <span id={helpId} className="a-hint">
              {words.whatChangedHelp}
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-[rgb(var(--destructive-ink))]">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="a-btn" onClick={onClose}>
            {words.cancel}
          </button>
          <button
            type="button"
            className="a-btn a-btn-primary"
            disabled={busy}
            onClick={() => onPublish(note.trim())}
          >
            {busy ? words.publishing : words.publish}
          </button>
        </div>
      </div>
    </Modal>
  );
}
