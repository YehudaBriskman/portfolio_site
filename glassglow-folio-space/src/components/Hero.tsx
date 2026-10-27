export default function Hero() {
  return (
    <section id="hero" className="relative min-h-[100svh] w-full overflow-hidden">
      {/* Ground for the type, and a floor that hands the page to the first
          section instead of stopping at an edge. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to right," +
            "rgb(var(--bitumen)) 0%," +
            "rgb(var(--bitumen) / 0.92) 34%," +
            "rgb(var(--bitumen) / 0.55) 56%," +
            "rgb(var(--bitumen) / 0.12) 78%," +
            "transparent 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bitumen/60 via-transparent to-bitumen" />

      {/*
        This is a site about a person, so the person is on the first screen
        rather than three sections down. Standing at the right, bottom-aligned,
        the cutout reads as part of the landscape instead of a portrait pasted
        on top of it. It is faded back on small screens, where the type column
        has to run across the same space.
      */}
      {/* Held to the same column as the type. Pinned to the window edge it
          drifted hundreds of pixels away from everything else on a wide
          display, reading as a separate image rather than part of the page. */}
      <div className="pointer-events-none absolute inset-0 z-[5] hidden sm:block">
        <div className="relative mx-auto flex h-full max-w-6xl justify-end px-6">
          {/*
            A light behind him, not a colour wash over the page. Without it the
            cutout sits on the background like a sticker; with it he is standing
            in front of something. Warm and off-centre, so it reads as a low sun
            behind his shoulder rather than a spotlight.
          */}
          <div
            className="absolute bottom-[8%] right-[6%] h-[46svh] w-[46svh] rounded-full sm:right-[10%] sm:h-[56svh] sm:w-[56svh]"
            style={{
              background:
                "radial-gradient(circle, rgb(var(--sodium) / 0.30) 0%, rgb(var(--sodium) / 0.12) 38%, rgb(var(--sodium) / 0) 70%)",
              /*
                The hero clips its own overflow, so a glow that reached the
                bottom edge was cut off square and read as a lit rectangle
                sitting on the page. Fading it out well before the boundary
                means the light ends because it ran out, not because something
                cropped it.
              */
              maskImage: "linear-gradient(to bottom, #000 0%, #000 46%, transparent 92%)",
              WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 46%, transparent 92%)",
            }}
          />
        <img
          src="/img/yehuda-cut.webp"
          srcSet="/img/yehuda-cut-sm.webp 365w, /img/yehuda-cut.webp 551w"
          sizes="(min-width: 1024px) 42vw, 70vw"
          alt="Yehuda Briskman"
          width={551}
          height={845}
          /* Above the fold and the largest element on it: this is the LCP image,
             so it loads eagerly and at high priority rather than lazily. */
          fetchpriority="high"
          decoding="async"
          className="h-[74svh] w-auto max-w-none select-none self-end object-contain opacity-70 lg:h-[80svh] lg:opacity-100"
        />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-between gap-10 px-6 pb-10 pt-28 sm:gap-0">
        <p className="eyebrow animate-fade-up">
          Tel Aviv &middot; Full-stack engineer &amp; team lead
        </p>

        <div className="max-w-3xl">
          {/* One H1, and it names the subject of the site rather than opening
              with a slogan — the slogan still leads visually, one line down. */}
          <h1 className="display text-hero animate-fade-up" style={{ animationDelay: "80ms" }}>
            Yehuda
            <br />
            Briskman
          </h1>

          <p
            className="display-tight mt-6 text-[clamp(1.4rem,3.6vw,2.4rem)] text-sodium animate-fade-up"
            style={{ animationDelay: "150ms" }}
          >
            Built to be used.
          </p>

          {/* Two short statements rather than one dense block: the same claims,
              set large enough to actually be read. */}
          <p
            className="mt-8 max-w-lg text-lg leading-[1.65] text-bone animate-fade-up sm:text-xl"
            style={{ animationDelay: "220ms" }}
          >
            I ship products end to end: a Chrome extension in the Web Store, a
            self-hosted operations console, and the backends under both.
          </p>
          <p
            className="mt-5 max-w-lg text-lg leading-[1.65] text-bone/70 animate-fade-up sm:text-xl"
            style={{ animationDelay: "280ms" }}
          >
            Then I write the checks that prove they still work somewhere that
            isn&rsquo;t my laptop.
          </p>

          {/*
            On a phone the portrait takes its turn in the column rather than
            sitting behind the words at a third opacity, which was the only way
            to keep the text readable on top of it. Here it follows the copy,
            centred, at full strength — the page reads name, claim, then person.
          */}
          <div className="relative mt-12 flex justify-center sm:hidden">
            <div
              className="pointer-events-none absolute bottom-[6%] left-1/2 h-[34svh] w-[34svh] -translate-x-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgb(var(--sodium) / 0.30) 0%, rgb(var(--sodium) / 0.12) 38%, rgb(var(--sodium) / 0) 70%)",
                maskImage: "linear-gradient(to bottom, #000 0%, #000 46%, transparent 92%)",
                WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 46%, transparent 92%)",
              }}
              aria-hidden="true"
            />
            <img
              src="/img/yehuda-cut-sm.webp"
              alt="Yehuda Briskman"
              width={365}
              height={560}
              fetchpriority="high"
              decoding="async"
              className="relative h-[38svh] w-auto select-none object-contain"
            />
          </div>
        </div>

        <div
          className="flex flex-wrap items-end justify-between gap-6 animate-fade-up"
          style={{ animationDelay: "360ms" }}
        >
          <a href="https://windom.app" target="_blank" rel="noreferrer noopener"
            className="mono -my-3 inline-flex min-h-11 items-center py-3 text-xs uppercase tracking-[0.22em] text-clay transition-colors hover:text-sodium">
            windom.app ↗
          </a>
          <a href="#work"
            className="mono -my-3 inline-flex min-h-11 items-center py-3 text-xs uppercase tracking-[0.22em] text-clay transition-colors hover:text-sodium">
            See the work ↓
          </a>
        </div>
      </div>
    </section>
  );
}
