import WordStagger from "@/components/motion/WordStagger";
import { scrollToAnchor } from "@/lib/scrollToAnchor";

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
        <div className="wrap relative flex h-full justify-end">
          {/*
            A light behind him, not a colour wash over the page. Without it the
            cutout sits on the background like a sticker; with it he is standing
            in front of something. Off-centre, so it reads as a light source
            behind his shoulder rather than a spotlight aimed at him.

            It used to be sodium, which is precisely the colour wash this
            comment claimed it was not: a warm circle a third of the screen
            across, laid over the only photograph-free screen on the site.
            Bone gives the same separation out of value, and at a third of the
            old strength, because an untinted light reads as brighter than a
            tinted one at the same alpha.
          */}
          <div
            className="absolute bottom-[8%] right-[6%] h-[46svh] w-[46svh] rounded-full sm:right-[10%] sm:h-[56svh] sm:w-[56svh]"
            style={{
              background:
                "radial-gradient(circle, rgb(var(--bone) / 0.10) 0%, rgb(var(--bone) / 0.04) 38%, rgb(var(--bone) / 0) 70%)",
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

      {/*
        No measure on the column itself.

        Every other section is one `.wrap` and everything inside it; the hero
        cannot be, because the name has to run wider than the measure and a
        block cannot escape its parent's max-width without a negative margin
        in viewport units — which is the scrollbar bug all over again. So the
        column is full width and each child declares its own measure: `.wrap`
        for everything that reads, the gutters alone for the name.

        `pt-28` is nav clearance, not rhythm: the island is fixed, 50px tall
        and 18px down, so the first line has to start below 68px.
      */}
      <div className="relative z-10 flex min-h-[100svh] flex-col justify-between gap-12 pb-12 pt-28 sm:gap-0">
        <p className="wrap eyebrow animate-fade-up">
          Tel Aviv &middot; Full-stack engineer &amp; team lead
        </p>

        {/*
          The name sits in the measure with everything else.

          It ran to the gutters for a while, on the argument that display
          type at this size is the layout rather than text inside one. Edge
          to edge it touched both sides with no air at all, and on a short
          window — a laptop at 1878x875 — its two lines took 43% of
          everything the reader could see before the page had said a word. A
          name is not worth half of a first screen.

          Back in the column, and `text-hero` now caps against the viewport's
          height as well as its width, so the block holds at roughly a third
          of the screen whatever shape the window is. It is still the largest
          thing on the page by a wide margin.
        */}
        <div className="wrap">
          {/* One H1, and it names the subject of the site rather than opening
              with a slogan — the slogan still leads visually, one line down. */}
          <h1 className="display text-hero animate-fade-up" style={{ animationDelay: "80ms" }}>
            Yehuda
            <br />
            Briskman
          </h1>
        </div>

        {/* Every child here is already held to its own measure, so the
            column only has to supply the page's. */}
        <div className="wrap">

          {/*
            The second voice, and the only line on the page entitled to it.
            This sat in the display face at 22-38px and in the accent colour,
            which is the one band the type scale no longer has: between a 12px
            label and a 15rem name there is nothing but a change of voice. In
            the serif italic the claim reads as something said rather than
            something printed, and it stops competing with the name above it
            for the same kind of attention.
          */}
          <p
            className="editorial mt-6 text-[clamp(1.6rem,4vw,2.6rem)] text-bone animate-fade-up"
            style={{ animationDelay: "150ms" }}
          >
            Built to be used.
          </p>

          {/*
            Two short statements rather than one dense block: the same claims,
            set large enough to actually be read.

            The first arrives a word at a time, pausing where the punctuation
            does. One line on the site gets this — it is the sentence the page
            exists to make, and an effect used twice stops being an emphasis
            and starts being a template.
          */}
          <WordStagger
            as="p"
            className="mt-12 max-w-lg text-lg leading-[1.65] text-bone sm:text-xl"
          >
            I ship products end to end: a Chrome extension in the Web Store, a
            self-hosted operations console, and the backends under both.
          </WordStagger>
          <p
            className="mt-6 max-w-lg text-lg leading-[1.65] text-bone/70 animate-fade-up sm:text-xl"
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
                  "radial-gradient(circle, rgb(var(--bone) / 0.10) 0%, rgb(var(--bone) / 0.04) 38%, rgb(var(--bone) / 0) 70%)",
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

        {/*
          A real primary action.

          `.btn-solid` is defined in the design system and was used exactly
          zero times on this page: the only way forward from the first screen
          was an 11px grey mono link in the bottom corner, set in the same
          voice as the twenty other small capitals on the page. The first
          screen of a portfolio should have one obvious next move, and the
          live product is the strongest second.
        */}
        <div
          className="wrap flex flex-wrap items-center gap-3 animate-fade-up"
          style={{ animationDelay: "360ms" }}
        >
          {/* The page's one primary action, and now the longest hop on it —
              the section links left the chrome, so this is what makes the
              descent. See lib/scrollToAnchor for why the easing is decided
              per click rather than by a rule on the document. */}
          <a
            href="#work"
            onClick={(e) => { if (scrollToAnchor("work")) e.preventDefault(); }}
            className="btn btn-solid"
          >
            See the work <span aria-hidden="true">↓</span>
          </a>
          <a
            href="https://windom.app"
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-quiet"
          >
            windom.app <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
