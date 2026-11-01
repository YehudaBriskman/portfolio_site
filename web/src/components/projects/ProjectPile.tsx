import { Fragment, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import Plate from "@/components/projects/Plate";
import Shot from "@/components/projects/Shot";
import { arrival, newestYear } from "@/components/projects/pileArrival";
import type { ProjectEntry } from "@/hooks/useProjects";
import styles from "@/components/projects/ProjectPile.module.css";
import { objectAnchorId } from "@/lib/objectAnchor";

/*
 * The work, stacked up.
 *
 * This is the peak of the page and it replaced a shelf — six cards in a
 * horizontal snap scroller, tilted in 3D, with arrows and a position
 * indicator under them. The shelf was not broken. It was one of three
 * maximum-effort moments on one page, and three peaks is none: the reader
 * arrived at it having already been shown a smoke hero and a splat
 * generator, and a horizontal scroller is a device that asks to be operated
 * rather than one that happens to you. What it could never do, however well
 * it was built, was say anything about *quantity* — a shelf shows you one
 * card at a time by design, so six projects read as six separate glances.
 *
 * A pile reads as six. The cards do not hand over; they accumulate, each one
 * stopping short of covering the last, and what is on screen at the end of
 * the section is the whole body of work with four or six visible edges to
 * it. That is the sentence this section exists to earn — the work stacks up
 * and you can feel the weight of it — and it is a thing a pile can say and a
 * carousel cannot.
 *
 * ── what this component actually does ─────────────────────────────────────
 *
 * Almost nothing, and that is deliberate. It wraps each project in a slot and
 * tells the slot what it cannot work out for itself: where it sits in the
 * pile, what colour the work is, and the shape of its own arrival. Everything
 * that moves is in the stylesheet, because all three of the conditions that
 * have to switch the motion off are at-rules — a media query, a support query
 * and a class on `document.body` — and not one of them can be expressed in an
 * inline style or a Tailwind utility. There is no state, no ref, no observer
 * and no scroll listener; the pinning is layout and the arrival is a view
 * timeline, both of which the compositor resolves without this file being
 * involved.
 *
 * The arrival is per project and not per slot. Each card comes in the way its
 * own work stands — the state picks the gesture, the year picks how much of it
 * is left to play — which is five custom properties the stylesheet's one
 * keyframe reads. The derivation and the sentence it is answerable to are in
 * `projects/pileArrival.ts`, including the reason three of the six projects
 * come out identical and why no field was invented to separate them.
 *
 * The two traps that cost a rebuild each — that a scroll-driven animation
 * ignores delay and duration, and that a pinned element's view timeline
 * freezes the moment it pins — are documented at the top of
 * ProjectPile.module.css, next to the declarations that are answerable to
 * them.
 *
 * ── the markup, and why it is this shape ──────────────────────────────────
 *
 * An ordered list of links. Ordered because the order is content: the things
 * in use come first and the 2024–25 work follows, which is the same sort
 * every other view of this data uses. A list because a reader who never sees
 * the pile — reduced motion, a paused page, a browser without scroll-driven
 * animation — still gets every project, in order, with nothing hidden; that
 * is the whole fallback story in one element choice.
 *
 * And exactly one link per card, wrapping the entire object. The card this
 * replaced put the screenshot in a decorative anchor and a `The detail`
 * button at its foot, which is a 400px object offering a 120px target and
 * announcing one destination twice. Here the link's accessible name is the
 * label — the name, the fact and the fields — so a screen reader's link list
 * reads as a catalogue rather than as six rows of "The detail". The
 * screenshot carries `alt=""` for the same reason: it is the object the label
 * is labelling, not a second description of it, and `WindoM screenshot`
 * ahead of `WindoM` is noise that the sighted reader is not being given.
 *
 * There is nothing else interactive inside a card, by rule. The live site and
 * the repository both live on the detail page one rank down, where they
 * already were — two outbound links on the first thing a reader sees is the
 * documented reason the detail pages never got any traffic.
 */

export type ProjectPileProps = {
  entries: ProjectEntry[];
  /**
   * The accessible name of the list.
   *
   * Required rather than defaulted: the home page's pile is four of however
   * many there are and the catalogue's is all of them, and two lists on one
   * site that both announce themselves as "Projects" is the failure this prop
   * exists to prevent.
   */
  label: string;
  /**
   * What heading level an object's name is set at.
   *
   * The name is the object's heading in the document, and its rank depends on
   * what the page put above the pile — which only the page knows. The home
   * page has an `h2` section head over it so the cards are `h3`; the
   * catalogue's only heading is its own `h1`, so an `h3` there would skip a
   * level and leave a reader navigating by headings wondering what they had
   * missed.
   */
  heading: "h2" | "h3";
  /**
   * The first card is above the fold on the catalogue page, where its
   * screenshot is the LCP element and must not be lazy. On the home page the
   * pile is two screens down and nothing here should be eager.
   */
  eagerFirst?: boolean;
};

/**
 * How wide a card's screenshot renders, as a hint to the browser.
 *
 * Wrong here means the wrong file downloads, which is the one thing this
 * cannot be casual about. Above 860px the card is a two-column object inside
 * the 1072px measure and the picture takes 1.32 of 2.32 of it, less the
 * plinth's padding — about 600px. Below that it is the full card, which is the
 * column less its gutters. Asking for `100vw` at the top would hand a phone
 * the 1600px rung for a picture 350px across, which is the exact mistake
 * `lib/projectImage.ts` was written to end.
 */
const SHOT_SIZES = "(min-width: 860px) 600px, (min-width: 640px) 88vw, 92vw";

/** Four of the stack, and no more. See the note at the call site below. */
const PLATE_TECH = 4;

export default function ProjectPile({
  entries,
  label,
  heading,
  eagerFirst = false,
}: ProjectPileProps) {
  if (entries.length === 0) return null;

  /*
    The one fact about the pile that no single card can know: which of them is
    the most recent. An arrival's amplitude is measured against it, so it is
    read once here rather than recomputed per row — and deliberately not
    memoised, because it is a loop over at most eight strings and a `useMemo`
    would cost more to read than it saves.
  */
  const newest = newestYear(entries);

  return (
    /*
      `--pile-n` is the one thing the stylesheet cannot work out for itself,
      and the only reason it needs it: the step between one card's pin offset
      and the next is derived from the count so that eight projects share the
      same total depth four do, rather than walking the last card down under
      the nav bar. A number and not a length, so the calc can divide by it.
    */
    <ol
      className={styles.rail}
      aria-label={label}
      style={{ "--pile-n": entries.length } as CSSProperties}
    >
      {entries.map((entry, i) => {
        const { collection: c } = entry;

        return (
          <Fragment key={c.slug}>
            {/*
              The index's anchor, and the thing it watches, kept out of the
              sticky box on purpose.

              The slot below is `position: sticky`, so from the moment it pins
              its rectangle stops moving and every slot in the pile reports the
              same geometry. The chrome finds the current object with a point
              probe under the bar (see `nav/useCollectionIndex.ts`), so with
              the id on the slot that probe resolved to the first project for
              the whole act — an audit measured the marker stuck on WindoM
              across 3900px while three other cards came and went on screen.

              This marker is a zero-height sibling that never pins, so it
              passes under the probe exactly when its card arrives. It also
              makes a better jump target than the slot did: landing here puts
              the reader where the card enters rather than where it is parked.

              `aria-hidden` keeps the list reporting four objects rather than
              eight; the marker is addressable by id and by nothing else.
            */}
            <li
              id={objectAnchorId(c.slug)}
              className={styles.marker}
              aria-hidden="true"
            />
            <li
            key={c.slug}
            /*
              The plate's own id, so the chrome's index has something to jump
              to. The spelling is `lib/objectAnchor` and never a literal at
              either end — a hardcoded `#object-windom` in the bar against an
              `id="windom"` here is exactly the drift that helper exists to
              make impossible.

              Worth knowing before anyone tries to make the index track each
              card separately: while the pile is pinned all of its slots share
              one geometry, so a point probe under the bar resolves to the
              same slot for the whole act and the first object stays marked
              through it. That is honest — the reader *is* inside Work — and
              making it per-card would mean giving every card its own scroll
              extent, which is the pile.
            */
            className={styles.slot}
            /*
              Three things per slot, and all of them belong here rather than
              in the stylesheet.

              `--pile-i` is the slot's position, which decides where it pins
              and where a focused card scrolls to. It is written out rather
              than left to `nth-child` because the stylesheet would then need
              one rule per possible position and the count is not fixed —
              four on the home page, six in the catalogue, however many the
              CMS has tomorrow. It is also the *only* index-shaped value here:
              nothing about how a card moves is derived from it, because a
              position in a list is a fact about the list.

              `--pile-tint` is the colour of the work itself, sampled from the
              project's own screenshot (see `ProjectTint` in data/projects.ts).
              This is the only colour on the page that is not a token, and
              that is the gallery's whole argument about colour: white walls,
              coloured paintings. A project with no sampled colour is left to
              the neutral the stylesheet falls back to rather than being
              assigned a hue it has not got.

              The five `--arrive-*` properties are the card's own arrival,
              derived from its state and its year. They are set on the slot
              rather than on the card because custom properties inherit and
              the slot is already the one element this file styles — the
              keyframe that reads them is on the card. A card that somehow
              receives none of them still animates: the keyframe carries the
              old uniform arrival as its fallbacks.
            */
            style={
              {
                "--pile-i": i,
                ...(entry.tint ? { "--pile-tint": entry.tint.join(" ") } : {}),
                ...arrival(entry, newest),
              } as CSSProperties
            }
          >
            <Link to={`/projects/${c.slug}`} className={styles.card}>
              <div className={styles.shot}>
                {c.coverImage ? (
                  <Shot
                    src={c.coverImage}
                    /* Empty, not `${c.title} screenshot`. The label beside it
                       is the object's description and this anchor's accessible
                       name is built from it; a second one would be announced
                       first and say less. */
                    alt=""
                    sizes={SHOT_SIZES}
                    eager={eagerFirst && i === 0}
                  />
                ) : (
                  /*
                    Four of the stack, and no fact line.

                    `Plate` grows to fit what it is given, and a card in the
                    pile is a fixed height — Bothy's eight entries are four
                    mono rows plus a heading, which overflows the box and gets
                    sheared off mid-row. Four is two rows and fits at every
                    width this card is drawn at. The fact line is not passed
                    because it is set six millimetres away on the plinth, and
                    a stand-in for a photograph that repeats the label next to
                    it is the same mistake twice.
                  */
                  <Plate
                    className={styles.plate}
                    title={c.title}
                    tech={entry.tech.slice(0, PLATE_TECH)}
                  />
                )}
              </div>

              <div className={styles.plinth}>
                <span className={styles.onward} aria-hidden="true">
                  &rarr;
                </span>
                {/*
                  Every object on this site is labelled through here, at one
                  of three scales and with no per-section variant — see the
                  note in `gallery/ObjectLabel.tsx`. `object` is the working
                  scale, the one a project in the pile and a note on the shelf
                  share, and the pile does not get to pick a different one.
                */}
                <ObjectLabel
                  name={c.title}
                  fact={c.tagline}
                  fields={entry.fields}
                  scale="object"
                  nameAs={heading}
                  className={styles.label}
                />
              </div>
            </Link>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
