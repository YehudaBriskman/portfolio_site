import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import type { LabelField } from "@/components/gallery/objectLabel";
import PaperCard from "@/components/cards/PaperCard";
import { cardCycle, cardType } from "@/components/cards/cardType";
import InkRule from "@/components/motion/InkRule";
import { projects } from "@/data/projects";
import { blog, type PostSummary } from "@/services/blog";
import styles from "@/components/LatestNotes.module.css";

/*
 * The notes, as a shelf you walk along.
 *
 * What this is for
 * ----------------
 * The beat before this is the pile, which pins and holds the reader in one
 * place for a screen and a half. Lateral travel is the strongest contrast
 * available after being held still, which is why the grammar names `pan` as
 * the spine of a gallery and why this section is the one that gets it: the
 * reader scrolls down, the shelf travels sideways, and the pile reads as a
 * peak because the thing after it does not behave like it.
 *
 * The motion is all in the stylesheet — a named view timeline on the section
 * and six ranges — so there is no scroll listener, no index in state and no
 * re-render as the reader moves. This file decides what a note's label says
 * and which of the three states the section is in, and nothing else.
 *
 * What it replaced, twice over
 * ----------------------------
 * First a hairline-divided table of three rows, then three cards in a
 * vertical list. Both were fine and neither was a device: five sections that
 * behave identically are one section shown five times, and this was the
 * fourth of five sections arriving the same way.
 *
 * The peeling-corner hover is gone with them. It was a pointer effect that
 * did nothing at all on touch — half the readers paying for the other half's
 * cursor — and the grammar reserves pointer work for a lean on objects you
 * would pick up. There is one here now, at 4deg, gated to a fine pointer.
 *
 * Deliberately not the ARIA carousel
 * ----------------------------------
 * The tabbed-carousel pattern — a tablist of dots, one visible panel, the
 * rest `aria-hidden` — is the obvious reading of a horizontal strip of cards
 * and it is wrong here for the same concrete reason it was wrong on the
 * project carousel: it would hide five of six notes from a screen reader in
 * exchange for an effect a screen reader never sees. What this actually is,
 * in markup and in the accessibility tree, is a list of links in a box
 * narrower than the list. Every card is present, laid out, and in the tab
 * order at all times, in document order. That is also what lets all three
 * switch-offs land on a plain vertical list without anything being lost.
 */

/*
 * Six, where the row of cards showed three.
 *
 * A shelf needs enough on it to be worth walking along: at the desktop
 * measure three cards do not fill the frame, so there is nothing to scroll
 * and the pan has nothing to pan across. Six is the length at which the shelf
 * overflows at every width this site supports, and it is also as many ranges
 * as the stylesheet staggers.
 */
const SHOWN = 6;

/*
 * The most a fact line may run to before it is cut.
 *
 * Measured rather than chosen: at the shelf's card width this is a shade
 * under three lines of the label's fact step, which is the point at which the
 * cards in a row stop being able to share a height without one of them
 * looking half-empty.
 */
const FACT_MAX = 118;

/**
 * Which project a note belongs to, by slug.
 *
 * Notes carry a collection slug and nothing else, and the field line has to
 * print a name. Built from the seed table rather than fetched, because this
 * is the home page and a second request to label three fields would be a
 * second thing that can fail. A note in no project prints `Notes`, which is
 * the collection it is actually in.
 */
const projectTitles = new Map(projects.map((p) => [p.slug, p.title]));

/**
 * The date, short enough to survive being cropped.
 *
 * `formatDate` prints "10 September 2026", which is right in a byline and
 * wrong in a field line — it is the last of three fields on a card that is
 * half-visible for most of its life, so it gets the form that fits.
 */
function monthAndYear(iso: string | null): string {
  if (!iso) return "";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return when.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/**
 * One sentence, and never two.
 *
 * The subtitle is written by the author and is used as it stands. The excerpt
 * is machine-cut from the opening of the body, so it only speaks when there
 * is no subtitle, and then only as far as its first full stop: a label is
 * read, a paragraph on a card is skipped, and the note's own page has the
 * rest of it.
 */
function factLine(post: PostSummary): string {
  const written = post.subtitle?.trim();
  if (written) return written;

  const text = post.excerpt.trim();
  const stop = text.search(/[.!?](\s|$)/);
  const sentence = stop === -1 ? text : text.slice(0, stop + 1);
  if (sentence.length <= FACT_MAX) return sentence;

  const space = sentence.lastIndexOf(" ", FACT_MAX);
  return `${sentence.slice(0, space > 0 ? space : FACT_MAX).trimEnd()}…`;
}

/**
 * The note's field line: where it lives, how long it takes, when it landed.
 *
 * Order is `orderFields`' business and not this function's, but the kinds are
 * chosen so that the order it produces puts the most identifying fact first —
 * which on a shelf is the one still on screen when the rest of the card is
 * not. A field with nothing behind it is omitted rather than printed empty:
 * an unpublished note has no date and a note the reading estimate could not
 * measure has no minutes.
 */
function noteFields(post: PostSummary): LabelField[] {
  const fields: LabelField[] = [
    { kind: "where", value: projectTitles.get(post.collection) ?? "Notes" },
  ];
  if (post.readingMinutes > 0) {
    fields.push({ kind: "reading", value: `${post.readingMinutes} min` });
  }
  const when = monthAndYear(post.publishedAt);
  if (when) fields.push({ kind: "when", value: when });
  return fields;
}

export default function LatestNotes() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["notes", "latest"],
    queryFn: () => blog.posts(),
    staleTime: 5 * 60 * 1000,
    /*
     * One retry, not the default three.
     *
     * This is a shelf on a page the reader is scrolling past, not the thing
     * they came for. Three attempts with backoff keeps the skeleton on screen
     * for ten seconds before admitting anything is wrong, which is longer
     * than anyone spends here — the honest sentence is better arriving fast.
     */
    retry: 1,
  });

  const posts = (data ?? []).slice(0, SHOWN);

  return (
    /*
     * The section is not `.wrap`, and that is the one structural change.
     *
     * The shelf has to be full-bleed: a 20rem drift inside a 72rem column
     * would spend its life visibly misaligned with the heading above it, and
     * breaking out of the measure with `100vw` is how a page acquires a
     * horizontal scrollbar nobody can account for — `100vw` includes the
     * vertical scrollbar. So the section is full width, the heading and the
     * way out carry `.wrap` themselves, and the shelf reproduces `.wrap`'s
     * left edge in its own padding. See `--shelf-inset`.
     */
    <section id="notes" className={`${styles.section} section-y relative`}>
      {/* Same two-line head as the sections above below `sm`; a display
          heading and an unbreakable eyebrow do not share a 350px row. */}
      <div className="wrap flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-6">
        <h2 className="display text-section leading-[0.9]">Notes</h2>
        <InkRule className="mb-3 hidden min-w-0 flex-1 sm:block" />
        <p className="eyebrow shrink-0 sm:mb-3">Decisions and what they cost</p>
      </div>

      {/*
       * Three states, and the section survives all of them.
       *
       * `/blog` has shipped its error card as the most-seen state on the page
       * before now, so this is not an afterthought: the heading, the
       * invitation and the way through are static markup, and the shelf is
       * the only part that depends on the network. The door never disappears.
       */}
      {isPending && (
        <div className={styles.viewport}>
          <ul className={styles.track} aria-hidden="true">
            {Array.from({ length: SHOWN }, (_, i) => (
              /* The cycle class goes on the slot, so the six placeholders are
                 already the six colours the six real cards will arrive in and
                 nothing changes colour underneath the reader when the request
                 lands. */
              <li key={i} className={`${styles.slot} ${cardCycle}`}>
                <PaperCard as="div" className={`${styles.card} animate-pulse-soft`}>
                  <div className={styles.ghost}>
                    {/* Capsules, not rectangles: a placeholder stands in for a
                        line of text, and a line of text has no corners. The
                        three are the three parts of the label. */}
                    <div className={styles.ghostName} />
                    <div className={styles.ghostFact} />
                    <div className={styles.ghostField} />
                  </div>
                </PaperCard>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isPending && posts.length > 0 && (
        /*
         * `tabindex="0"` is the part of this that matters most.
         *
         * A focusable scroller is how the arrow keys, Home/End and
         * Page Up/Down come to work, and it is what axe's
         * `scrollable-region-focusable` exists to check for. Chrome has
         * lately started focusing scrollers on its own; saying so explicitly
         * makes the behaviour the same everywhere.
         *
         * `role="group"` with a name, and deliberately nothing else: the one
         * thing the list semantics do not convey is that this box is a window
         * with more in it than you can see. No `aria-roledescription`, no
         * tablist, nothing hidden — see the note at the top of the file.
         */
        <div
          className={styles.viewport}
          tabIndex={0}
          role="group"
          aria-label="Notes shelf"
        >
          <ul className={styles.track}>
            {posts.map((post) => (
              /* The hue is decided by position among siblings, so `cardCycle`
                 goes on the slot — the sibling — and the card inside inherits
                 `--card-wash` from it. Same five colours, same order, as
                 every other group of cards on the site. */
              <li key={post.slug} className={`${styles.slot} ${cardCycle}`}>
                {/* The lean is one element in from the slot, which is
                    carrying a scroll-driven transform. The two cannot share
                    an element; see the note on `.card`. */}
                <PaperCard as="div" flush className={styles.card}>
                  {/*
                   * The whole card is the link, not the name inside it.
                   * `.card-paper`'s hover state is written for both shapes —
                   * `a.card-paper` and a card containing a hovered link — so
                   * the border and shadow lift without any of it being
                   * restated here.
                   */}
                  <Link to={`/blog/${post.slug}`} className={`${cardType.inset} ${styles.face}`}>
                    {/*
                     * `scale="inline"`, and it is the crop that decides it.
                     *
                     * A label on a travelling shelf is half-visible for far
                     * longer than it is whole, so it has to identify its note
                     * from its first 40% — which at this card width is about
                     * 145px. Measured: at the label's `object` step (35px at
                     * the desktop measure) that is four characters, and
                     * "Why " identifies nothing. At the `inline` step it is
                     * thirteen, which is enough to tell every title in the
                     * collection apart, and the field line underneath opens
                     * with the most identifying field by construction.
                     *
                     * The alternative was a wider card, and the arithmetic
                     * kills it: 13 characters at 35px needs a 650px card,
                     * which is two objects on screen and not a shelf.
                     */}
                    <ObjectLabel
                      scale="inline"
                      nameAs="h3"
                      name={post.title}
                      fact={factLine(post)}
                      fields={noteFields(post)}
                    />
                  </Link>
                </PaperCard>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isPending && posts.length === 0 && (
        /* The measure and the width are two elements, not one. `.wrap` sets
           `max-width` and `margin-inline: auto`, so a `max-w-xl` on the same
           element wins the width and keeps the centring — which put this
           sentence 288px to the right of the heading above it rather than
           under it. */
        <div className="wrap">
          <p className="mt-12 max-w-xl text-lg leading-relaxed text-clay">
            {isError
              ? "The notes aren't loading just now. They're still there — the index has all of them."
              : "Nothing published yet. The index is where they'll appear."}
          </p>
        </div>
      )}

      <div className="wrap">
        <Link to="/blog" className="btn btn-quiet mt-section-sm">
          All notes <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
