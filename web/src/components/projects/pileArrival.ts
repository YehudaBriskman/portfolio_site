import { stateKey } from "@/content/schema";

/*
 * How a card joins the pile, derived from the work it labels.
 *
 * ── the relationship, in one sentence ─────────────────────────────────────
 *
 * A CARD ARRIVES THE WAY ITS WORK STANDS TODAY: its state chooses the gesture
 * — something in daily use is still being set down, something open for anyone
 * to take swings square on a hinge, something shipped and left running comes
 * to rest from above — and its age chooses how much of that gesture is left to
 * play, so the newest work travels the full distance and the oldest is nearly
 * home before it starts.
 *
 * Both halves of that are facts already printed on the card. The label's field
 * line reads `In use · React 19 · Chrome Web Store` or `Archive · React · 2025`,
 * so the motion and the type are saying the same thing in two channels, and a
 * reader who never decodes the first one has still been told by the second.
 * That is the whole licence for varying the arrival at all. A stagger keyed on
 * the slot's index would look like this and mean nothing, because an index is
 * a fact about the list and not about the work.
 *
 * ── what it deliberately does not distinguish ─────────────────────────────
 *
 * Programming with Yehuda and Icaros come out identical, and that is the
 * finding rather than a gap in it. On every fact this table records they *are*
 * identical: both are `Archive` learning projects, both are 2025, and both are
 * built out of the same four things. Giving them two different arrivals would
 * be inventing two different projects, which is the failure the per-card rule
 * exists to prevent — so the pile says what the data says, which is that the
 * reader is looking at a matched pair. The difference the reader does get is
 * real: two recent things each shaped like itself, then a pair that arrives as
 * a pair.
 *
 * No field was added to `data/projects.ts` to break that tie. The only values
 * that would have separated those two are `order`, which is the index under
 * another name, and `tint`, which is what the work looks like and not how it
 * stands — and a colour mapped onto a distance is decoration wearing a fact's
 * clothes.
 *
 * ── why this is a module and not a stylesheet ─────────────────────────────
 *
 * The stylesheet owns one `@keyframes pile-arrive` and that keyframe reads five
 * custom properties; this file is the only thing that writes them. Three
 * consequences, all of them load-bearing:
 *
 *  - The keyframe name stays a bare identifier, so CSS Modules can still scope
 *    it. The documented trap is a keyframe *name* reached through `var()`,
 *    which survives the bundler's rewrite and then names nothing; what is in
 *    `var()` here is a length, an angle and a number. Values, never names.
 *  - The three off-switches do not grow with the project count. They cancel
 *    one animation name, exactly as they did when every card arrived the same
 *    way, because the variation is in properties the cancelled animation was
 *    the only reader of. A card with the animation off keeps `transform: none`
 *    from its own rule whatever these five values say.
 *  - There is no per-card `animation-range`, which is the only other way to
 *    make N cards differ and is the one the motion contract bans: ranges are
 *    the clock, and shifting the clock per card is a stagger.
 *
 * Nothing here measures anything or runs per frame. It is four numbers and a
 * pair of origin keywords, resolved once at render.
 */

/**
 * The two facts an arrival is derived from.
 *
 * Structural rather than `ProjectEntry`, which satisfies it: the derivation is
 * a pure function of a state and a year, and typing it against the hook's
 * return shape would tie it to notes, decisions and repository stats it has no
 * business reading.
 */
export type Standing = {
  /** The short state label — `In use`, `Open source`, `Live`, or a release tag. */
  readonly state: string;
  /** Four digits, or `null` for a collection with no seed to date it. */
  readonly year: string | null;
};

/** The five custom properties `@keyframes pile-arrive` reads off the slot. */
export type ArrivalVars = {
  readonly "--arrive-origin": string;
  readonly "--arrive-lift": string;
  readonly "--arrive-tip": string;
  readonly "--arrive-swing": string;
  readonly "--arrive-shrink": string;
};

/**
 * One gesture: the edge the card hinges from, and how far from rest it starts.
 *
 * Every value is signed so that the moving part of the card travels *away*
 * from the reader and never toward them, and `shrink` is never above 1. That
 * is not a style preference. Under the slot's 1500px perspective, anything
 * that brings a corner forward projects wider than the card's own layout box —
 * a `rotateX` hinged at the top edge, or a scale above 1 — and a 1072px card
 * growing 11% inside a 1072px measure is horizontal overflow on the document,
 * which is the one failure the motion contract bans outright. Receding corners
 * foreshorten inward and can only ever be narrower.
 */
type Gesture = {
  /** `transform-origin`, as a pair of percentages. The hinge. */
  readonly origin: string;
  /** `translateY` at the start, in px. Positive is from below, negative from above. */
  readonly lift: number;
  /** `rotateX` at the start, in deg. Positive tips the top edge back. */
  readonly tip: number;
  /** `rotateY` at the start, in deg. Positive swings the right edge back. */
  readonly swing: number;
  /** `scale` at the start. Never above 1 — see the note on `Gesture`. */
  readonly shrink: number;
};

/*
 * Something people depend on today, so it is still being set down: the card
 * comes up from well below its slot and the top edge rolls down flat onto the
 * pile, hinged on its own bottom edge. The biggest, slowest-looking arrival in
 * the section, which is the right shape for the only work on the page that
 * someone is using while the page is being read.
 *
 * Twenty degrees and not more, and the reason is in the stylesheet: the slot's
 * perspective is 1500px *because* of this number. A longer lean needs a longer
 * lens or it reads as a page turning rather than as a sheet being laid down.
 */
const PLACED: Gesture = { origin: "50% 100%", lift: 112, tip: 20, swing: 0, shrink: 0.86 };

/*
 * Work that was handed over and that anyone can open, so the card arrives on a
 * hinge: pinned at its leading edge with the far edge still swung back,
 * squaring up to face the reader as it lands. It barely rises at all, because
 * the gesture is the turn and a card doing both reads as neither.
 *
 * Sixteen degrees across 1072px throws the far edge 295px back, which is a
 * sixth off its projected width — plainly a swing and still short of the
 * full-blown page turn that a rotation this wide gets to very quickly.
 */
const OPENED: Gesture = { origin: "0% 50%", lift: 22, tip: 0, swing: 16, shrink: 0.94 };

/*
 * Shipped, standing, nobody's hand on it — so the card comes to rest rather
 * than arriving. It starts *above* its slot and hangs from its top edge with
 * its foot swung back, then drops the last of the way and flattens.
 *
 * The sign of `lift` is the whole gesture and it is worth being explicit about
 * what the reader sees. Scrolling down carries a card up the screen; a
 * negative lift decaying to zero moves it back down by that much over the same
 * stretch, so the card lags the scroll and decelerates into its place. The
 * positive lift of `PLACED` does the opposite and hurries into it. One is work
 * still arriving and the other is work that has already finished arriving,
 * which is exactly the difference between `In use` and `Live`.
 */
const SETTLED: Gesture = { origin: "50% 0%", lift: -58, tip: -13, swing: 0, shrink: 0.92 };

/**
 * The gesture a state gets.
 *
 * Matched on substrings and lowercased, because `state` is not an enum: a seed
 * authors it, and for a published collection with no seed `useProjects` falls
 * back to a release tag or to `Archive`. Anything this cannot recognise gets
 * `SETTLED`, which is the quietest of the three and the only honest default —
 * a card the table cannot describe should not be given the biggest arrival in
 * the section on the strength of a string nobody has read.
 */
function gestureFor(state: string): Gesture {
  const s = stateKey(state);
  if (s === "in-use") return PLACED;
  if (s === "open-source") return OPENED;
  return SETTLED;
}

/*
 * How much of the gesture is left to play, by age.
 *
 * One step of 0.3 per year behind the newest project in the pile, and the ramp
 * stops after two: 1.0, 0.7, 0.4, and 0.4 for anything older. It stops because
 * the floor has to stay visible — a card at 0.1 of its gesture is a card that
 * failed to animate, and "this is old" is not worth saying by appearing
 * broken. Two steps is also as much as this table can currently express, since
 * the oldest thing in it is two years behind the newest.
 *
 * Relative to the newest entry rather than to the calendar, so the section
 * needs no notion of today and reads the same in a year's time. The question
 * it answers is "how recent is this, among the work on display", which is the
 * question the pile is putting to the reader anyway.
 */
const AGE_STEP = 0.3;
const AGE_SPAN = 2;

/**
 * The newest year in a pile, or `null` when nothing in it carries one.
 *
 * Computed over the whole set rather than per card, so one call site at the top
 * of the list is the only place it happens. Four digits, parsed strictly:
 * `year` is a string because it is printed, and a value that is not a year is
 * better ignored than silently read as `NaN` and then as the oldest thing in
 * the section.
 */
export function newestYear(entries: readonly Standing[]): number | null {
  let newest: number | null = null;
  for (const e of entries) {
    if (!e.year || !/^\d{4}$/.test(e.year)) continue;
    const y = Number(e.year);
    if (newest === null || y > newest) newest = y;
  }
  return newest;
}

/**
 * How far behind the newest entry this one is, as a share of its gesture.
 *
 * A card with no year, or one in a pile where nothing has a year, gets the
 * middle of the ramp. That is the only value available that is not a claim:
 * the full gesture would assert the work is the newest in the section and the
 * floor would assert it is the oldest, and the table has said neither.
 */
function ageFactor(year: string | null, newest: number | null): number {
  if (newest === null || !year || !/^\d{4}$/.test(year)) return 1 - AGE_STEP;
  const behind = Math.min(Math.max(newest - Number(year), 0), AGE_SPAN);
  return 1 - AGE_STEP * behind;
}

/* Trailing zeros off, so the style attribute reads as the numbers above rather
   than as `112.0px` and `0.860`. `Number(x.toFixed(n))` is the whole trick. */
function px(v: number): string {
  return `${Number(v.toFixed(1))}px`;
}

function deg(v: number): string {
  return `${Number(v.toFixed(1))}deg`;
}

/**
 * The five custom properties for one card.
 *
 * `shrink` scales toward 1 rather than toward 0, which is the one place the age
 * factor cannot simply be a multiplier: the rest state of a scale is 1, so what
 * the factor attenuates is the distance from it. Getting that wrong gives the
 * oldest card the smallest start instead of the smallest journey, which is the
 * relationship backwards.
 */
export function arrival(entry: Standing, newest: number | null): ArrivalVars {
  const g = gestureFor(entry.state);
  const f = ageFactor(entry.year, newest);

  return {
    "--arrive-origin": g.origin,
    "--arrive-lift": px(g.lift * f),
    "--arrive-tip": deg(g.tip * f),
    "--arrive-swing": deg(g.swing * f),
    "--arrive-shrink": String(Number((1 - (1 - g.shrink) * f).toFixed(3))),
  };
}
