import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import NoteGlyph from "@/components/notes/NoteGlyph";
import dark from "@/components/notes/DarkCard.module.css";
import styles from "@/components/notes/NoteCard.module.css";
import { formatDate, type PostSummary } from "@/services/blog";

/*
 * The note, as a card.
 *
 * What this replaces was a hairline-divided text row — the broadsheet pattern
 * the rest of the site deliberately avoids (see Ridge.tsx), applied to the one
 * list where it hurt most. It had no surface, no radius, no press state, and it
 * hid the cover image below `sm`, so a phone got nothing but grey type.
 *
 * The whole card is clickable through a stretched pseudo-element on the title
 * link rather than by wrapping everything in one anchor: that keeps the
 * collection badge a real, separately focusable link instead of illegal nested
 * interactive content, and it leaves exactly one link per card for a screen
 * reader to announce.
 *
 * What the card no longer does, and why
 * -------------------------------------
 * It used to say the same thing three times. Date and reading time, then a
 * collection badge, then the title, then the subtitle, then an excerpt clamped
 * to three lines — and the excerpt is derived from the opening of the body, so
 * on a post with a subtitle it was usually a worse paraphrase of the line
 * directly above it. Then three tag pills, which repeat what is already at the
 * foot of the post. One summary line survives: the subtitle when the author
 * wrote one, the excerpt when they did not.
 *
 * It also used to open with a generated skyline on every coverless note. That
 * glyph varies a sun position and three sway values, which is not enough to
 * tell two posts apart, and it occupied a 16:9 block — the largest element in
 * the card — to carry nothing. Only the lead keeps a picture, where one image
 * is a focal point rather than a repeated texture.
 */

/*
 * The surface, in one string.
 *
 * `.note-card` is the shared class index.css still owns; `styles.card` is the
 * correction that makes it a surface on paper rather than on the near-black
 * ground it was drawn for. `styles.cycle` — the card's place in the hue cycle,
 * which gives it its resting colour on paper — is not in it any more: it is
 * an `nth-child` rule, so it has to sit on whatever is the grid's child, and
 * since #179 that is the slot around the card rather than the card. Written
 * once because the call sites in this file open with it and nothing good
 * comes of them drifting apart.
 */
const SURFACE = `note-card ${styles.card} group relative`;

function Cover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 scrub-pulse bg-paper-3" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        width={800}
        height={450}
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-[opacity,transform] duration-700 ease-out motion-safe:group-hover:scale-[1.04] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

export default function NoteCard({
  post,
  lead = false,
  compact = false,
  label,
  collectionTitle,
  className = "",
  style,
}: {
  post: PostSummary;
  /** The most recent note, given the width and the picture to lead. */
  lead?: boolean;
  /** No media, tighter type — the prev/next pair at the foot of a post. */
  compact?: boolean;
  /** An eyebrow above the title, e.g. "Latest" / "Older". */
  label?: string;
  /** Set when the note belongs to a project, so a mixed index explains itself. */
  collectionTitle?: string;
  /** Grid placement and entry animation belong to the caller, not the card. */
  className?: string;
  style?: CSSProperties;
}) {
  // One line of summary, never two. The subtitle is written; the excerpt is
  // machine-cut from the body, so it only speaks when nothing better exists.
  // An empty excerpt is the API's default (`backend/src/routes/admin.route.ts`),
  // so it is trimmed before it is trusted to be there.
  const summary = post.subtitle?.trim() || post.excerpt.trim();

  const meta = (
    <div className="mono flex flex-wrap items-center gap-x-2.5 gap-y-1 whitespace-nowrap text-[0.75rem] tracking-[0.08em] text-clay">
      {post.publishedAt && (
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
      )}
      {post.publishedAt && (
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-clay" />
      )}
      <span>{post.readingMinutes} min</span>
    </div>
  );

  /* No hover colour on the title: `.note-card:hover` lifts the whole card's
     border and `.note-card:focus-within` rings it, which is the same signal
     one level up and on the element that is actually the target. */
  const title = (
    <h2
      className={`display-tight text-bone ${
        lead ? "text-[1.75rem] sm:text-[2.125rem] lg:text-[2.5rem]" : compact ? "text-lg" : "text-[1.375rem] sm:text-2xl"
      }`}
    >
      {/* The stretched overlay: one link, whole card. */}
      <Link to={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:content-['']">
        {post.title}
      </Link>
    </h2>
  );

  /* A tinted capsule. It has to read as a second, separately pressable thing
     beside the eyebrow next to it, so it keeps a fill and an edge; both are
     drawn in NoteCard.module.css. 44px tall rather than 26px, because it is a
     link and a finger has to be able to hit it. The row it sits in carries
     the same floor whether or not a badge lands in it, so the height is the
     row's and not the badge's. */
  const badge = collectionTitle && (
    <Link
      to={`/projects/${post.collection}`}
      className={`${styles.badge} relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2.5 mono text-xs uppercase tracking-[0.16em] transition-colors duration-150`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-clay" />
      {collectionTitle}
    </Link>
  );

  if (compact) {
    return (
      <article className={`${SURFACE} ${styles.cycle} ${className}`} style={style}>
        <div className="flex flex-col p-6">
          {label && <p className="eyebrow">{label}</p>}
          <div className={label ? "mt-3" : ""}>{title}</div>
          <div className="mt-3">{meta}</div>
        </div>
      </article>
    );
  }

  /*
   * The lead and the grid card, one shape since #179, and dark: a dark
   * card on the page's paper. `.on-panel` and the card's stops
   * (`DarkCard.module.css`) are on the face, so it re-inks and the page
   * around it does not.
   *
   * The article is the SLOT: one height for every card in the grid, the
   * resting height plus the growth, so a card that opens on hover opens into
   * room that was already its own and nothing beside or below it moves. The
   * face inside it is the card. Its rows are named in NoteCard.module.css;
   * the markup only says which part is which.
   *
   * The lead keeps its width and its picture — the real cover, or the
   * generated skyline where one large plate reads as art direction — and
   * loses its extra height: every note card is the same height now, the lead
   * included, and the picture is what gives.
   */
  const media = lead || post.coverImage;

  return (
    <article
      className={`${styles.slot} ${styles.cycle} ${lead ? "sm:col-span-2" : ""} ${className}`}
      style={style}
    >
      <div
        className={`${SURFACE} on-panel ${dark.dark} ${styles.face} ${lead ? `note-card--lead ${styles.lead}` : ""}`}
        data-cover={media ? "" : undefined}
        /* Only a card with something to say grows to say it. */
        data-desc={summary ? "" : undefined}
      >
        {media && (
          /* Decorative: the title names the note, and an alt here would be
             read before it. */
          <div className={`note-card__media ${styles.media}`}>
            {post.coverImage ? <Cover src={post.coverImage} alt="" /> : <NoteGlyph seed={post.slug} />}
          </div>
        )}

        {/* `min-h-11` whether or not a badge lands in it: the badge is a
            44px target, and with no floor on the row a card that had one
            stood taller in its first line than the card beside it. */}
        <div className={`${styles.head} -my-1 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2`}>
          {label && <p className="eyebrow">{label}</p>}
          {meta}
          {badge}
        </div>

        <div className={styles.title}>{title}</div>

        {/* The description. In the DOM always, so it is read with the card;
            shown by the stylesheet — on hover and focus, or from the start
            where there is no hover to ask with. `--ink-soft` through the
            `text-clay` alias, a solid token on either ground. */}
        {summary && <p className={`${styles.desc} text-clay`}>{summary}</p>}
      </div>
    </article>
  );
}
