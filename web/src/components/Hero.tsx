import ObjectLabel from "@/components/gallery/ObjectLabel";
import type { LabelField } from "@/components/gallery/objectLabel";
import { projects } from "@/data/projects";
import { plate } from "@/data/site";
import styles from "@/components/Hero.module.css";
import arrival from "@/components/HeroArrival.module.css";

/*
 * The first screen: a plate by the door, and nothing else on the wall.
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
 * So this file renders no layout of its own: it hands three strings to the same
 * `ObjectLabel` the projects and the notes go through, at the one scale that is
 * allowed to be bigger, and gets out of the way. There is no variant prop to
 * reach for and that absence is the point — the first exception granted to one
 * section is the moment the page becomes a grid of unrelated things again.
 *
 * What this screen used to carry, and why none of it is here
 * ----------------------------------------------------------
 * **"Built to be used."** A tagline, set in the second voice, at 2.6rem. The
 * label schema is fact and not pitch, and the fact line that replaces it —
 * "Full-stack, mostly frontend" — is checkable in a way the tagline never was.
 * The two paragraphs under it went with it: they were the same argument made
 * three times, and the work below makes it better than any sentence can.
 *
 * **`WordStagger`.** The first sentence used to arrive a word at a time,
 * pausing where the punctuation did. It was the nicest thing on the screen and
 * it is a kinetic headline, which this grammar bans outright: the collection is
 * meant to be walked, and type that performs on arrival is the page talking
 * about itself. The component is still in the tree and now has no caller; its
 * retirement belongs with the device ledger rather than with this beat.
 *
 * **The two action pills.** "See the work" was the one deliberate entry point
 * the first screen had, and it was a button telling a reader to do the thing
 * they are already doing. The chrome keeps the three destinations the site
 * actually has, /projects among them, and scrolling needs no affordance.
 *
 * **The portrait — and where it went.** See the note below; the decision is
 * written out there because it is the one choice here that loses something.
 *
 * What is left weighs nothing: no canvas, no gradient, no image, no third
 * webfont, and — because the plate arrives through one class name and a
 * stylesheet rather than through a component — no JavaScript. That is not
 * thrift for its own sake. It is the whole asset budget, moved to the peak.
 *
 * The beat is `reveal` and it has to stay one. `HeroArrival.module.css` gives
 * each of the three parts an arrival of its own and each field an arrival
 * derived from its kind, which is three differences inside one device family
 * rather than a second device: everything on the plate appears, once, on a
 * clock, and none of it travels further or longer than the measured reveal in
 * the contract. The plate is not the page's peak and the restraint is not a
 * compromise — it is the first screen, it has no imagery, and composed is the
 * only thing it can be without taking weight off the pile.
 *
 * Where the portrait goes, and why it is not here
 * -----------------------------------------------
 * The old plan put the photograph on the first screen so that it would be seen
 * at all, and that reasoning was sound right up until the hero became a title
 * plate. A plate is type. A headshot beside it does not read as object zero's
 * label, it reads as the thing the label is for, and then the plate is a
 * caption and the person is the exhibit.
 *
 * Three homes were considered. Not the wall text below: that beat exists to be
 * the silence before the pile, and a framed print with a mount and a caption is
 * the loudest object on the page after the pile itself — it would buy back
 * exactly the impact the quiet is paying for. Not its own object in the
 * collection either: this collection is of work, every object in it is
 * something that was built, and a face is not one. So it goes to `/about`,
 * where a photograph is the subject rather than an interruption, and where
 * there is room for the one caption it has always deserved.
 *
 * `/about` does not exist yet, so for now the portrait is simply not on the
 * site. That is the honest version of the decision rather than a hole in it:
 * the asset and its grade are untouched in `public/img`, `components/Figure`
 * still draws the mount, and the page that needs them can have them on the day
 * it is written. One live consequence to know about: `Work.tsx` numbers its
 * first screenshot `FIRST_PLATE = 2` because the portrait was Fig. 01, and with
 * the portrait gone the home page starts its plates at two. That constant is
 * the only thing that needs moving and it is not in this file.
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

export default function Hero() {
  return (
    <section id="hero" className="relative w-full">
      {/*
        `pt-28` is nav clearance, not rhythm: the island is fixed, 50px tall
        and 18px down, so the first line has to start below 68px.

        `safe center` rather than plain centring, which overflows in both
        directions the moment the content is taller than the screen — and the
        half above the top edge cannot be scrolled to. `safe` is the keyword for
        exactly this: centre while there is room, fall back to the start edge
        once there is not. A browser that does not know it drops the whole
        declaration and lands on flex-start, which is the same fallback.
      */}
      <div className="wrap flex min-h-[100svh] flex-col pb-16 pt-28 [justify-content:safe_center]">
        {/*
          Three parts, three arrivals, and the field line splits again into
          one arrival per kind of fact. `HeroArrival.module.css` carries the
          reasoning for each; the short version is that the name darkens into
          the paper without moving, the fact line takes the measured 14px rise
          every other paragraph on the site takes, and the three fields stamp
          themselves on separately — instantly for a place, up from under the
          line for a count, slowly for a span of years.

          This used to be `riseOnLoad`: one reveal on the group, 60ms apart in
          reading order. It is still the right default and `Rise` still owns
          it for the wall text below. It was the wrong answer for the plate
          because the three parts are three kinds of statement, and one device
          applied to the block says they are three lines of the same thing.

          No observer, and no JavaScript. This is the first element in the
          document and it is in view before an observer could be constructed,
          so the whole arrival is one class name and a stylesheet — which also
          means nothing here can delay the paint of the largest text on the
          first screen.

          `exposeFieldKinds` is the one hook this needed from the shared
          label: it writes each field's kind onto its `<li>` so a rule about
          kinds can be written against the kind rather than against the
          position `orderFields` happens to sort it into. It is off for every
          other object on the site.
        */}
        <ObjectLabel
          scale="plate"
          nameAs="h1"
          name={plate.name}
          fact={plate.fact}
          fields={PLATE_FIELDS}
          exposeFieldKinds
          className={`${styles.plate} ${arrival.arrive}`}
        />
      </div>
    </section>
  );
}
