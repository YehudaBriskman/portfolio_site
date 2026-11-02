import Flow from "@/components/motion/Flow";
import { about } from "@/data/site";
import styles from "@/components/Approach.module.css";

/*
 * The wall text, and the silence before the peak.
 *
 * Why this is the quietest thing on the page
 * ------------------------------------------
 * The peak needs something to be a change *from*. One beat gets the asset
 * budget, the silence before it, and the most scroll room; this is the silence.
 * Between the title plate and the pile there is exactly one beat, and it is
 * three principles as plain prose on paper — a 62ch measure, generous leading,
 * and nothing moving except 14px of rise on entry.
 *
 * What this replaces, and why losing it was the point
 * ---------------------------------------------------
 * These three were dealt into a fanned hand: `StackDeck` pinned them with
 * `position: sticky` and a scroll-driven settle, so each card held the screen
 * until the next arrived and buried it, leaving a pile with the edges showing.
 * It was the best-looking thing in the prototype after the pile itself, and
 * that is precisely why it had to go — it was a second peak, and a page with
 * two maximum-effort moments has none. It also argued with the beat three
 * screens down: a pinned act is spent once per page, and the pile spends it.
 *
 * So the deck is retired rather than reused, and the component and its test are
 * deleted with it. Half-using it — keeping the sticky slots and switching off
 * the settle — would have left the next reader of this file with a device that
 * does nothing and a reason nobody wrote down.
 *
 * No cards, and no container
 * --------------------------
 * The three principles are now a heading and a paragraph, three times, on the
 * paper. Nothing is drawn around them. If a border is needed to show that two
 * things belong together, the spacing was wrong first — and the spacing is the
 * entire design here, which is why it is a stylesheet of margins with the
 * reasoning next to each one.
 *
 * Why the section head is a rung below every other one on the page
 * ---------------------------------------------------------------
 * `Work` sets its heading in `text-section`, which tops out at 7rem, and so
 * does every other section. This one sets `text-sub`, in the narrower display
 * width and at weight 700, which is a deliberate inconsistency: a 7rem word is
 * the loudest possible object, and the one job this screen has is to be
 * genuinely quiet with nothing competing for attention. A wall text in a
 * gallery is titled, not billboarded.
 *
 * The beat's own device, and the tension in asking for one
 * -------------------------------------------------------
 * This section used to arrive through `Rise`, which is the `reveal` device the
 * ledger spends on the two bookends — so the page ran `reveal` on the title
 * plate and then `reveal` again here, in adjacent beats, against the one rule
 * §2 states as a rule: never the same family twice in a row. The ledger has
 * always called this beat `flow`; the code simply had not caught up.
 *
 * `flow` is in `components/motion/Flow.tsx` and the difference from `reveal`
 * is structural rather than cosmetic: `reveal` fires once for a whole group,
 * so everything in it shares one clock, and `flow` observes each item on its
 * own, so an item arrives when *it* is 12% inside the viewport and can carry a
 * gesture chosen for what it says. That is what makes the next paragraph
 * possible at all.
 *
 * A difference per principle has to mean something
 * ------------------------------------------------
 * Three claims that are about three different things can be *about* those
 * things on the way in, and the rule that keeps that from being a party trick
 * is that each difference has to be defensible in one sentence — written
 * beside it, in `treatment` below. A rotating set of easings would be three
 * decorations wearing the costume of an idea.
 *
 * And none of it may compete with the pile. §3: a page with three peaks has
 * none, and the peak is the pile. So every treatment here is built out of the
 * measured reveal in §5 and nothing else — 14px of travel, ~620ms, the page's
 * own curve, fired once — and the only thing that varies is *which* 14px, in
 * which direction, in how many moves, or whether anything moves at all. The
 * test applied to each of them was: would a reader stop and watch this? If
 * yes, it is wrong for this section, however good it looks. What is left is
 * legible to someone paying attention and invisible to someone skimming,
 * which is the brief this beat actually has.
 */

/*
 * Which treatment each principle gets, and the one sentence that earns it.
 *
 * Keyed by the claim rather than by index, which is the whole safety of this
 * mapping: the encoding is a statement about *meaning*, so if the copy in
 * `data/site.ts` is rewritten or reordered the right failure is for a
 * principle to fall back to the family's plain gesture — `??` below — rather
 * than to silently inherit the argument that belonged to a different
 * sentence. A treatment attached to the wrong claim is worse than no
 * treatment at all, because it is a reason that has quietly stopped being
 * true.
 *
 * The shared half is in `Approach.module.css`, next to the keyframes.
 */
const treatment: Record<string, string | undefined> = {
  /*
   * Install from empty, every time.
   *
   * The 14px of rise lands in three equal moves instead of one glide, because
   * this install is never resumed — it is performed again from an empty
   * directory on every pull request and twice more each night — and its two
   * halves come up together with no stagger between them, because a clone
   * into an empty directory has no partial state for a second step to arrive
   * after.
   */
  "Install from empty, every time": styles.fromEmpty,

  /*
   * A check that cannot fail is not a check.
   *
   * Its two halves arrive from opposite directions and meet on the line
   * between them — the claim settling down onto it, the detail rising up to
   * it, at the same moment — because a check only means anything if the other
   * outcome was reachable, and this is the one thing on the page allowed to
   * arrive against the grain the rest of it rises with.
   */
  "A check that cannot fail is not a check": styles.meet,

  /*
   * Generated, never committed.
   *
   * Nothing moves and nothing fades: the text is already in its final place
   * and the only thing the arrival changes is whether it has been printed,
   * which is the difference between a value being written and a value being
   * shown.
   */
  "Generated, never committed": styles.printed,
};

export default function Approach() {
  return (
    <section id="approach" className="wrap section-y">
      {/*
        Five items, and each one arrives on its own crossing rather than on a
        shared trigger. The grain is the same as it was under `Rise` and for
        the same reason — the heading and its eyebrow are one object, and a
        claim and its evidence are read as one thing — but the clock is no
        longer shared, which is what lets the three principles differ.

        Where several items are inside the viewport at the same instant, which
        is the ordinary case on a desktop, the 60ms step in
        `Approach.module.css` keeps them in reading order instead of letting
        them land as one block.

        The measure lives on this element because it is the group: one 62ch
        column, so every line in the beat breaks on the same grid rather than
        each block finding its own width.
      */}
      <Flow className={styles.wall}>
        <div>
          <h2 className={`display-tight text-sub ${styles.head}`}>{about.heading}</h2>
          {/* 12px mono, uppercase, at +0.18em — the same field register every
              object label on the site uses for its specs. It labels the
              section instead of competing with it. */}
          <p className="eyebrow mt-3">Full-stack &middot; Technical lead</p>
        </div>

        {/* The page speaking in the first person, which is why it is type on
            the paper and not type in a box: putting a voice in a box turns it
            into a specimen. */}
        <div className={styles.intro}>
          {about.intro.map((p) => (
            <p key={p.slice(0, 24)} className={styles.prose}>
              {p}
            </p>
          ))}
        </div>

        {/*
          Three principles, each a heading and one paragraph.

          No ordinals. "01 / 03" was a card's way of saying where it sat in a
          pile that was about to bury it; read as prose these are not a
          countdown, and numbering them would be the only ornament left on the
          quietest screen of the page.

          The second class on each is its arrival, and the reason for it is in
          `treatment` above rather than here, because the reason is about the
          sentence and not about the markup.
        */}
        {about.principles.map((p) => (
          <div
            key={p.claim}
            className={`${styles.principle} ${treatment[p.claim] ?? ""}`.trimEnd()}
          >
            <h3 className={styles.claim}>{p.claim}</h3>
            <p className={`${styles.prose} ${styles.detail}`}>{p.detail}</p>
          </div>
        ))}
      </Flow>
    </section>
  );
}
