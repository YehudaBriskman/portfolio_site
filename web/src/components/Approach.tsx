import PaperCard from "@/components/cards/PaperCard";
import { cardType } from "@/components/cards/cardType";
import StackDeck from "@/components/cards/StackDeck";
import InkWipe from "@/components/motion/InkWipe";
import InkRule from "@/components/motion/InkRule";
import { about } from "@/data/site";

/*
 * How I work: an essay, then a pile of evidence.
 *
 * The three principles were three columns of prose in a grid, which is the
 * layout you choose when you want the reader to compare them. Nobody compares
 * them; they are three separate claims that happen to be about the same
 * person, and side by side the longest one set the height of the row and the
 * other two sat in a pool of their own whitespace.
 *
 * As a deck they are read the way they are written — one at a time, in order,
 * each one holding the screen until the next arrives and buries it. The pile
 * that is left at the bottom is the point: three things, done, with the edges
 * still showing.
 *
 * The intro above it deliberately stays as type on the paper. It is the page
 * speaking in the first person, and putting a voice in a box turns it into a
 * specimen.
 */
export default function Approach() {
  return (
    <section id="approach" className="wrap section-y isolate relative">
      <div>
        <h2 className="display text-section leading-[0.92]">{about.heading}</h2>
        {/* --ink-soft via the `clay` alias: 6.37:1 on paper. The alias layer in
            index.css exists precisely so a call site can be re-pointed when it
            is touched; renaming the Tailwind token itself belongs with whoever
            owns tailwind.config.ts. */}
        <p className="eyebrow mt-3">Team lead &middot; Israel Defense Forces</p>
      </div>

      {/* One measured column of prose. Wider leading and a longer measure,
          because the previous setting was small type packed into a narrow
          well — technically readable, actually skipped. */}
      <div className="mt-12 max-w-2xl space-y-6">
        {about.intro.map((p) => (
          <p key={p.slice(0, 24)} className="text-lg leading-[1.7] text-clay">
            {p}
          </p>
        ))}
      </div>

      {/* No `cardCycle` on these wipes, unlike every other group of cards on
          the site. The deck sets both the wipe hue and the resting wash
          itself, because the pile is offset three steps into the cycle so it
          does not replay the run of the grid below it; see
          StackDeck.module.css. */}
      <StackDeck aria-label="How I work, in three principles" className="mt-section-sm">
        {about.principles.map((p, i) => (
          /*
           * The ink wipe and the card are two elements rather than one,
           * because the wipe clips and `.card-paper` casts a shadow: a clip
           * path on the card itself would shear its own shadow off at the
           * moment it is doing the most work. The wipe clips a plain wrapper
           * that is larger than the shadow.
           */
          /* No width of its own any more: the deck measures itself against
             the grid in the section below, so a deck card ends on the same
             line the second column of the Stack grid ends on. */
          <InkWipe key={p.claim} as="article">
            {/*
             * Column, with the claim pushed to the foot of the card.
             *
             * Every card in the pile is the same height — the deck needs that
             * or a tall card hangs out below the short one meant to be
             * covering it — and on a wide screen these three paragraphs do
             * not fill it. Top-aligned that reads as a card someone forgot to
             * finish. Ordinal at the head, claim and evidence sitting on the
             * foot, and the air between them is the composition rather than
             * the leftover.
             */}
            <PaperCard className="flex flex-col">
              <p className={cardType.meta} aria-hidden="true">
                {String(i + 1).padStart(2, "0")} / {String(about.principles.length).padStart(2, "0")}
              </p>
              {/* The card's two gaps, named. `--card-step-tight` is a label
                  and the thing it labels; `--card-step` is one part of a card
                  and the next. Written as the tokens rather than as `mt-3`
                  and `mt-6` so that the stack card, the note card and this
                  one cannot drift apart again. */}
              <InkRule className="mt-[var(--card-step-tight)] w-10" />
              <div className="mt-auto pt-[calc(var(--card-step)*2)]">
                <h3 className={cardType.title}>{p.claim}</h3>
                <p className={`${cardType.body} mt-[var(--card-step)]`}>{p.detail}</p>
              </div>
            </PaperCard>
          </InkWipe>
        ))}
      </StackDeck>
    </section>
  );
}
