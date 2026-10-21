import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import NoteGlyph from "@/components/notes/NoteGlyph";
import TagPill from "@/components/notes/TagPill";
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
 * link rather than by wrapping everything in one anchor: that keeps the tags and
 * the collection badge as real, separately focusable links instead of illegal
 * nested interactive content, and it leaves exactly one link per card for a
 * screen reader to announce.
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
  /** The most recent note, given the width and the weight to lead the page. */
  lead?: boolean;
  /** No media, tighter type — the prev/next pair at the foot of a post. */
  compact?: boolean;
  /** An eyebrow above the title, e.g. "Older" / "Newer". */
  label?: string;
  /** Set when the note belongs to a project, so a tag result explains itself. */
  collectionTitle?: string;
  /** Grid placement and entry animation belong to the caller, not the card. */
  className?: string;
  style?: CSSProperties;
}) {
  const meta = (
    <div className="mono flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] tracking-[0.08em] text-clay">
      {post.publishedAt && (
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
      )}
      {post.publishedAt && (
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-sodium/70" />
      )}
      <span>{post.readingMinutes} min</span>
    </div>
  );

  const title = (
    <h2
      className={`display-tight text-bone transition-colors duration-150 group-hover:text-sodium ${
        lead ? "text-[1.625rem] sm:text-3xl lg:text-[2.125rem]" : compact ? "text-lg" : "text-[1.375rem] sm:text-2xl"
      }`}
    >
      {/* The stretched overlay: one link, whole card. */}
      <Link to={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:content-['']">
        {post.title}
      </Link>
    </h2>
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

  return (
    <article
      className={`note-card group relative ${
        lead
          ? "note-card--lead sm:col-span-2 sm:grid sm:grid-cols-[1.05fr_1fr] sm:items-stretch lg:grid-cols-[1.2fr_1fr]"
          : ""
      } ${className}`}
      style={style}
    >
      <div className={`note-card__media ${lead ? "sm:border-b-0 sm:border-r sm:border-r-edge" : ""}`}>
        {post.coverImage ? <Cover src={post.coverImage} alt="" /> : <NoteGlyph seed={post.slug} />}
      </div>

      <div className={`flex flex-col ${lead ? "p-5 sm:p-7 lg:p-9" : "p-5 sm:p-6"}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {meta}
          {collectionTitle && (
            <Link
              to={`/projects/${post.collection}`}
              className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-sodium/35 bg-sodium/10 px-2.5 py-1 mono text-[0.6875rem] uppercase tracking-[0.16em] text-sodium transition-colors duration-150 hover:bg-sodium/20"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sodium" />
              {collectionTitle}
            </Link>
          )}
        </div>

        <div className="mt-3">{title}</div>

        {post.subtitle && (
          <p className={`mt-2 leading-snug text-bone/75 ${lead ? "text-base sm:text-lg" : "text-[0.9375rem]"}`}>
            {post.subtitle}
          </p>
        )}

        <p
          className={`mt-3 leading-[1.65] text-bone/70 ${
            lead ? "line-clamp-4 text-[0.9375rem] sm:text-base" : "line-clamp-3 text-[0.9375rem]"
          }`}
        >
          {post.excerpt}
        </p>

        {post.tags.length > 0 && (
          <ul className="relative z-10 mt-auto flex flex-wrap gap-2 pt-5">
            {post.tags.slice(0, 3).map((t) => (
              <li key={t}>
                <TagPill tag={t} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
