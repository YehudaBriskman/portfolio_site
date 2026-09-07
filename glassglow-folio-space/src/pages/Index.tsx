import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Work from "@/components/Work";
import Approach from "@/components/Approach";
import Stack from "@/components/Stack";
import Contact from "@/components/Contact";
import Atmosphere from "@/components/Atmosphere";
import Ridge from "@/components/Ridge";
import Reveal from "@/components/Reveal";
import { useScrollProgress } from "@/hooks/useScrollProgress";

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
      {/* One atmosphere for the whole document: the page descends from the night
          sky at the hero to the water at the footer. */}
      <Atmosphere />
      <Nav />
      <main>
        <Hero />
        <Ridge variant={0} />
        <Reveal><Work /></Reveal>
        <Ridge variant={1} flip />
        <Reveal><Approach /></Reveal>
        <Ridge variant={2} />
        <Reveal><Stack /></Reveal>
        <Ridge variant={0} flip />
        <Reveal><Contact /></Reveal>
      </main>
    </div>
  );
}
