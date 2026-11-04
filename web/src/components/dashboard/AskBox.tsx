import { useId, useRef, useState, type ReactNode } from "react";
import { Hash, AtSign, Search } from "lucide-react";
import styles from "@/components/dashboard/Dashboard.module.css";
import { complete, parseAsk, pendingSigil, suggest, type Asked, type AskOption } from "@/components/dashboard/ask";
import { useWords } from "@/components/dashboard/i18n";
import { typedDir } from "@/lib/typedDir";

/*
 * The search box, in the shape of GitHub's "Ask anything" box (#224): a tall
 * field with its controls along the bottom edge, and quick chips under it.
 *
 * `#` starts a topic and `@` an area (`ask.ts`). While one is being typed,
 * the matches are offered as buttons under the field, counted in a polite
 * live region; a press completes the word and puts the caret back. They are
 * buttons in the tab order rather than a combobox popup: a list of six
 * that a reader can Tab into is the smaller promise, and it is one this box
 * keeps on a phone keyboard too.
 *
 * Enter searches. What the search means is the caller's (on Blogs it is the
 * Feed view with `q`, `tag` and `collection` in the URL), so the box knows
 * nothing about routes.
 */

export default function AskBox({
  topics,
  areas,
  initial = "",
  onAsk,
  children,
}: {
  topics: AskOption[];
  areas: AskOption[];
  initial?: string;
  onAsk: (asked: Asked) => void;
  /** Under the box: the quick chips. */
  children?: ReactNode;
}) {
  const [t] = useWords();
  const [text, setText] = useState(initial);
  const input = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const hintId = useId();
  const offers = suggest(text, topics, areas);
  const pending = pendingSigil(text);

  const submit = () => onAsk(parseAsk(text, topics, areas));

  return (
    <div className={styles.ask}>
      <form
        role="search"
        className={styles.askBox}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={id} className="sr-only">
          {t.askLabel}
        </label>
        <textarea
          ref={input}
          id={id}
          name="q"
          rows={2}
          value={text}
          placeholder={t.askPlaceholder}
          aria-describedby={hintId}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          dir={typedDir(text)}
          className={styles.askInput}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            /* One line of query, so Enter is search; Shift+Enter is not
               offered, there is nothing to break a line for. */
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className={styles.askTools}>
          <button
            type="button"
            className={styles.askTool}
            onClick={() => {
              setText((v) => `${v}${v && !v.endsWith(" ") ? " " : ""}#`);
              input.current?.focus();
            }}
          >
            <Hash size={14} aria-hidden="true" />
            {t.quickTopics}
          </button>
          <button
            type="button"
            className={styles.askTool}
            onClick={() => {
              setText((v) => `${v}${v && !v.endsWith(" ") ? " " : ""}@`);
              input.current?.focus();
            }}
          >
            <AtSign size={14} aria-hidden="true" />
            {t.areaPage}
          </button>
          <span id={hintId} className={styles.askHint}>
            {t.askHint}
          </span>
          <button type="submit" className={styles.askSubmit} aria-label={t.askSubmit}>
            <Search size={16} aria-hidden="true" />
          </button>
        </div>
      </form>

      <div aria-live="polite" className="sr-only">
        {pending ? `${offers.length} ${t.suggestions}` : ""}
      </div>
      {offers.length > 0 && (
        <ul className={styles.offers} aria-label={t.suggestions}>
          {offers.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className={styles.offer}
                onClick={() => {
                  setText(complete(text, o));
                  input.current?.focus();
                }}
              >
                <span aria-hidden="true">{pending?.sigil}</span>
                <span translate="no">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}
