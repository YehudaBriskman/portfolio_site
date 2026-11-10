import { Link } from "react-router-dom";
import { Minus, Pencil, Plus, Share2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import TagPill from "@/components/notes/TagPill";
import { wasUpdated } from "@/components/dashboard/history";
import { fullDate, shortDate } from "@/components/dashboard/i18n";
import type { Post } from "@/services/blog";
import Toc, { type Heading } from "./Toc";
import { SCALES, type ReadingPrefs } from "./readingPrefs";
import { useReaderWords } from "./words";
import styles from "./Reader.module.css";

/*
 * The reader's panels (#249): the outline, the note's facts, and the reading
 * tools. Drawn twice from this one component, never as two copies to keep in
 * step: in the sticky aside beside the article on a wide screen, and inside
 * the phone's sheet (a native modal <dialog>) below that.
 *
 * The facts follow `data-display`: a label/value list (`<dl>`), each value
 * said once, dates through `Intl`, no colour beyond the tags' own.
 */

export async function shareNote(title: string, copied: string) {
  const url = window.location.href;
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast(copied);
  } catch {
    /* A dismissed share sheet rejects like a failure; say nothing. */
  }
}

export default function NotePanels({
  post,
  areaTitle,
  headings,
  active,
  prefs,
  setPrefs,
  isAdmin,
  onPick,
}: {
  post: Post;
  areaTitle: string | null;
  headings: Heading[];
  active: string;
  prefs: ReadingPrefs;
  setPrefs: (p: Partial<ReadingPrefs>) => void;
  isAdmin: boolean;
  onPick?: () => void;
}) {
  const [w, lang] = useReaderWords();
  const updated = wasUpdated(post);
  const i = SCALES.indexOf(prefs.scale as (typeof SCALES)[number]);
  const pct = `${Math.round(prefs.scale * 100)}%`;

  return (
    <div className={styles.panels}>
      <Toc headings={headings} active={active} label={w.onThisPage} onPick={onPick} />

      <section aria-label={w.details} className={styles.panel}>
        <p className={styles.panelTitle} aria-hidden="true">
          {w.details}
        </p>
        <dl className={styles.facts}>
          <div>
            <dt>{w.area}</dt>
            <dd>
              {post.collection !== "site" && areaTitle ? (
                <Link to={`/blog/area/${post.collection}`}>{areaTitle}</Link>
              ) : (
                (areaTitle ?? w.note)
              )}
            </dd>
          </div>
          {post.publishedAt && (
            <div>
              <dt>{w.published}</dt>
              <dd>
                <time dateTime={post.publishedAt} title={fullDate(post.publishedAt, lang)}>
                  {shortDate(post.publishedAt, lang)}
                </time>
              </dd>
            </div>
          )}
          {updated && post.updatedAt && (
            <div>
              <dt>{w.updated}</dt>
              <dd>
                <time dateTime={post.updatedAt} title={fullDate(post.updatedAt, lang)}>
                  {shortDate(post.updatedAt, lang)}
                </time>
                {post.changeNote && <span className={styles.changeNote}>{post.changeNote}</span>}
              </dd>
            </div>
          )}
          <div>
            <dt className="sr-only">{w.reading}</dt>
            <dd>{w.readTime(post.readingMinutes)}</dd>
          </div>
        </dl>

        {post.tags.length > 0 && (
          <ul className={styles.panelTags} aria-label={w.tags}>
            {post.tags.map((t) => (
              <li key={t}>
                <TagPill tag={t} />
              </li>
            ))}
          </ul>
        )}

        <div className={styles.panelActions}>
          <button type="button" className={styles.panelBtn} onClick={() => void shareNote(post.title, w.linkCopied)}>
            <Share2 size={15} aria-hidden="true" /> {w.share}
          </button>
          {isAdmin && (
            <Link to={`/admin/posts/${post.slug}`} className={styles.panelBtn} aria-label={w.editNote}>
              <Pencil size={15} aria-hidden="true" /> {w.edit}
            </Link>
          )}
        </div>
      </section>

      <section aria-label={w.reading} className={styles.panel}>
        <p className={styles.panelTitle} aria-hidden="true">
          {w.reading}
        </p>
        <div className={styles.tools}>
          <div className={styles.toolRow} role="group" aria-label={w.textSize}>
            <span className={styles.toolLabel} aria-hidden="true">
              {w.textSize}
            </span>
            <span className={styles.stepper}>
              <button
                type="button"
                className={styles.toolBtn}
                aria-label={w.smaller}
                title={w.smaller}
                disabled={i <= 0}
                onClick={() => setPrefs({ scale: SCALES[Math.max(0, i - 1)] })}
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <output className={styles.toolValue} aria-live="polite" aria-label={w.sizeNow(pct)}>
                {pct}
              </output>
              <button
                type="button"
                className={styles.toolBtn}
                aria-label={w.larger}
                title={w.larger}
                disabled={i >= SCALES.length - 1}
                onClick={() => setPrefs({ scale: SCALES[Math.min(SCALES.length - 1, i + 1)] })}
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </span>
          </div>
          <div className={styles.toolRow} role="group" aria-label={w.width}>
            <span className={styles.toolLabel} aria-hidden="true">
              {w.width}
            </span>
            <span className={styles.segment}>
              {([false, true] as const).map((wide) => (
                <button
                  key={String(wide)}
                  type="button"
                  aria-pressed={prefs.wide === wide}
                  className={styles.toolChoice}
                  onClick={() => setPrefs({ wide })}
                >
                  {wide ? w.wide : w.narrow}
                </button>
              ))}
            </span>
          </div>
        </div>
        {(prefs.scale !== 1 || prefs.wide) && (
          <button type="button" className={styles.toolReset} onClick={() => setPrefs({ scale: 1, wide: false })}>
            {w.reset}
          </button>
        )}
      </section>
    </div>
  );
}
