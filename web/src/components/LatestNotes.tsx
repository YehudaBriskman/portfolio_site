import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { blog, formatDate } from "@/services/blog";

/*
 * The blog's front door.
 *
 * There wasn't one. The only routes in were a nav item labelled "Blog" and a
 * footer link labelled "Notes" — two names for the same place, both bare
 * labels, neither giving anybody a reason to click. A visitor could read this
 * entire page without learning that the writing exists, let alone what is in
 * it.
 *
 * Deliberately not the index's card: a teaser that reproduces the destination
 * is just the destination, twice. Three lines each — when, what, and the one
 * sentence that says whether it is for you — and the titles do the work.
 */

const SHOWN = 3;

export default function LatestNotes() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["notes", "latest"],
    queryFn: () => blog.posts(),
    staleTime: 5 * 60 * 1000,
    /*
     * One retry, not the default three.
     *
     * This is a teaser on a page the reader is scrolling past, not the thing
     * they came for. Three attempts with backoff keeps the skeleton on screen
     * for ten seconds before admitting anything is wrong, which is longer
     * than anyone spends here — the honest sentence is better arriving fast.
     */
    retry: 1,
  });

  const posts = (data ?? []).slice(0, SHOWN);

  return (
    <section id="notes" className="wrap section-y relative">
      {/* Same two-line head as Work and Stack below `sm`; this was the second
          of the two sections running off a 390px screen. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-6">
        <h2 className="display text-section leading-[0.9]">Notes</h2>
        <span className="mb-2 hidden h-px flex-1 bg-edge sm:block" aria-hidden="true" />
        <p className="eyebrow shrink-0 sm:mb-3">Decisions and what they cost</p>
      </div>

      {/*
       * Three states, and the section survives all of them.
       *
       * The index page's answer to a failed fetch was one 13px grey sentence
       * in a void under a giant headline, which is the screen every visitor
       * sees whenever the backend is down. Here the heading, the invitation
       * and the way through are static markup — the list is the only part
       * that depends on the network, so the door never disappears.
       */}
      {isPending && (
        <ul className="mt-12 space-y-6" aria-hidden="true">
          {Array.from({ length: SHOWN }, (_, i) => (
            <li key={i} className="max-w-2xl animate-pulse-soft space-y-3">
              <div className="h-3 w-40 rounded-sm bg-bone/10" />
              <div className="h-6 w-3/4 rounded-sm bg-bone/10" />
              <div className="h-4 w-2/3 rounded-sm bg-bone/5" />
            </li>
          ))}
        </ul>
      )}

      {!isPending && posts.length > 0 && (
        <ul className="mt-12 divide-y divide-edge/70 border-y border-edge/70">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link
                to={`/blog/${p.slug}`}
                className="group flex flex-col gap-3 py-6 transition-colors sm:flex-row sm:items-baseline sm:gap-12"
              >
                <span className="mono shrink-0 text-xs text-clay sm:w-44">
                  {formatDate(p.publishedAt) || "Unpublished"}
                  {p.readingMinutes > 0 && ` · ${p.readingMinutes} min`}
                </span>
                <span className="min-w-0">
                  {/* An underline rather than a change of colour: the title is
                      already bone, and these rows are divided by hairlines
                      rather than carried in cards, so nothing else in the row
                      tells you it is a link. */}
                  <span className="display-tight block text-xl text-bone underline decoration-transparent decoration-1 underline-offset-[6px] transition-[text-decoration-color] [transition-duration:var(--dur-fast)] group-hover:decoration-bone/50 sm:text-2xl">
                    {p.title}
                  </span>
                  {p.subtitle && (
                    <span className="mt-3 block max-w-xl text-base leading-relaxed text-bone/70">
                      {p.subtitle}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!isPending && posts.length === 0 && (
        <p className="mt-12 max-w-xl text-lg leading-relaxed text-bone/70">
          {isError
            ? "The notes aren't loading just now. They're still there — the index has all of them."
            : "Nothing published yet. The index is where they'll appear."}
        </p>
      )}

      <Link to="/blog" className="btn btn-quiet mt-section-sm">
        All notes <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
