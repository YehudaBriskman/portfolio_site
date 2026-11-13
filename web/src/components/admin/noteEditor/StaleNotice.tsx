import { useId, useMemo, useState } from "react";
import { DisclosureButton } from "@/components/ui/Disclosure";
import { ackTranslation, type TranslationStatus } from "@/services/translations";
import { diffLines } from "./diff";
import DiffView from "./DiffView";
import type { EditorWords } from "./words";
import styles from "./NoteEditor.module.css";

/*
 * Stale Hebrew, said where it is edited (#305, design §7.1): one line per
 * field whose English changed since its Hebrew was written. The body's line
 * can show what changed, a diff from the English the Hebrew was written
 * against (`heMeta.bodyBase`, kept since #303) to the English now. Each line
 * can be acknowledged, "Hebrew still correct", which restamps that field
 * with no change to any text (#303's ack). Stale Hebrew stays live meanwhile.
 *
 * The acknowledgement names the stored revision, so it waits for unsaved
 * edits to be saved: acknowledging against text the server has not seen
 * would be a promise about something else.
 */

type Field = "title" | "subtitle" | "excerpt" | "body";
const FIELDS: readonly Field[] = ["title", "subtitle", "excerpt", "body"];

export default function StaleNotice({
  statuses,
  base,
  english,
  words,
  disabled,
  slug,
  rev,
  onAcked,
}: {
  statuses: Record<Field, TranslationStatus | null>;
  /** The English body the Hebrew body was written against, when recorded. */
  base: string | null;
  english: string;
  words: EditorWords;
  disabled: boolean;
  slug: string;
  rev: string;
  onAcked: () => Promise<void>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Field | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const stale = FIELDS.filter((f) => statuses[f] === "stale");
  const lines = useMemo(() => (open && base !== null ? diffLines(base, english) : null), [open, base, english]);

  if (!stale.length && !message) return null;

  const ack = async (path: Field) => {
    setBusy(path);
    setMessage(null);
    try {
      await ackTranslation({ type: "post", id: slug, path, rev });
      await onAcked();
      setMessage({ text: words.stillCorrectDone });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "?", bad: true });
    } finally {
      setBusy(null);
    }
  };

  const label: Record<Field, string> = { title: words.title, subtitle: words.subtitle, excerpt: words.excerpt, body: words.body };

  return (
    <div className={`${styles.notice} mt-4 grid gap-3`} data-tone="stale">
      {stale.map((f) => (
        <div key={f} className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p id={`${id}-${f}`} className="min-w-0 flex-1">
            {f === "body" ? words.staleBody : words.staleField(label[f].toLowerCase())}
          </p>
          {f === "body" && (
            <DisclosureButton className="!w-auto" expanded={open} controls={`${id}-diff`} onToggle={() => setOpen((o) => !o)}>
              {open ? words.hideChanges : words.showChanges}
            </DisclosureButton>
          )}
          <button
            type="button"
            className="a-btn"
            disabled={disabled || busy !== null}
            aria-describedby={`${id}-${f}`}
            onClick={() => void ack(f)}
          >
            {words.stillCorrect}
          </button>
        </div>
      ))}
      {open && stale.includes("body") && (
        <div id={`${id}-diff`}>
          {base === null ? (
            <p className="text-sm text-clay">{words.noBase}</p>
          ) : lines ? (
            <DiffView lines={lines} words={words} labelledBy={`${id}-body`} />
          ) : (
            <p className="text-sm text-clay">{words.tooLong}</p>
          )}
        </div>
      )}
      {message && (
        <p role="status" className={message.bad ? "text-sm text-[rgb(var(--destructive-ink))]" : "text-sm"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
