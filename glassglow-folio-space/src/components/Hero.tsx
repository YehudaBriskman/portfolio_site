import Terrain from "@/components/scene/Terrain";

export default function Hero() {
  return (
    <section id="hero" className="relative min-h-[100svh] w-full overflow-hidden">
      <Terrain />
      {/*
        Two scrims doing different jobs.
        Horizontal: the type column sits on solid ground while the scene bleeds
        out to the right. Without it the pale band below the horizon runs
        straight through the first line of the paragraph at 1.5:1.
        Vertical: settles the top under the nav and the very bottom into the page.
      */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to right," +
            "rgb(var(--bitumen)) 0%," +
            "rgb(var(--bitumen) / 0.95) 36%," +
            "rgb(var(--bitumen) / 0.62) 54%," +
            "rgb(var(--bitumen) / 0.12) 74%," +
            "transparent 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bitumen/70 via-transparent to-bitumen/85" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-between px-6 pb-10 pt-28">
        <p className="eyebrow animate-fade-up">
          Yehuda Briskman — Full-stack engineer &amp; team lead — Tel Aviv
        </p>

        <div className="max-w-4xl">
          <h1 className="display text-hero animate-fade-up" style={{ animationDelay: "80ms" }}>
            Built to be
            <br />
            <span className="text-sodium">used.</span>
          </h1>
          <p
            className="mt-8 max-w-xl text-base leading-relaxed text-bone animate-fade-up sm:text-lg"
            style={{ animationDelay: "180ms" }}
          >
            I ship products end to end — a Chrome extension published in the Web Store, a
            self-hosted operations console, and the backends and release pipelines under both.
            Then I write the checks that prove they still work somewhere that isn&rsquo;t my laptop.
          </p>
        </div>

        <div
          className="flex flex-wrap items-end justify-between gap-6 animate-fade-up"
          style={{ animationDelay: "280ms" }}
        >
          <a href="https://windom.app" target="_blank" rel="noreferrer noopener"
            className="mono text-xs uppercase tracking-[0.22em] text-clay transition-colors hover:text-sodium">
            windom.app ↗
          </a>
          <a href="#work"
            className="mono text-xs uppercase tracking-[0.22em] text-clay transition-colors hover:text-sodium">
            See the work ↓
          </a>
        </div>
      </div>
    </section>
  );
}
