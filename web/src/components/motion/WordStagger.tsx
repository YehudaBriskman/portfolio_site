import { Fragment } from "react";
import type { CSSProperties } from "react";
import styles from "@/components/motion/WordStagger.module.css";

/** The elements a staggered line is allowed to be. */
export type WordStaggerTag = "h1" | "h2" | "h3" | "h4" | "p" | "span" | "li";

export type WordStaggerProps = {
  /**
   * A single string, not nodes. The component has to see the sentence as
   * text to split it, and accepting children it cannot split would mean
   * silently dropping half of what it was handed.
   */
  children: string;
  as?: WordStaggerTag;
  className?: string;
};

/* The beat between two ordinary words. */
const STEP_MS = 110;
/* The rest at the end of a sentence, and the shorter one at a clause break.
   These are the effect. Words at a flat interval read as a machine printing;
   the pauses are what make it read as someone speaking the line. */
const STOP_MS = 420;
const CLAUSE_MS = 250;

/**
 * The pause owed *after* a word, decided by what it ends with.
 *
 * Trailing quotes and brackets are peeled off first, because the full stop in
 * `("done.")` is still a full stop and the reader hears the same rest there as
 * anywhere else.
 */
function pauseAfter(word: string): number {
  const bare = word.replace(/["'’”»)\]}]+$/u, "");
  const last = bare.slice(-1);
  if (last === "." || last === "!" || last === "?") return STOP_MS;
  if (last === "," || last === ";" || last === ":") return CLAUSE_MS;
  return 0;
}

/** Each word with the delay it starts at, measured from the first word. */
function schedule(text: string): { word: string; delay: number }[] {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  let clock = 0;

  return words.map((word) => {
    const delay = clock;
    clock += STEP_MS + pauseAfter(word);
    return { word, delay };
  });
}

/*
 * A line that arrives one word at a time, pausing where the punctuation does.
 *
 * The naive version of this — a fixed interval per word — reads as a teletype,
 * because an interval is the one thing speech never has. Holding for 420ms at
 * a full stop and 250ms at a comma is what turns the same animation into
 * somebody reading the line aloud, and it is the only reason the effect is
 * worth the markup it costs.
 *
 * The animation itself is not here. This component splits the sentence and
 * writes one number per word; the stylesheet decides what arriving looks like
 * and when the sequence is allowed to start.
 *
 * Accessibility: two copies, not aria-label
 * -----------------------------------------
 * Splitting a sentence into spans is destructive — several screen readers
 * announce `<span>Hold</span> <span>still.</span>` as two separate phrases,
 * and VoiceOver's word navigation walks the fragments. So the animated copy
 * is hidden from the tree and the real sentence is rendered beside it, offset
 * out of view but still text.
 *
 * The alternative, aria-label on the container with the spans hidden, is
 * fewer nodes but worse: ARIA does not allow a name on an element with no
 * role, so on a `p` or a `span` — two of the five tags this renders — the
 * label is ignored by spec-following AT and the line is announced as nothing
 * at all. A real text node has no such caveat, and it keeps the sentence
 * available to find-in-page and to translation tools, both of which skip an
 * aria-label entirely.
 */
export default function WordStagger({
  children,
  as = "p",
  className = "",
}: WordStaggerProps) {
  const Tag = as;
  const words = schedule(children);

  return (
    <Tag className={`${styles.line} ${className}`}>
      <span className={styles.sr}>{children}</span>
      <span className={styles.words} aria-hidden="true">
        {words.map(({ word, delay }, i) => (
          // Words repeat within a sentence, so the position is the identity.
          <Fragment key={`${i}-${word}`}>
            {/* The separator is a sibling of the span rather than part of it,
                so the line still breaks between words: an inline-block does
                not wrap at whitespace it contains. */}
            {i > 0 ? " " : null}
            <span
              className={styles.word}
              style={{ "--t": `${delay}ms` } as CSSProperties}
            >
              {word}
            </span>
          </Fragment>
        ))}
      </span>
    </Tag>
  );
}
