import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import NoteGlyph from "@/components/notes/NoteGlyph";
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

function Cover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 animate-pulse-soft bg-surface" />}
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
    <div className="mono flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] tracking-[0.08em] text-clay">
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

  /* A tinted capsule in bone rather than in the accent. It still has to read
     as a second, separately pressable thing beside the eyebrow next to it, so
     it keeps a fill and an edge — they are just made of light now, which is
     also what lets it sit on a card that is itself standing on a photograph. */
  const badge = collectionTitle && (
    <Link
      to={`/projects/${post.collection}`}
      className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-bone/30 bg-bone/10 px-2.5 py-1 mono text-xs uppercase tracking-[0.16em] text-bone transition-colors duration-150 hover:bg-bone/20"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-clay" />
      {collectionTitle}
    </Link>
  );

  if (compact) {
    return (
      <article className={`note-card group relative ${className}`} style={style}>
        <div className="flex flex-col p-5">
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
        className={`note-card note-card--lead group relative sm:col-span-2 sm:grid sm:grid-cols-[1.05fr_1fr] sm:items-stretch lg:grid-cols-[1.2fr_1fr] ${className}`}
        style={style}
      >
        {/*
          The lead is the one slot that always carries a picture, which is what
          makes its footprint predictable enough for the loading skeleton to
          match it. A real cover when the post has one; the generated skyline
          when it does not, where a single large plate reads as art direction
          rather than as the filler it was on twelve cards at once.
        */}
        <div className="note-card__media sm:border-b-0 sm:border-r sm:border-r-edge">
          {post.coverImage ? <Cover src={post.coverImage} alt="" /> : <NoteGlyph seed={post.slug} />}
        </div>

        <div className="flex flex-col p-5 sm:p-7 lg:p-9">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {label && <p className="eyebrow">{label}</p>}
            {badge}
          </div>

          <div className="mt-3">{title}</div>

          {summary && (
            <p className="mt-3 text-base leading-[1.6] text-bone/75 sm:text-lg">{summary}</p>
          )}

          <div className="mt-5 pt-1 sm:mt-auto sm:pt-6">{meta}</div>
        </div>
      </article>
    );
  }

  return (
    <article className={`note-card group relative ${className}`} style={style}>
      {/* No cover, no media block. A grid of mixed heights is honest; a grid of
          identical generated pictures is not. */}
      {post.coverImage && (
        <div className="note-card__media">
          <Cover src={post.coverImage} alt="" />
        </div>
      )}

      <div className="flex flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {meta}
          {badge}
        </div>

        <div className="mt-3">{title}</div>

        {summary && (
          <p className="mt-2.5 line-clamp-3 text-[0.9375rem] leading-[1.65] text-bone/75">{summary}</p>
        )}
      </div>
    </article>
  );
}
