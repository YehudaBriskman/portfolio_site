import ObjectLabel from "@/components/gallery/ObjectLabel";
import type { LabelField } from "@/components/gallery/objectLabel";
import { projects } from "@/data/projects";
import { plate, plateTitle } from "@/data/site";
import HeroCorners from "@/components/HeroCorners";
import styles from "@/components/Hero.module.css";
import arrival from "@/components/HeroArrival.module.css";

/*
 * The first screen: one composed picture, assembled in four moves.
 *
 * The idea the whole page hangs on
 * --------------------------------
 * Two rules were pulling against each other. The gallery grammar says the
 * collection starts at the top of the page — object one already in view,
 * already labelled, with no separate title treatment — and the hero world is
 * typographic, where type is the imagery and scale contrast does every job a
 * photograph would have done. The resolution was this:
 *
 *     the name is object zero, labelled in exactly the same schema as the work.
 *
 * A museum does not open with a slogan. It opens with a plate by the door, set
 * in the same type as every label inside. So this file renders no label of its
 * own: it hands three strings to the same `ObjectLabel` the projects and the
 * notes go through, at the one scale that is allowed to be bigger. There is no
 * variant prop to reach for and that absence is the point — the first
 * exception granted to one section is the moment the page becomes a grid of
 * unrelated things again.
 *
 * WHAT ISSUE #100 CHANGES ABOUT THAT SENTENCE, AND WHAT IT DOES NOT
 * -----------------------------------------------------------------
 * The `h1` says PORTFOLIO, set very large. The owner was offered that and
 * EXPLORE MY PORTFOLIO, both built and rendered against the name `main` set
 * here before, and picked the first; the other two are gone rather than
 * switched off.
 *
 * The half of the sentence above that survives is the half that was doing the
 * work. The collection still names itself through the same `ObjectLabel`, in
 * the same three-part schema, at the same one scale allowed to be bigger, with
 * no variant prop — every word of that is still true and is still the reason
 * this file has no label of its own.
 *
 * The half that does not survive is "the name". PORTFOLIO is not a name, it is
 * a category: the plate by the door stops saying whose collection this is and
 * says that this is a collection. That is a weaker thing to say and it is also
 * a more useful one — a stranger who lands here learns what the site is before
 * they learn who it is by — and it is the owner's call to make. What this file
 * may not do is keep asserting the old sentence while rendering the new one.
 *
 * So object zero is still object zero and is still labelled in the work's own
 * schema. What it is the label *of* has changed: it labels the collection
 * rather than the person, and the person moved one line down. Which is the
 * next note.
 *
 * WHERE THE NAME WENT
 * -------------------
 * Into the fact line, as its subject: "Yehuda Briskman — full-stack, mostly
 * frontend". The `h1` is the page's accessible name and its strongest on-page
 * signal, so the name could not simply leave it; the label schema's second
 * slot is "what the thing is", which is exactly the slot a category label
 * leaves unanswered. The string is assembled in `data/site.ts` from
 * `plate.name`, so the name is still written in the repository exactly once.
 *
 * The cost, stated rather than hidden: the name goes from display type — the
 * h1 is 158px at 1440x900, measured in the DOM — to 18px of the accent face. What makes that survivable is that
 * the `h1` was never the only place it lived — `index.html` carries it in
 * `<title>`, in `meta[name=author]`, in `og:title`, in `og:site_name`, in
 * `twitter:title` and twice in the JSON-LD graph. Every one of those was read
 * against these strings and none had to change, because none of them ever said
 * "portfolio": they say who the site is by, which is the thing the `h1` has
 * stopped saying.
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
 * That argument is still the test anything in the lower corners has to pass,
 * and issue #101 asked what belongs there. The answer, picked by the owner
 * from three that were built, is one quiet affordance pointing at the ask
 * plate — the one destination the bar deliberately does not carry and the one
 * thing a reader cannot reach by the gesture they are already making — and,
 * in the other corner, a small light with the README's voice beside it.
 * `HeroCorners` carries the argument for both at its head.
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
 * Since #162 there is no arrival on a clock. The screen is whole at scroll 0
 * and, as the section leaves through the top of the window, each part makes
 * its old arrival gesture backwards — the letters lift under a paper mask,
 * the figure sinks behind one, the two lines slide back to their sides — and
 * scrolling up runs every one of them forwards. All of it is
 * `HeroArrival.module.css`, on the section's own `--hero` view timeline.
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

export default function Hero() {
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
    <section id="hero" className={`relative w-full ${styles.hero} ${arrival.timeline}`}>
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
          label. The section around it carries the `--hero` timeline every
          part of the picture reads.
        */}
        <div className={`${styles.composition} ${arrival.stage}`}>
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
            Four parts of one picture, each taken apart by the reader's scroll
            as the section leaves and put back as it returns.
            `HeroArrival.module.css` carries the ranges and the reasoning.

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
            name={plateTitle.name}
            fact={plateTitle.fact}
            fields={PLATE_FIELDS}
            exposeFieldKinds
            splitName
            className={styles.plate}
          />

          {/*
            The lower corners — issue #101. Out of flow against this box, so
            they are in neither of the two grid rows and cannot shrink the
            figure's track or move a line of type. The argument for each
            candidate is at the head of `HeroCorners.tsx`.
          */}
          <HeroCorners />
        </div>
      </div>
    </section>
  );
}
