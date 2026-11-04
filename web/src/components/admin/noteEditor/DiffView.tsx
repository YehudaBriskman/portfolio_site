import { hunks, type DiffLine } from "./diff";
import type { EditorWords } from "./words";
import styles from "./NoteEditor.module.css";

/*
 * A line diff, as the publish review shows it (#250) and the stale-Hebrew
 * notice reuses it (#305): unchanged runs folded, each changed line an
 * <ins> or <del> with its kind said aloud, not only coloured.
 */
export default function DiffView({ lines, words, labelledBy }: { lines: DiffLine[]; words: EditorWords; labelledBy: string }) {
  return (
    <div className={styles.diff} role="group" aria-labelledby={labelledBy} tabIndex={0}>
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
                  {l.text || " "}
                </span>
              </Tag>
            );
          })
        ),
      )}
    </div>
  );
}
