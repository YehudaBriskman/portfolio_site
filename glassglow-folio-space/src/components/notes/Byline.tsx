import type { ReactNode } from "react";

/*
 * Who wrote this.
 *
 * A personal blog with no name and no face above the fold reads as a content
 * farm, and this one had neither: the index opened on the word "Writing" and
 * the posts opened on a date. The portrait is the same cutout the home page
 * uses, so it costs nothing new — the 365px file is already in the cache for
 * anyone who arrived by way of the front page.
 *
 * The feed belongs here too. index.html has advertised /feed.xml since the
 * first deploy and nothing in the interface has ever linked it, which means
 * the only people who could subscribe were the ones reading the <head>.
 */

export const AUTHOR = {
  name: "Yehuda Briskman",
  /* Both halves of this are checkable, which is the standard the rest of the
     copy on this site holds itself to. */
  role: "Full-stack engineer & team lead",
} as const;

/** The subscribe affordance, on its own so the index and the post agree. */
export function FeedLink({ className = "" }: { className?: string }) {
  return (
    <a
      href="/feed.xml"
      className={`tap mono inline-flex min-h-[44px] items-center gap-2 text-[0.75rem] uppercase tracking-[0.16em] text-clay transition-colors duration-150 hover:text-sodium ${className}`}
    >
      {/* The three arcs, drawn rather than imported: one glyph is not worth a
          dependency, and this one has to sit on a sodium hover anyway. */}
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path d="M2.5 13.5h.01" strokeWidth="2.6" />
        <path d="M2.5 9.2a4.3 4.3 0 0 1 4.3 4.3" />
        <path d="M2.5 5a8.5 8.5 0 0 1 8.5 8.5" />
      </svg>
      RSS
    </a>
  );
}

export default function Byline({
  /** Date, reading time — whatever this particular page wants beside the name. */
  meta,
  feed = false,
  className = "",
}: {
  meta?: ReactNode;
  feed?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <img
          src="/img/yehuda-cut-sm.webp"
          alt=""
          width={365}
          height={560}
          loading="lazy"
          decoding="async"
          /* A head-and-shoulders crop out of a standing cutout: the subject is
             at the top of the frame, so the circle is anchored there. */
          className="h-11 w-11 shrink-0 rounded-full border border-edge bg-surface object-cover object-[50%_8%]"
        />
        <div className="leading-tight">
          <p className="text-[0.9375rem] text-bone">{AUTHOR.name}</p>
          <p className="mono mt-1 text-[0.6875rem] tracking-[0.08em] text-clay">
            {AUTHOR.role}
          </p>
        </div>
      </div>

      {meta}

      {feed && <FeedLink className="ml-auto" />}
    </div>
  );
}
