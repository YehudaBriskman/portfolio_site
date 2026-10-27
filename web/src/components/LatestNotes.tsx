import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import PaperCard from "@/components/cards/PaperCard";
import { cardType } from "@/components/cards/cardType";
import InkWipe from "@/components/motion/InkWipe";
import InkRule from "@/components/motion/InkRule";
import { blog, formatDate } from "@/services/blog";

/*
 * The blog's front door.
 *
 * There wasn't one. The only routes in were a nav item labelled "Blog" and a
 * footer link labelled "Notes" — two names for the same place, both bare
 * labels, neither giving anybody a reason to click.
 *
 * Deliberately not the index's card: a teaser that reproduces the destination
 * is just the destination, twice. Three lines each — when, what, and the one
 * sentence that says whether it is for you — and the titles do the work.
 *
 * These were hairline-divided rows, and the rows are now cards because each
 * one is a door to somewhere else. A row divided by a rule is a line item in
 * a table of the same thing; a card is a separate object you can pick up, and
 * three separate objects is what three posts actually are. The cards still
 * carry no cover image, so the earlier argument holds: this is a list of
 * reasons to click, not a copy of the index.
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
        <InkRule className="mb-3 hidden min-w-0 flex-1 sm:block" />
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
            <li key={i}>
              <PaperCard className="animate-pulse-soft space-y-3">
                <div className="h-3 w-40 rounded-sm bg-clay/20" />
                <div className="h-6 w-3/4 rounded-sm bg-clay/20" />
                <div className="h-4 w-2/3 rounded-sm bg-clay/10" />
              </PaperCard>
            </li>
          ))}
        </ul>
      )}

      {!isPending && posts.length > 0 && (
        <ul className="mt-12 space-y-6">
          {posts.map((p) => (
            <InkWipe key={p.slug} as="li" direction="right">
              {/*
               * The whole card is the link, not a title inside it.
               *
               * `.card-paper`'s hover state is written for both shapes — it
               * keys off `a.card-paper` as well as a card containing a
               * hovered link — so an anchor carrying the class gets the
               * border and shadow lift without any of it being restated here.
               */}
              <PaperCard as="div" flush>
                <Link
                  to={`/blog/${p.slug}`}
                  className={`${cardType.inset} group flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-12`}
                >
                  <span className={`${cardType.meta} shrink-0 sm:w-64`}>
                    {formatDate(p.publishedAt) || "Unpublished"}
                    {p.readingMinutes > 0 && ` · ${p.readingMinutes} min`}
                  </span>
                  <span className="min-w-0">
                    {/* An underline rather than a change of colour: the title
                        is already full-strength ink, so there is no darker to
                        go. */}
                    <span
                      className={`${cardType.title} block underline decoration-transparent decoration-1 underline-offset-[6px] transition-[text-decoration-color] [transition-duration:var(--dur-fast)] group-hover:decoration-ink/50`}
                    >
                      {p.title}
                    </span>
                    {p.subtitle && (
                      <span className={`${cardType.body} mt-3 block max-w-xl`}>
                        {p.subtitle}
                      </span>
                    )}
                  </span>
                </Link>
              </PaperCard>
            </InkWipe>
          ))}
        </ul>
      )}

      {!isPending && posts.length === 0 && (
        <p className="mt-12 max-w-xl text-lg leading-relaxed text-clay">
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
