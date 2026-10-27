import { scrollToAnchor } from "@/lib/scrollToAnchor";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Work from "@/components/Work";
import Approach from "@/components/Approach";
import Stack from "@/components/Stack";
import LatestNotes from "@/components/LatestNotes";
import Contact from "@/components/Contact";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import { useScrollProgress } from "@/hooks/useScrollProgress";

/*
 * Every section is a layer. The order of these wrappers is the order the layers
 * rise in, which is why they are marked here rather than inside each component.
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
      {/*
        Every section reads from the same edge.

        This used to be four alignments across five sections — hero left, work
        left, approach right, stack centred, contact left. That was already a
        craft problem; with photographs behind the page it became a legibility
        one, because each plate's scrim is a pool positioned under the reading
        column. A right-aligned section put its text over the part of the
        picture the scrim had deliberately left bright.
      */}
      {/* No nav clearance here, unlike PageShell: the hero is a full-height
          section that positions its own first line under the island. */}
      <main id="content">
        {/* The hero is the person and nothing else. The landscape used to be
            given away in the first screen; now it is assembled on the way down
            and only resolves at the foot of the page. */}
        <div data-crest>
          <Hero />
        </div>

        <div data-crest className="layer-section">
          <Reveal><Work /></Reveal>
        </div>

        <div data-crest className="layer-section">
          <Reveal from="right" y={26}><Approach /></Reveal>
        </div>

        <div data-crest className="layer-section">
          <Reveal y={30}><Stack /></Reveal>
        </div>

        {/*
          The writing gets a place in the argument, between what I use and how
          to reach me, rather than existing only as a nav label.

          Deliberately not a `data-crest` layer-section: the plate stack is
          five deep and there are four photographs, so a sixth crest would
          either repeat one out of sequence or break the descent. This section
          rides the plate the stack is already standing on, which also keeps
          the page from growing another runway.
        */}
        <div>
          <Reveal y={26}><LatestNotes /></Reveal>
        </div>

        <div data-crest className="layer-section">
          <Reveal from="left" y={26}><Contact /></Reveal>
        </div>
      </main>

      {/*
        The footer stands on its own ground, not on the last plate.

        It used to be rendered inside <Contact>, so it inherited whichever
        colour that section's layer had risen to — a warm rust by the foot of
        the page. Every token in the footer was measured against --bitumen and
        none of them had been measured against that, which is why the column
        headings and the admin link were the least legible text on the site.
      */}
      <div className="footer-ground">
        <div className="wrap pb-section-sm">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
