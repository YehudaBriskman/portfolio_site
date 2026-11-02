import type { ReactNode } from "react";
import { contact, plate } from "@/data/site";
import { scrollToAnchor } from "@/lib/scrollToAnchor";
import { heroCorners, type HeroCorners as Which } from "@/components/heroFirstScreen";
import styles from "@/components/HeroCorners.module.css";

/*
 * The hero's two lower corners, as three candidates — issue #101.
 *
 * THE BRIEF, AND THE TWO THINGS THE FIRST SCREEN HAS ALREADY SPENT
 * ----------------------------------------------------------------
 * The owner, looking at the first screen: "in the hero - need like stuf from
 * the right and left low parts, like buttons or stuff, something to call for
 * action". At 1440x900 the figure is a 416px column in the middle and the
 * band either side of it is empty paper most of the way down the screen.
 *
 * Two things were deliberately removed from this screen, and a candidate
 * that reinstates either without answering the argument is the failure mode:
 *
 *   1. The two action pills. "See the work" was a button telling a reader to
 *      do the thing they were already doing, and scrolling needs no
 *      affordance.
 *   2. The chrome carries the three destinations the site has — Home, all
 *      work, all notes — so a hero link to /projects duplicates a link on
 *      screen directly above it.
 *
 * Both are about *redundancy*, and that is the test any candidate here has
 * to pass: it must say something no other element on the first screen says.
 *
 * ── `ask` ── one affordance, one fact. THE RECOMMENDATION ──────────────
 *
 * Start corner: a link to the ask plate, set as type rather than as a pill,
 * with the reply bound under it. End corner: what the owner does now.
 *
 * FOR. It answers the pills argument rather than forgetting it. Making
 * contact is the one thing a stranger can do that scrolling will never
 * achieve, and it is the one destination the bar deliberately does not carry
 * — `nav/social.ts` argues at length for leaving the address out of the bar,
 * so a hero affordance pointing at the ask is not a second copy of anything
 * on screen. "See the work" was redundant because the work is directly below
 * and the reader's own gesture gets them there; the ask is at the foot of a
 * page thousands of pixels tall, which the same gesture does not reach in
 * any useful sense. One affordance and not two, typeset rather than
 * buttoned, so it is not the button bar coming back by the side door. The
 * bound under it is what keeps it inside the schema: "Usually within a day"
 * is a fact with a number in it, and an ask with a measured bound is not a
 * pitch.
 *
 * AGAINST, and it is a real cost. The ask is deliberately the *last* plate of
 * the collection, on the argument that by the time a reader reaches it the
 * page has said enough for them to know what to write. An affordance on the
 * first screen asks before the collection has made its case, which is the
 * one thing the site's own structure says not to do. It also puts a control
 * on a screen whose composition is three statements and a figure, and the
 * count of things to look at goes from four to six.
 *
 * ── `facts` ── a fact in each corner, nothing clickable ────────────────
 *
 * FOR. The label schema's own voice saying what the three-part label cannot:
 * the field line is capped at three fields, and these are the fourth and
 * fifth facts the plate would carry if the cap were four and five. Both are
 * checkable. Neither is an invitation, so nothing on the first screen is
 * asking the reader for anything, which is the most defensible reading of a
 * gallery's front door. And two matched blocks either side of a centred
 * figure is the composition the centre axis actually wants.
 *
 * AGAINST. Five facts on a first screen is a datasheet, and a datasheet is
 * exactly what the project blocks were cut back from. Honouring the field cap
 * by putting the fourth and fifth facts in the corners honours its letter and
 * breaks its spirit. And it does not answer the brief: the owner asked for
 * something to call for action, and this calls for nothing.
 *
 * ── `bare` ── nothing, deliberately ───────────────────────────────────
 *
 * FOR. The corners are not a gap; they are the paper the figure stands on,
 * and paper is this site's ground rather than its background. Nothing in
 * them means nothing competes with the one thing the screen is for. It is
 * also the only candidate that cannot regress the first screen's paint,
 * cannot add a tap target over the figure, and needs no answer at all for
 * the phone, where there are no corners.
 *
 * AGAINST. The owner looked at the screen and asked for something there,
 * which is evidence about how it reads that no argument from composition
 * overrides. And the fold is genuinely ambiguous: the figure is cropped by
 * the bottom of the viewport, which reads as the end of a page rather than
 * the top of one.
 *
 * ── what is NOT here, and why ─────────────────────────────────────────
 *
 * A scroll cue. It was rejected once as redundant and is less redundant now
 * that the figure fills the lower centre — but a scroll cue belongs on the
 * centre axis, which is the one part of the lower screen that is not empty.
 * In a corner it is a cue pointing at nothing in particular. It is a
 * candidate for the composition and not for this issue.
 *
 * Social marks. The bar already carries GitHub and LinkedIn as pills, 50px
 * above these corners.
 *
 * A live count, a latest-shipped line, or anything else derived from
 * `data/projects.ts`. The count is already on the field line, and "latest
 * shipped" cannot be derived honestly: WindoM, the one project with real
 * users, carries no `when` field at all, so the newest year in the table
 * belongs to Bothy — the one entry with no product to open. A derived fact
 * that names the wrong project is worse than no fact.
 *
 * ── how all three sit on the composition ──────────────────────────────
 *
 * Out of flow, against `.composition`, which is the constraint that decides
 * the markup. The figure's grid track is sized by subtraction — it gets
 * whatever row 1 did not use — so anything added to row 1 shrinks the
 * photograph, and anything in row 2 that is taller than the track changes
 * the track. An absolutely positioned box contributes no height to either,
 * so these cannot move a line of type or a pixel of the figure however they
 * are sized. CLS is measured at 0.000 with them on; see `HeroCorners.module.css`.
 */

type Fact = { label: string; value: string };

/*
 * The one fact both candidates that use it agree on.
 *
 * Read from `data/site.ts` rather than written here: `currently` is a fact
 * with an expiry date and `replyWithin` is a promise, and both have to be
 * changeable in one place.
 */
const CURRENTLY: Fact = { label: "Currently", value: plate.currently };
const REPLIES: Fact = { label: "Replies", value: contact.replyWithin };

/*
 * A label over a value, as a description list.
 *
 * `dl` and not `ul`, and that is not a style preference: `HeroArrival.module.css`
 * selects the field line as "the only `ul` on this screen", so a second list
 * of that element would be animated as though it were the plate's specs and
 * would be hidden by the field line's own resting rule. A label-and-value
 * pair is what `dl` is for, so the correct element is also the one that does
 * not collide.
 */
function FactBlock({ label, value }: Fact) {
  return (
    <dl className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{value}</dd>
    </dl>
  );
}

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
  return (
    <div className={styles.ask}>
      <a
        className={styles.askLink}
        href="#contact"
        onClick={(e) => {
          if (scrollToAnchor("contact")) e.preventDefault();
        }}
      >
        Get in touch
      </a>
      {/* The bound, in the field line's voice, so the ask reads as a fact
          about how long an answer takes rather than as an inducement. */}
      <p className={styles.askBound}>{contact.replyWithin}</p>
    </div>
  );
}

type Slots = { start: ReactNode; end: ReactNode };

/*
 * The three candidates, side by side, as the one place the difference between
 * them is visible.
 *
 * A function rather than a module constant holding elements: an element built
 * at module scope is built whether or not it is rendered, and the point of
 * this table is to be read as a comparison rather than to be fast.
 */
function slotsFor(which: Which): Slots {
  switch (which) {
    case "ask":
      return { start: <Ask />, end: <FactBlock {...CURRENTLY} /> };
    case "facts":
      return { start: <FactBlock {...CURRENTLY} />, end: <FactBlock {...REPLIES} /> };
    case "bare":
      return { start: null, end: null };
  }
}

/**
 * `which` exists so the three candidates can be put side by side.
 *
 * The one caller in the application never passes it — `Hero` renders
 * `<HeroCorners />` and the default is the flag in `heroFirstScreen.ts`. It is
 * here because this component is a proposal with three branches, and a
 * comparison that cannot render two of them without reloading the page is a
 * comparison the test suite cannot make either. It goes when the flag goes.
 */
export default function HeroCorners({ which = heroCorners }: { which?: Which }) {
  const slots = slotsFor(which);

  /*
   * `bare` renders nothing at all rather than two empty boxes. An empty
   * positioned box is invisible and still a thing the next reader of this
   * file has to prove is harmless.
   */
  if (slots.start === null && slots.end === null) return null;

  return (
    /*
     * `data-hero-corners` is the hook the arrival stylesheet animates on and
     * the attribute a screenshot run can assert it is looking at the right
     * candidate. The container takes no pointer events so that an invisible
     * box over the paper cannot eat a drag or a text selection; the one
     * thing inside it that is a control takes them back.
     */
    <div className={styles.corners} data-hero-corners={which}>
      <div className={styles.start}>{slots.start}</div>
      <div className={styles.end}>{slots.end}</div>
    </div>
  );
}
