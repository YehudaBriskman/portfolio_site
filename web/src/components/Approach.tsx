import Rise from "@/components/motion/Rise";
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
 */
export default function Approach() {
  return (
    <section id="approach" className="wrap section-y">
      {/*
        One group, five steps, 60ms apart in reading order: the title, the
        standfirst, then the three principles. The grain is deliberate — the
        heading and its eyebrow arrive together because they are one object,
        and each principle arrives as a whole because a claim and its evidence
        are read as one thing. The reveal that used to wrap whole sections
        animated five hundred pixels as one opaque block, which is a statement
        about the browser rather than about the content.

        The measure lives on this element because it is the group: one 62ch
        column, so every line in the beat breaks on the same grid rather than
        each block finding its own width.
      */}
      <Rise className={styles.wall}>
        <div>
          <h2 className={`display-tight text-sub ${styles.head}`}>{about.heading}</h2>
          {/* 12px mono, uppercase, at +0.18em — the same field register every
              object label on the site uses for its specs. It labels the
              section instead of competing with it. */}
          <p className="eyebrow mt-3">Team lead &middot; Israel Defense Forces</p>
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
        */}
        {about.principles.map((p) => (
          <div key={p.claim} className={styles.principle}>
            <h3 className={styles.claim}>{p.claim}</h3>
            <p className={`${styles.prose} ${styles.detail}`}>{p.detail}</p>
          </div>
        ))}
      </Rise>
    </section>
  );
}
