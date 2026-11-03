import { Link } from "react-router-dom";
import NoteGlyph from "@/components/notes/NoteGlyph";
import dark from "@/components/notes/DarkCard.module.css";
import styles from "@/components/notes/NoteTile.module.css";
import type { Size } from "@/components/gallery/Wall";
import type { PostSummary } from "@/services/blog";
import { INTL, useLang } from "@/components/dashboard/i18n";
import { useNotesWords } from "@/i18n/pages";
import { dateIn, inEnglish, plural } from "@/i18n/words";

/* "10 Jan 2026": a tile is a quarter of the wall, and the long month pushed
   the reading time onto a second line of its own. */
const shortDate = (iso: string, lang: keyof typeof INTL) =>
  dateIn(lang, iso, { day: "numeric", month: "short", year: "numeric" });

/*
 * A note, as a piece on the gallery wall (#193): the same wall, sizes and
 * arrival as /projects (`gallery/Wall.tsx`), in the clean dark card the
 * notes have worn since #179/#185 (`DarkCard.module.css`, beside
 * `.on-panel`, which is what re-inks everything inside it).
 *
 * One link per card, stretched over the whole face by the title's `::after`,
 * so a screen reader announces one thing per note; the collection badge is
 * the one other link, raised above the stretch so it stays its own target.
 *
 * What it shows, and in what order: when, how long, the title, one line of
 * summary (the subtitle when the author wrote one, the excerpt when not).
 * The tags are not printed: they are what the rail filters by, and the foot
 * of the post lists them. A picture only where there is one — the lead
 * always (its real cover, or the generated skyline), any other note only
 * with a real cover, which is also what makes it `wide`.
 */

export default function NoteTile({
  post,
  size,
  collectionTitle,
}: {
  post: PostSummary;
  size: Size;
  /** Set when the note belongs to a project, so a mixed index explains itself. */
  collectionTitle?: string;
}) {
  const summary = post.subtitle?.trim() || post.excerpt.trim();
  const media = size === "lead" || post.coverImage;
  const lang = useLang();
  const w = useNotesWords();

  return (
    <article className={`on-panel ${dark.dark} ${styles.tile}`} data-size={size} data-media={media ? "" : undefined}>
      {media && (
        /* Decorative: the title names the note, and an alt here would be
           read before it. */
        <div className={styles.media}>
          {post.coverImage ? (
            <img src={post.coverImage} alt="" loading="lazy" decoding="async" width={800} height={450} />
          ) : (
            <NoteGlyph seed={post.slug} />
          )}
        </div>
      )}
      <div className={styles.body}>
        <p className={styles.meta} dir="auto">
          {post.publishedAt && <time dateTime={post.publishedAt}>{shortDate(post.publishedAt, lang)}</time>}
          {post.publishedAt && <span aria-hidden="true" className={styles.dot} />}
          <span>{plural(lang, post.readingMinutes, w.minutesRead)}</span>
        </p>
        <h2 className={styles.title} dir="auto" {...inEnglish(lang, post.title)}>
          <Link to={`/blog/${post.slug}`} className={styles.open}>
            {post.title}
          </Link>
        </h2>
        {summary && (
          <p className={styles.desc} dir="auto" {...inEnglish(lang, summary)}>
            {summary}
          </p>
        )}
        {collectionTitle && (
          <Link to={`/projects/${post.collection}`} className={styles.badge}>
            <span aria-hidden="true" className={styles.badgeDot} />
            {collectionTitle}
          </Link>
        )}
      </div>
    </article>
  );
}
