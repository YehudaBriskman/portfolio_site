import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Work from "@/components/Work";
import Approach from "@/components/Approach";
import Stack from "@/components/Stack";
import Contact from "@/components/Contact";
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
    </div>
  );
}
