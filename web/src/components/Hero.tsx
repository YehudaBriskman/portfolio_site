import ObjectLabel from "@/components/gallery/ObjectLabel";
import type { LabelField } from "@/components/gallery/objectLabel";
import { useStagedArrival, type ArrivalStage } from "@/components/motion/useStagedArrival";
import { projects } from "@/data/projects";
import { plate } from "@/data/site";
import styles from "@/components/Hero.module.css";
import arrival from "@/components/HeroArrival.module.css";
import "@/components/hero-chrome.css";

/*
 * The first screen: one composed picture, assembled in four moves.
 *
 * The idea the whole page hangs on
 * --------------------------------
 * Two rules were pulling against each other. The gallery grammar says the
 * collection starts at the top of the page — object one already in view,
 * already labelled, with no separate title treatment — and the hero world is
 * typographic, where type is the imagery and scale contrast does every job a
 * photograph would have done. The resolution is this:
 *
 *     the name is object zero, labelled in exactly the same schema as the work.
 *
 * A museum does not open with a slogan. It opens with a plate by the door, set
 * in the same type as every label inside, telling you whose collection this is.
 * So this file renders no label of its own: it hands three strings to the same
 * `ObjectLabel` the projects and the notes go through, at the one scale that is
 * allowed to be bigger. There is no variant prop to reach for and that absence
 * is the point — the first exception granted to one section is the moment the
 * page becomes a grid of unrelated things again.
 *
 * What the screen used to carry, and why none of it is here
 * ---------------------------------------------------------
 * **"Built to be used."** A tagline, set in the second voice, at 2.6rem. The
 * label schema is fact and not pitch, and the fact line that replaces it —
 * "Full-stack, mostly frontend" — is checkable in a way the tagline never was.
 * The two paragraphs under it went with it: they were the same argument made
 * three times, and the work below makes it better than any sentence can.
 *
 * **The two action pills.** "See the work" was the one deliberate entry point
 * the first screen had, and it was a button telling a reader to do the thing
 * they are already doing. The chrome keeps the three destinations the site
 * actually has, /projects among them, and scrolling needs no affordance.
 *
 * The portrait, and the argument it had to answer
 * -----------------------------------------------
 * It was taken off this screen once, on a good argument: a plate is type, and
 * a headshot *beside* a plate does not read as object zero's label — it reads
 * as the thing the label is for, and then the plate is a caption and the
 * person is the exhibit. What settles it is that the photograph is not beside
 * the type here. It is behind it, dissolving into the paper exactly where the
 * name crosses it, so the two are one picture rather than a picture and its
 * caption. The relationship the old objection was about does not exist in
 * this composition.
 *
 * It is not a photograph any more. The owner's brief was that neither his face
 * nor the room behind him may be legible, and what is served is a halftone
 * figure: a hand-traced silhouette filled with a screened ink density, so the
 * room is gone with the background and the face is gone with the dot grid.
 * `docs/hero-portrait/build.sh` is the whole derivation and the reasoning for
 * each step; the short version is that the cell is coarse relative to an eye.
 *
 * It costs one request, 44kB of WebP that the notes byline already wanted in
 * the cache, and no layout at all: the figure is out of flow, so it cannot
 * move a single line of type whatever it does.
 *
 * The arrival, and the one thing it must not cost
 * -----------------------------------------------
 * Four stages, in order, each waiting on the one before: the name a letter at
 * a time from above, then the figure from below, then the bar from above,
 * then the two remaining lines from their own sides. `useStagedArrival` owns
 * the waiting and `HeroArrival.module.css` owns the gestures; the reason they
 * are two files is that one is a statement about order and the other is a
 * statement about distance and duration.
 *
 * The constraint underneath all of it: **the ink is painted on frame one.**
 * The previous reveal started the `h1` at `opacity: 0`, which takes the
 * largest text on the first screen out of the running as a paint candidate
 * for the length of the animation, and fixing that put LCP at 112-160ms. A
 * letter that fades in reintroduces precisely that bug. So nothing on this
 * screen enters by its own opacity: the glyphs and the photograph are both
 * painted at full strength in the first frame and a paper-coloured mask is
 * moved off them. Measured either side of the change, LCP went 136ms →
 * 132ms at 1440×900 and 116ms → 120ms at 390×844, with CLS 0.000 at both —
 * see the notes in `HeroArrival.module.css`, which is where the masks are
 * and therefore where that argument has to be readable.
 */

/*
 * How much of the collection a stranger can open right now.
 *
 * Derived, never typed. The plate says a number out loud, and the one thing
 * worse than not saying it is saying one that stopped being true — so it is
 * counted from the table that would have to change for it to be wrong.
 *
 * "Live" means there is a URL you can click, which is why the test is `link`
 * and not the `state` string: five of the six entries have a product you can
 * open, and Bothy — self-hosted, with only a repository to point at — is
 * honestly not one of them. The phrasing matters as much as the count. "In use"
 * would have been a claim about other people's habits that exactly one project
 * in the table can support; "live" is a claim a reader can check by clicking.
 *
 * Counted off the seed table rather than through `useProjects`, which is the
 * deliberate tradeoff: the hook can only answer after a request, and a plate
 * that fades a number in a moment after the page has settled is worse than one
 * that reads from the floor under the hook. The seeds are that floor, and the
 * `Collection` shape the hook returns does not carry a project's state anyway.
 */
const liveCount = projects.filter((p) => Boolean(p.link)).length;

/*
 * The field line, and why it is in this order.
 *
 * Written as `where`, `count`, `when`, and rendered in whatever order the
 * schema puts those kinds in — `ObjectLabel` sorts by kind, so this list is a
 * set of facts and not a layout. The place is first because it is the field
 * that still says something when the line is cropped, which is how a field line
 * spends most of its life.
 *
 * Three fields, which is the cap. A fourth makes a datasheet, and a datasheet
 * is what the project blocks were before they were cut back to this.
 */
const PLATE_FIELDS: LabelField[] = [
  { kind: "where", value: plate.where },
  { kind: "count", value: `${liveCount} live` },
  { kind: "when", value: `Shipping since ${plate.shippingSince}` },
];

/*
 * The order, and what each step is waiting for.
 *
 * A module constant rather than a value built in the render, because it is
 * the identity the sequencer's effect depends on: rebuilt every render, it
 * would tear down and re-arm the listener on every state change.
 *
 * Each selector names the element whose animation finishing *is* that stage
 * finishing, which in every case is the last one to start:
 *
 *   name      the last letter of the name, marked by `splitName`
 *   portrait  the mask over the figure, which outlasts the figure's own rise
 *   chrome    the bar itself, which is not in this component's tree at all
 *   text      nothing — it is last, and nothing waits for it
 *
 * `header[data-material]` is the one selector here that reaches outside this
 * file's own markup, and it is the same hook `hero-chrome.css` animates on:
 * the stylesheet and the sequencer have to be talking about the same element
 * or the step waits for something that never moves. It is an attribute the
 * nav already renders for its own dark-act switch, so nothing was added to
 * `Nav.tsx` to make this possible — and if it ever stops being rendered, the
 * seatbelt in `useStagedArrival` finishes the sequence rather than stalling
 * it, and the bar is left where the chrome stage's `:not()` guard leaves it,
 * which is visible.
 */
/*
 * The one loading hint the figure needs, spelled the way React 18 will pass
 * on.
 *
 * `fetchPriority` — the camel-cased prop @types/react offers — is dropped by
 * React 18's DOM renderer with a console warning rather than written to the
 * element, so the attribute never reaches the preload scanner. Lowercase
 * attributes it does not recognise are forwarded untouched, which is the
 * whole of this constant. It can go back to being a plain prop on React 19.
 */
const PRIORITY: { fetchpriority: "high" } = { fetchpriority: "high" };

const ARRIVAL_STAGES: readonly ArrivalStage[] = [
  { name: "name", endsWith: "[data-letter-last]" },
  { name: "portrait", endsWith: "[data-portrait-mask]" },
  { name: "chrome", endsWith: "header[data-material]" },
  { name: "text" },
];

export default function Hero() {
  const arrived = useStagedArrival({ stages: ARRIVAL_STAGES, publishAs: "heroArrived" });

  return (
    /*
      `overflow-x: clip` and not `hidden`: the two remaining lines enter from
      their own sides, and a horizontal entry is the one gesture
      `docs/motion-contract.md` §5 bans outright — because the deleted
      `Reveal` pushed full-width sections past the right edge of the document
      and the page reported horizontal overflow until the reader scrolled
      that far. The travel here is 18px inside a gutter that is never less
      than 20px, so nothing reaches the edge; this is the guard that makes
      that a property of the section rather than an arithmetic coincidence.
      `clip` leaves the block axis alone, so the section is still a normal
      scrolling box and nothing inside it becomes a scroll container.
    */
    <section id="hero" className={`relative w-full ${styles.hero}`}>
      {/*
        `pt-28` is nav clearance, not rhythm: the island is fixed, 50px tall
        and 18px down, so the first line has to start below 68px.

        `safe center` rather than plain centring, which overflows in both
        directions the moment the content is taller than the screen — and the
        half above the top edge cannot be scrolled to. `safe` is the keyword for
        exactly this: centre while there is room, fall back to the start edge
        once there is not. A browser that does not know it drops the whole
        declaration and lands on flex-start, which is the same fallback.

        This box is the screen. The picture inside it is one flex item, and
        the figure is positioned against *that* rather than against the
        screen — which is the difference between a composition and two things
        that happen to be on the same page. Anchored to the viewport, the
        figure drifts away from the type on every window the layout was not
        tuned on: at 768×1024 it ends up a photograph in the bottom corner
        with a headline a third of a screen above it.
      */}
      <div className={`wrap flex min-h-[100svh] flex-col ${styles.screen}`}>
        {/*
          The picture: the figure and the label, in one box the height of the
          label. `data-arrived` is the sequence's clock and it is here
          because it has to be an ancestor of both halves.
        */}
        <div className={`${styles.composition} ${arrival.stage}`} data-arrived={arrived}>
          {/*
            The figure, out of flow and underneath the type.

            Out of flow is not a layout convenience: it is why this screen's
            CLS is still 0.000 with a photograph on it. An absolutely
            positioned box contributes no height to anything, so the figure
            cannot move a line of type however it is sized, and the
            `width`/`height` attributes below mean the box is the right shape
            before the bytes arrive.

            `fetchpriority="high"` because it is painted in the first frame —
            see the mask note in `HeroArrival.module.css`. Left at the
            default, the preload scanner finds it and the browser still ranks
            it below the stylesheet and the two webfonts, which is the right
            order for an image nobody sees for a second and the wrong one for
            a paint candidate.
          */}
          <div className={styles.portrait} data-portrait="">
            <picture>
              {/* The 365px file below the type rung's breakpoint, which is
                  also where the figure stops being a third of the screen's
                  width. Serving the 551px original there is 17kB spent on a
                  box that is never wider than 242 CSS pixels. */}
              <source media="(max-width: 699px)" srcSet="/img/yehuda-cut-sm.webp" />
              <img
                src="/img/yehuda-cut.webp"
                alt="Yehuda Briskman: a cut-out photograph from the waist up, in round sunglasses and a pale T-shirt, a bag strap across one shoulder, looking off to the side."
                width={551}
                height={845}
                {...PRIORITY}
                decoding="async"
              />
            </picture>
            {/* The paper the figure rises out from behind. Decorative in the
                strictest sense — it is the absence of the picture — so it is
                hidden from the accessibility tree and cannot be pointed at. */}
            <span className={arrival.mask} data-portrait-mask="" aria-hidden="true" />
          </div>

          {/*
            Four parts of one picture, four arrivals, and the order between
            them is the sequence above rather than four delays that land in
            it. `HeroArrival.module.css` carries the reasoning for each
            gesture; the short version is that the name falls a letter at a
            time from above, the figure rises from below once the name is
            whole, the bar drops from above once the figure has, and the fact
            line and the field line come in from their own sides last.

            This used to be one reveal on the group, 60ms apart in reading
            order, and then three devices keyed to what kind of statement each
            part is. Both were right for a plate alone on paper. Neither is an
            answer to a composed screen, where the question is not how each
            part differs but what order the picture assembles in.

            `splitName` is the one new hook this needed from the shared label:
            a `transform` does nothing to a non-replaced inline box, so the
            letters have to be elements before anything can move them. It is
            off for every other object on the site, as `exposeFieldKinds` is —
            which writes each field's kind onto its `<li>` so the off-switches
            can be written against the kind rather than against the position
            `orderFields` happens to sort it into.
          */}
          <ObjectLabel
            scale="plate"
            nameAs="h1"
            name={plate.name}
            fact={plate.fact}
            fields={PLATE_FIELDS}
            exposeFieldKinds
            splitName
            className={styles.plate}
          />
        </div>
      </div>
    </section>
  );
}
