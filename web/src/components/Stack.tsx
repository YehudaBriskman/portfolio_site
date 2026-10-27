import PaperCard from "@/components/cards/PaperCard";
import { cardType } from "@/components/cards/cardType";
import InkWipe from "@/components/motion/InkWipe";
import InkRule from "@/components/motion/InkRule";
import { stackGroups } from "@/data/stack";

/*
 * What the toolchain proves, not what is in it.
 *
 * This was three columns of bare nouns set one per line. A vertical column of
 * single words is a resume keyword list and it is read the way those are
 * read, which is not at all. The grouping was always the interesting part:
 * these are sorted by how close each tool is to daily use, so the honest
 * claim is in the group heading and the note under it, and the tools
 * themselves are evidence for that claim rather than the content.
 *
 * Each group is now a card, and that is not decoration. A group here is a
 * claim with its evidence attached — "running, not just tried", and then the
 * nine things that are running — which is exactly the thing a card is for:
 * one object you can pick up whole. Three columns separated by whitespace
 * asked the reader to work out where one claim ended and the next began; a
 * border answers that before they start.
 */
export default function Stack() {
  return (
    <section id="stack" className="wrap section-y relative">
      {/* Stacks below `sm` for the reason given in Work.tsx: a display heading
          and an unbreakable eyebrow do not share a 350px row. This is the
          longest eyebrow on the site and it was the worse of the two
          overflows it caused — 544px of content in a 375px viewport. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-6">
        <h2 className="display text-section leading-[0.9]">Stack</h2>
        {/* Was a 1px div. It is the same hairline in the same place; it is now
            drawn across the gap as the heading arrives rather than being
            switched on with it. */}
        <InkRule className="mb-3 hidden min-w-0 flex-1 sm:block" />
        <p className="eyebrow shrink-0 sm:mb-3">All of it in a repository you can open</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {stackGroups.map((g) => (
          /* min-w-0 is load-bearing: a grid item defaults to min-width:auto
             and will not shrink below the intrinsic width of its content, so
             the longest unbroken run of tool names pushed this column over
             its track and drew on top of the one beside it. The same trap is
             documented in Work.tsx for the same reason. */
          <InkWipe key={g.title} as="div" className="min-w-0">
            <PaperCard as="article" className="flex h-full min-w-0 flex-col">
              <h3 className={cardType.title}>{g.title}</h3>
              <p className={`${cardType.meta} mt-3`}>{g.note}</p>
              <InkRule className="mt-6 w-10" />

              {/*
               * A wrapping list, not a paragraph of spans.
               *
               * The first version set these as inline spans separated by a
               * slash with a margin on it. A margin is not a space: with no
               * whitespace text node between the elements the browser saw the
               * whole group as one unbreakable word, so a column of ten tools
               * laid itself out 540px wide inside a 341px track and drew on
               * top of the column beside it. Flex wraps on the gaps because
               * the gaps are real boxes.
               */}
              <ul className={`${cardType.body} mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1`}>
                {g.items.map((item, i) => (
                  <li key={item} className="flex items-baseline gap-x-2">
                    {item}
                    {/* The slash trails its item rather than leading the next
                        one. Leading it means a wrapped line opens on a
                        separator, which on a phone happened to three of the
                        nine rows and read as a bullet. */}
                    {i < g.items.length - 1 && (
                      <span className="select-none text-ridge" aria-hidden="true">
                        /
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </PaperCard>
          </InkWipe>
        ))}
      </div>
    </section>
  );
}
