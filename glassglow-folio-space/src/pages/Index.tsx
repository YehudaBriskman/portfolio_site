import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Work from "@/components/Work";
import Approach from "@/components/Approach";
import Stack from "@/components/Stack";
import Contact from "@/components/Contact";
import SiteFooter from "@/components/SiteFooter";
import Atmosphere from "@/components/Atmosphere";
import Reveal from "@/components/Reveal";
import { useScrollProgress } from "@/hooks/useScrollProgress";

/*
 * Every section is a layer. The order of these wrappers is the order the layers
 * rise in, which is why they are marked here rather than inside each component.
 */
export default function Index() {
  useScrollProgress();

  return (
    <div className="grain relative min-h-screen">
      <a
        href="#work"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-sodium focus:px-4 focus:py-2 focus:text-bitumen"
      >
        Skip to content
      </a>
      <Atmosphere />
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
      <main>
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
        <div className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-6">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
