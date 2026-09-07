import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Work from "@/components/Work";
import Approach from "@/components/Approach";
import Stack from "@/components/Stack";
import Contact from "@/components/Contact";

export default function Index() {
  return (
    <div className="grain min-h-screen bg-bitumen">
      <a
        href="#work"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-sodium focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <Nav />
      <main>
        <Hero />
        <Work />
        <Approach />
        <Stack />
        <Contact />
      </main>
    </div>
  );
}
