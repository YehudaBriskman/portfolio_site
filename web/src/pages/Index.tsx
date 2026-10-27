import { scrollToAnchor } from "@/lib/scrollToAnchor";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Work from "@/components/Work";
import Approach from "@/components/Approach";
import Stack from "@/components/Stack";
import LatestNotes from "@/components/LatestNotes";
import Contact from "@/components/Contact";
import SiteFooter from "@/components/SiteFooter";
import { useScrollProgress } from "@/hooks/useScrollProgress";

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
 * already print themselves at the grain that means something: Approach and
 * Stack wipe in each card, LatestNotes wipes in each row, Work irises each
 * image. Wrapping all of that in a second, coarser arrival was two animations
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
  useScrollProgress();

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

        <div className="layer-section">
          <Work />
        </div>

        <div className="layer-section">
          <Approach />
        </div>

        <div className="layer-section">
          <Stack />
        </div>

        {/*
          The writing gets a place in the argument, between what I use and how
          to reach me, rather than existing only as a nav label.

          No `layer-section` rhythm around it: it rides the space the stack
          above has already opened, which keeps the page from growing another
          runway between two sections that are reading as one thought.
        */}
        <LatestNotes />

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
