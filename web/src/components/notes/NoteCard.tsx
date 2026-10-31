import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import NoteGlyph from "@/components/notes/NoteGlyph";
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
 * ground it was drawn for, and `styles.cycle` is the card's place in the hue
 * cycle, which is what gives it its resting colour. Written once because
 * three call sites in this file open with it and nothing good comes of them
 * drifting apart.
 */
const SURFACE = `note-card ${styles.card} ${styles.cycle} group relative`;

function Cover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 animate-pulse-soft bg-paper-3" />}
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
  /** The most recent note, given the width, the picture and the weight to lead. */
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
  const summary = post.subtitle ?? post.excerpt;

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
     one level up and on the element that is actually the target. The accent
     this used to reach for is gone, and bone-on-bone would have been a
     transition to nothing. */
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
     drawn in NoteCard.module.css, where they are measured against the card's
     wash rather than against the near-black ground they were chosen for.
     44px tall rather than 26px, because it is a link and a finger has to be
     able to hit it. The row it sits in carries the same floor whether or not
     a badge lands in it, so the height is the row's and not the badge's. */
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
      <article className={`${SURFACE} ${className}`} style={style}>
        <div className="flex flex-col p-6">
          {label && <p className="eyebrow">{label}</p>}
          <div className={label ? "mt-3" : ""}>{title}</div>
          <div className="mt-3">{meta}</div>
        </div>
      </article>
    );
  }

  if (lead) {
    return (
      <article
        className={`${SURFACE} ${styles.lead} note-card--lead sm:col-span-2 sm:grid sm:grid-cols-[1.05fr_1fr] sm:items-stretch lg:grid-cols-[1.2fr_1fr] ${className}`}
        style={style}
      >
        {/*
          The lead is the one slot that always carries a picture, which is what
          makes its footprint predictable enough for the loading skeleton to
          match it. A real cover when the post has one; the generated skyline
          when it does not, where a single large plate reads as art direction
          rather than as the filler it was on twelve cards at once.
        */}
        <div className={`note-card__media ${styles.media} sm:border-b-0 sm:border-r`}>
          {post.coverImage ? <Cover src={post.coverImage} alt="" /> : <NoteGlyph seed={post.slug} />}
        </div>

        <div className="flex flex-col p-6 sm:p-8 lg:p-10">
          {/* `min-h-11` whether or not a badge lands in it. The badge is a
              link and so has to be a 44px target; with no floor on the row, a
              card that had one stood 29px taller in its first line than the
              card beside it in the same grid row, and the two titles started
              at different heights. */}
          <div className="-my-1 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2">
            {label && <p className="eyebrow">{label}</p>}
            {badge}
          </div>

          <div className="mt-3">{title}</div>

          {/* --ink-soft, not `text-bone/75`. The alpha passes — it composites
              to 7.88:1 on a neutral card — but its value moves with whatever
              wash the card is wearing (7.56:1 on the dullest), and the site
              already names this role as a solid token at 7.14:1 / 6.60:1. The
              same role written two ways in two files is how the card on the
              index stopped matching the card on the home page. */}
          {summary && (
            <p className="mt-3 text-base leading-[1.6] text-clay sm:text-lg">{summary}</p>
          )}

          <div className="mt-6 pt-1 sm:mt-auto sm:pt-6">{meta}</div>
        </div>
      </article>
    );
  }

  return (
    <article className={`${SURFACE} ${className}`} style={style}>
      {/* No cover, no media block. A grid of mixed heights is honest; a grid of
          identical generated pictures is not. */}
      {post.coverImage && (
        <div className={`note-card__media ${styles.media}`}>
          <Cover src={post.coverImage} alt="" />
        </div>
      )}

      {/* One inset, 24px, at every width. It was 20px below `sm`, which on a
          phone put the type 20px from a 32px corner — the corner cut into the
          first word of every title. A card's padding has to clear its own
          radius. */}
      <div className="flex flex-col p-6">
        {/* See the lead: one height for the row whether or not a badge lands
            in it, so two cards side by side agree. */}
        <div className="-my-1 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2">
          {meta}
          {badge}
        </div>

        <div className="mt-3">{title}</div>

        {summary && (
          <p className="mt-3 line-clamp-3 text-[0.9375rem] leading-[1.65] text-clay">{summary}</p>
        )}
      </div>
    </article>
  );
}
