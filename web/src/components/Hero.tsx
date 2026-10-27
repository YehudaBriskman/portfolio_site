import WordStagger from "@/components/motion/WordStagger";
import Figure from "@/components/Figure";
import Action from "@/components/ui/Action";
import { scrollToAnchor } from "@/lib/scrollToAnchor";

/*
 * The first screen: a nameplate, a portrait, and what the portrait is of.
 *
 * What this replaces
 * ------------------
 * The portrait used to be an absolutely positioned cutout on z-index 5 with
 * the type column on z-index 10 directly over it, faded to 70% below `lg`
 * so the words on top of it stayed readable, and standing in a radial glow
 * that existed to separate it from a dark ground. Three devices, all of them
 * spent on the same problem: the picture and the text were fighting for one
 * rectangle, and the picture was always going to lose, because the thing
 * over it was 144px tall.
 *
 * On paper there is no reason for them to share a rectangle. The portrait is
 * a framed print now — a white mount, a visible border, a caption — sitting
 * in its own column, at full strength, with nothing on top of it. The glows
 * and the two scrims are gone with the dark ground they were correcting for;
 * a radial wash of `--bone` over paper is a white smudge.
 *
 * Why the name still runs across the top
 * --------------------------------------
 * `text-hero` is `min(11vw, 21vh, 9rem)`, and 9rem is the largest size at
 * which "BRISKMAN" — 7.12em at wdth 125 — still fits the measure's 1072px of
 * content. Putting the portrait beside the name would have taken 300-360px
 * out of that column and forced the name down to roughly 5.8rem. So the name
 * keeps the full measure on its own line and the portrait takes the row
 * underneath, beside the copy: a nameplate with a picture and a standfirst
 * under it, which is how a page this size has always been set. The token is
 * untouched and nothing about the fit has changed.
 *
 * Why `safe center`
 * -----------------
 * Plain centring inside `min-h-[100svh]` overflows in both directions the
 * moment the content is taller than the screen — a 1280x600 window puts this
 * content at roughly 800px — and the half above the top edge cannot be
 * scrolled to. Spacing the two rows apart instead avoids that, but spends
 * every spare pixel on one gap: 193px of nothing between the nameplate and
 * the portrait on a tablet, 341px on a 1440-tall display.
 *
 * `safe` is the keyword for exactly this: centre while there is room, and
 * fall back to the start edge rather than overflow once there is not. A
 * browser that does not know it drops the whole declaration and lands on
 * flex-start, which is the same fallback.
 */
export default function Hero() {
  return (
    <section id="hero" className="relative w-full">
      {/*
        `pt-28` is nav clearance, not rhythm: the island is fixed, 50px tall
        and 18px down, so the first line has to start below 68px.
      */}
      <div className="wrap flex min-h-[100svh] flex-col gap-12 pb-16 pt-28 [justify-content:safe_center]">
        <div>
          <p className="eyebrow animate-fade-up">
            Tel Aviv &middot; Full-stack engineer &amp; team lead
          </p>

          {/* One H1, and it names the subject of the site rather than opening
              with a slogan — the slogan still leads visually, one row down. */}
          <h1 className="display text-hero mt-6 animate-fade-up" style={{ animationDelay: "80ms" }}>
            Yehuda
            <br />
            Briskman
          </h1>
        </div>

        {/*
          Picture first, in the document and on the line.

          `items-end` rather than `items-start`: the frame and the copy are
          two blocks of different heights and aligning their tops leaves the
          shorter one floating. Their bottoms are where the eye expects a
          baseline, and it puts the portrait's caption on the same line as
          the primary action.

          `auto` for the first column, because the frame sizes itself from
          the picture rather than the other way around — see the figure.
        */}
        <div className="grid items-end gap-10 md:grid-cols-[auto_minmax(0,1fr)] md:gap-12">
          <Figure
            index={1}
            caption="Yehuda Briskman"
            className="animate-fade-up"
            /*
              The print is sized by the screen's height, not its width.

              A portrait is the one picture on the site with no fixed slot to
              sit in: left to fill its column it would be 551px wide and
              845px tall and the nameplate would be the only other thing
              above the fold. So the mount's width is derived from the height
              it is allowed — 40svh of image, times the source's 551:845, plus
              the 24px of mount and 2px of border around it — and the image
              fills that mount normally, which is what `.figure-frame` already
              does for every other picture. Capping the whole thing at 100%
              is what keeps it inside a 350px column on a phone.

              `width` and `max-width` rather than `width: min(100%, …)`: a
              percentage inside the width makes it indefinite while the grid
              is sizing its `auto` track, so the track fell back to the
              image's intrinsic 551px and left a 135px hole between the print
              and the copy beside it. A definite width is the track's width.

              Expressed here rather than as a Tailwind arbitrary value because
              a `calc()` of four terms written with escaped underscores is not
              something anyone can read or check.
            */
            style={{ animationDelay: "150ms", width: "calc(40svh * 0.6521 + 26px)", maxWidth: "100%" }}
          >
            {/*
              Why this file was regraded rather than restyled.

              The portrait read as faint here and no amount of mount would
              have fixed it, because the problem was the photograph's own
              grade. Measured on the source: red peaked at 236 but green at
              181 and blue at 169, with channel deviations of 36/27/21. That
              is a heavy orange wash with no highlights and almost no tonal
              spread — a grade made for a near-black ground, where any warm
              light reads as light. Dropped onto #ECE8DC it is the same hue
              family as the paper, so the subject was camouflaged against the
              page rather than underexposed on it, and darkening the mount
              would only have taken the picture down with it.

              So the white point was reset per channel (95/84/80), an S-curve
              put the midtones back, and saturation came down 12%. The face
              now carries ink and the hair reads as hair. The alpha channel —
              a vertical ramp that dissolves the torso toward the bottom of
              the frame — had its gamma raised to 1.3 so the figure holds
              through the middle of the print instead of giving out halfway.

              One `<img>`, two sources, one request. A previous audit found
              two sibling images here with CSS hiding one per breakpoint and
              both of them downloading; that was already collapsed into this
              `srcset` before this pass, and it is verified: Chromium issues
              exactly one request for the portrait at every breakpoint.

              The mount stays tinted. The cutout is transparent and the
              subject wears a white t-shirt, so on the near-white card the
              shirt and the mount are the same value and the silhouette goes
              with them; `--paper-2` gives the image a field of its own and
              the print reads as having been made on tinted stock.

              Above the fold and the largest image on it: this is the LCP
              element, so it loads eagerly and at high priority.
            */}
            <img
              src="/img/yehuda-cut.webp"
              srcSet="/img/yehuda-cut-sm.webp 365w, /img/yehuda-cut.webp 551w"
              sizes="(min-width: 768px) 320px, 60vw"
              alt="Yehuda Briskman"
              width={551}
              height={845}
              fetchpriority="high"
              decoding="async"
              className="select-none bg-[rgb(var(--paper-2))]"
            />
          </Figure>

          <div className="min-w-0">
            {/*
              The second voice, and the only line on the page entitled to it.
              Between a 12px label and a 144px name there is nothing but a
              change of voice; in the serif italic the claim reads as
              something said rather than something printed.
            */}
            <p
              className="editorial text-[clamp(1.6rem,4vw,2.6rem)] text-ink animate-fade-up"
              style={{ animationDelay: "220ms" }}
            >
              Built to be used.
            </p>

            {/*
              The first sentence arrives a word at a time, pausing where the
              punctuation does. One line on the site gets this — an effect
              used twice stops being an emphasis and starts being a template.
            */}
            <WordStagger as="p" className="mt-6 max-w-[46ch] text-lg leading-[1.65] text-ink sm:text-xl">
              I ship products end to end: a Chrome extension in the Web Store, a
              self-hosted operations console, and the backends under both.
            </WordStagger>
            <p
              className="mt-6 max-w-[46ch] text-lg leading-[1.65] text-ink/70 animate-fade-up sm:text-xl"
              style={{ animationDelay: "280ms" }}
            >
              Then I write the checks that prove they still work somewhere that
              isn&rsquo;t my laptop.
            </p>

            {/*
              One primary action and one second. The descent to `#work` is the
              longest hop on the page — see lib/scrollToAnchor for why the
              easing is decided per click rather than by a rule on the
              document.
            */}
            <div
              className="mt-10 flex flex-wrap items-center gap-3 animate-fade-up sm:gap-4"
              style={{ animationDelay: "360ms" }}
            >
              <Action
                tone="solid"
                glyph="down"
                href="#work"
                onClick={(e) => {
                  if (scrollToAnchor("work")) e.preventDefault();
                }}
              >
                See the work
              </Action>
              <Action tone="outline" glyph="out" href="https://windom.app">
                windom.app
              </Action>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
