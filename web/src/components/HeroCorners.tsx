import type { CSSProperties } from "react";
import { useContent } from "@/content/store";
import { sectionVisible } from "@/settings/schema";
import { useSiteSettings } from "@/settings/store";
import { useHomeWords } from "@/i18n/pages";
import { useLang } from "@/components/dashboard/i18n";
import { inEnglish } from "@/i18n/words";
import { scrollToAnchor } from "@/lib/scrollToAnchor";
import styles from "@/components/HeroCorners.module.css";

/*
 * The hero's two lower corners — issue #101, decided.
 *
 * Start corner: one affordance, the ask, with its honest bound under it.
 * End corner: a small light, and the README's voice beside it one phrase at a
 * time. The owner picked the ask over a fact in each corner and over nothing,
 * and asked for the end corner to be redrawn as a light rather than a fact.
 *
 * THE BRIEF, AND THE TWO THINGS THE FIRST SCREEN HAS ALREADY SPENT
 * ----------------------------------------------------------------
 * The owner, looking at the first screen: "in the hero - need like stuf from
 * the right and left low parts, like buttons or stuff, something to call for
 * action". At 1440x900 the figure is a 416px column in the middle and the
 * band either side of it is empty paper most of the way down the screen.
 *
 * Two things were deliberately removed from this screen, and anything here
 * that reinstated either without answering the argument would be the failure:
 *
 *   1. The two action pills. "See the work" was a button telling a reader to
 *      do the thing they were already doing, and scrolling needs no
 *      affordance.
 *   2. The chrome carries the three destinations the site has — Home, all
 *      work, all notes — so a hero link to /projects duplicates a link on
 *      screen directly above it.
 *
 * Both are about redundancy, and that is the test each corner passes: each
 * says something no other element on the first screen says.
 *
 * ── the start corner: the ask ─────────────────────────────────────────
 *
 * Making contact is the one thing a stranger can do that scrolling will never
 * achieve, and it is the one destination the bar deliberately does not carry
 * — `nav/social.ts` argues at length for leaving the address out of the bar,
 * so an affordance pointing at the ask is not a second copy of anything on
 * screen. One affordance and not two, typeset rather than buttoned, so it is
 * not the button bar coming back by the side door. The bound under it is what
 * keeps it inside the label schema: "Usually within a day" is a fact with a
 * number in it, and an ask with a measured bound is not a pitch.
 *
 * The cost, which was accepted rather than missed: the ask is deliberately
 * the last plate of the collection, and an affordance on the first screen
 * asks before the collection has made its case.
 *
 * ── the end corner: the light ─────────────────────────────────────────
 *
 * The owner's words: "add modern light circle or something like that, maybe
 * some nice comments like 'Technology'... in the vibe of my readme". So a
 * light, and the README's asides beside it — "Product builder", "Build
 * boldly" — one at a time. The strings and the argument for each are in
 * `data/site.ts`; the motion and its three exits are in
 * `HeroCorners.module.css`, with a row in the device ledger of
 * `docs/motion-contract.md`.
 *
 * It replaces a labelled fact that used to name the owner's employer. That
 * must never come back, in this corner or anywhere: see the note on
 * `heroPhrases`.
 *
 * ── what is NOT here, and why ─────────────────────────────────────────
 *
 * A scroll cue. It belongs on the centre axis, which is the one part of the
 * lower screen that is not empty; in a corner it is a cue pointing at nothing
 * in particular.
 *
 * Social marks. The bar already carries GitHub and LinkedIn as pills, 50px
 * above these corners.
 *
 * A live count, a latest-shipped line, or anything else derived from
 * `data/projects.ts`. The count is already on the field line, and "latest
 * shipped" cannot be derived honestly: WindoM, the one project with real
 * users, carries no `when` field at all, so the newest year in the table
 * belongs to Bothy — the one entry with no product to open.
 *
 * ── how both sit on the composition ───────────────────────────────────
 *
 * Out of flow, against `.composition`, which is the constraint that decides
 * the markup. The figure's grid track is sized by subtraction — it gets
 * whatever row 1 did not use — so anything added to row 1 shrinks the
 * photograph, and anything in row 2 that is taller than the track changes
 * the track. An absolutely positioned box contributes no height to either,
 * so these cannot move a line of type or a pixel of the figure however they
 * are sized. See `HeroCorners.module.css`.
 */

/*
 * The affordance, and why it is an anchor with a click handler.
 *
 * `href="#contact"` first, so it works with no JavaScript, is a real link to
 * a real fragment, and can be opened in a new tab. The handler is the same
 * pattern the skip link and the wordmark use: `scrollToAnchor` decides per
 * click whether the hop eases or simply arrives — the page is thousands of
 * pixels tall and Blink caps a smooth scroll at about 700ms, so a smooth
 * descent from the first screen to the last plate fast-forwards the whole
 * page — and it moves keyboard focus to the target, which a bare fragment
 * link does not reliably do.
 *
 * Not a `mailto:`. `nav/social.ts` already calls that the worse of the two
 * answers, because it hands the reader's own mail client a blank message;
 * the plate at the other end has a form, the address, and the context to
 * write from.
 */
function Ask() {
  const { contact } = useContent().site;
  /* The ask points at the contact plate; with the plate hidden (#254) it
     would point at nothing, so it goes with it. */
  const contactShown = sectionVisible(useSiteSettings(), "contact");
  const w = useHomeWords();
  const lang = useLang();
  if (!contactShown) return null;
  return (
    <div className={styles.ask}>
      <a
        className={styles.askLink}
        href="#contact"
        onClick={(e) => {
          if (scrollToAnchor("contact")) e.preventDefault();
        }}
      >
        {w.getInTouch}
      </a>
      {/* The bound, in the field line's voice, so the ask reads as a fact
          about how long an answer takes rather than as an inducement. */}
      <p className={styles.askBound} {...inEnglish(lang, contact.replyWithin)}>{contact.replyWithin}</p>
    </div>
  );
}

/*
 * The light, and the phrases beside it.
 *
 * WHAT A SCREEN READER HEARS
 * --------------------------
 * One stable sentence, read once: the phrases joined, in a visually hidden
 * span. The visible stack is `aria-hidden`, because a ticker in the
 * accessibility tree is either announced on every change — which is noise on
 * a timer the reader did not start — or read as five unrelated words in a row
 * that happen to be stacked on top of one another. There is no `aria-live`
 * anywhere here, deliberately: nothing on this corner is news.
 *
 * WHY EVERY PHRASE IS IN THE DOM AT ONCE
 * --------------------------------------
 * The rotation is pure CSS: each phrase holds the same keyframes and is
 * offset by its index (`--i`), so there is no timer, no state and no render
 * per phrase change, and switching motion off is a stylesheet decision that
 * lands on the first phrase without any script having to know. They share
 * one grid cell, so the block is as wide as its longest phrase all the time
 * and the corner cannot change width while it runs — the ask beside it never
 * moves.
 *
 * The light is a `span` and decorative in the strictest sense, so it is
 * hidden from the accessibility tree and cannot be pointed at.
 */
function Light() {
  const { heroPhrases } = useContent().site;
  const lang = useLang();
  /* The owner's copy, English until it has a Hebrew of its own (#248). */
  return (
    <div className={styles.light} data-hero-light="" {...inEnglish(lang, heroPhrases.join(" "))}>
      <span className="sr-only">{heroPhrases.join(", ")}</span>
      <span className={styles.phrases} aria-hidden="true">
        {heroPhrases.map((phrase, i) => (
          <span
            key={phrase}
            className={styles.phrase}
            style={{ "--i": i, "--n": heroPhrases.length } as CSSProperties}
          >
            {phrase}
          </span>
        ))}
      </span>
      <span className={styles.lamp} aria-hidden="true" />
    </div>
  );
}

export default function HeroCorners() {
  return (
    /*
     * `data-hero-corners` is the hook the arrival stylesheet animates on.
     * The container takes no pointer events so that an invisible box over
     * the paper cannot eat a drag or a text selection; the one thing inside
     * it that is a control takes them back.
     */
    <div className={styles.corners} data-hero-corners="">
      <div className={styles.start}>
        <Ask />
      </div>
      <div className={styles.end}>
        <Light />
      </div>
    </div>
  );
}
