import { scrollToAnchor } from "@/lib/scrollToAnchor";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Work from "@/components/Work";
import Approach from "@/components/Approach";
import ContributionCity from "@/components/city/ContributionCity";
import Stack from "@/components/Stack";
import LatestNotes from "@/components/LatestNotes";
import Contact from "@/components/Contact";
import SiteFooter from "@/components/SiteFooter";

/*
 * The home page, and nothing between it and its sections.
 *
 * What was here and why it has gone
 * ---------------------------------
 * Every section was wrapped in `<Reveal>`, an IntersectionObserver that held
 * its child at `opacity: 0` and a translation of up to 30px until the box
 * crossed the viewport. Three things were wrong with that by the time the
 * ground became paper.
 *
 * It was measurably breaking the page. Two of the wrappers translated
 * *horizontally* — `from="right"` pushed a full-width section 26px past the
 * right edge of the document until it fired — so the page reported horizontal
 * overflow for as long as the reader had not yet scrolled to those sections.
 * `body` carries `overflow-x: clip`, which hid the scrollbar and not the
 * problem.
 *
 * It was the wrong grain. A reveal on a whole section animates five hundred
 * pixels of heading, copy and three cards as one opaque block, which is a
 * statement about the browser rather than about the content. The sections
 * already print themselves at the grain that means something, and each at a
 * different one: Approach wipes in each card, Work irises each image, the
 * notes shelf travels sideways against the scroll, and the spec plate counts
 * its figures up once as they arrive. Wrapping all of that in a second, coarser arrival was two animations
 * saying the same thing at different speeds, and the outer one would have
 * clipped the sticky deck inside Approach while it was pinned.
 *
 * And it was the last scroll observer on the page. The wipes are
 * `animation-timeline: view()` and cost nothing per frame; `Reveal` put an
 * IntersectionObserver and a state update back on every section.
 *
 * So nothing replaces it at this level. The replacement already lives inside
 * each section, which is where a page's motion belongs — see
 * `components/motion/InkWipe`.
 *
 * `data-crest` has gone with it. It was the hook the retired plate stack used
 * to decide which photograph a section stood on; nothing in the stylesheet or
 * in any hook selects it any more, so on this page it was an attribute with
 * no reader.
 */
export default function Index() {

  return (
    <div className="relative min-h-screen">
      {/* #content, not #work. Pointing it at the first section scrolled the
          reader past the page's own h1 and intro — it skipped the content
          rather than skipping to it. */}
      <a
        href="#content"
        onClick={(e) => { if (scrollToAnchor("content")) e.preventDefault(); }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-bone focus:px-4 focus:py-2 focus:text-bitumen"
      >
        Skip to content
      </a>
      <Nav />
      {/* No nav clearance here, unlike PageShell: the hero is a full-height
          section that positions its own first line under the island. */}
      <main id="content">
        {/* The hero is the person and nothing else, and it owns its own
            rhythm — it is the only full-height section on the page. */}
        <Hero />

        {/*
          The plates, and the rule is in index.css next to the ground scale:
          the ground changes where the SUBJECT changes, not every other
          section. Approach and the year share warm because they are one
          thought — how the work gets made — and the shelf and the spec plate
          share cool for the same reason the comment below insists they stay
          adjacent. Contact closes on warm, where the hero opened.
        */}
        <div className="layer-section ground" data-ground="panel">
          <Work />
        </div>

        <div className="layer-section">
          <Approach />
        </div>

        {/*
          The year, and the two beats it had to sit between.

          It is the page's one `scrub` — a thing the reader operates by
          scrolling rather than a thing that happens to them once — so it has
          no adjacent family to collide with here: `flow` above it, `pan`
          below. Both of the other candidate slots are closed, and for
          reasons rather than by preference.

          Not next to the pile. The pile is the page's only engineered peak
          and the only other act on it with real depth in it; a 3D grid
          immediately before or after would make the peak read as this
          section's warm-up. The wall text between them is the separation, and
          it is the quietest screen on the page precisely so that the two
          acts either side of it do not meet.

          Not between the shelf and the spec plate. The comment below argues
          that pair must stay adjacent because the order is the device
          sequence; dropping a third beat between them would put a static
          screen between the two sections that answer each other.

          The principles above it are untouched. The issue this came from said
          the city replaced them, which stopped being true when each of the
          three got its own typographic arrival — so the city is a section of
          its own and where the principles finally live is the owner's call,
          raised in the pull request rather than decided here.
        */}
        <div className="layer-section">
          <ContributionCity />
        </div>

        {/*
          The shelf, and then the plate — in that order, because the order is
          the device sequence and not a preference.

          The beat before this pins and holds the reader still for a screen and
          a half; lateral travel is the strongest contrast available after
          that, so the shelf takes the slot immediately after it and the plate
          follows with a third kind of motion. Swapped, the page would read
          pile, figures, shelf, which puts a static beat between the two that
          are supposed to answer each other.

          No `layer-section` around the shelf: it is full-bleed, and it rides
          the space the section above has already opened rather than growing
          another runway between two sections that read as one thought.
        */}
        {/*
          A bare `.ground`, with no `layer-section` on it — the comment above
          is the reason, and it still holds: the shelf is full-bleed and rides
          the space the section before it has already opened rather than
          growing a second runway. What it needs from a plate is the ground,
          the corners and the shadow, and `.ground` is exactly those three and
          no padding. Safe because the shelf's own overflow is internal to its
          scroller and it uses no negative margins to escape this box.
        */}
        <div>
          <LatestNotes />
        </div>

        <div className="layer-section">
          <Stack />
        </div>

        <div className="layer-section">
          <Contact />
        </div>
      </main>

      {/*
        The footer stands on its own ground, not on the last section.

        It used to be rendered inside <Contact>, so it inherited whichever
        colour that section's layer had risen to — a warm rust by the foot of
        the page. Every token in the footer was measured against the page
        ground and none of them had been measured against that, which is why
        the column headings and the admin link were the least legible text on
        the site.
      */}
      <div className="footer-ground">
        <div className="wrap pb-section-sm">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
