import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Signal from "@/components/Signal";
import Work from "@/components/Work";
import Stack from "@/components/Stack";
import Contact from "@/components/Contact";

export default function Index() {
  return (
    <div className="grain min-h-screen bg-bitumen">
      <a
        href="#signal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-sodium focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <Nav />
      <main>
        <Hero />
        <Signal />
        <div className="mx-auto max-w-6xl px-6"><div className="rule" /></div>
        <Work />
        <div className="mx-auto max-w-6xl px-6"><div className="rule" /></div>
        <Stack />
        <div className="mx-auto max-w-6xl px-6"><div className="rule" /></div>
        <Contact />
      </main>
    </div>
  );
}
