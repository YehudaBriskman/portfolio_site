import { useState, useSyncExternalStore } from "react";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import type { LabelField } from "@/components/gallery/objectLabel";
import { useContent } from "@/content/store";
import { useLang } from "@/components/dashboard/i18n";
import { withHebrewName } from "@/data/identity";
import { useHomeWords } from "@/i18n/pages";
import HeroCorners from "@/components/HeroCorners";
import ParticleWord, { type Arrival as PwArrival } from "@/components/hero/ParticleWord";
import { useParticleGate } from "@/components/hero/useParticleGate";
import styles from "@/components/Hero.module.css";
import arrival from "@/components/HeroArrival.module.css";
import {
  getEntry,
  subscribeEntry,
  type Entry,
} from "@/components/motion/entry";

/*
 * The first screen is object zero: the name is rendered through the same
 * `ObjectLabel` as the work, at the one scale allowed to be bigger. The ink is
 * painted on frame one (a paper mask moves off it, no opacity entry), so LCP is
 * unaffected; the masks and their measurements are in HeroArrival.module.css.
 */

/*
 * The fields are a set of facts, not a layout: `ObjectLabel` sorts by kind. The
 * place comes first because it still says something when the line is cropped.
 * Two fields fit one line at every phone width; a live-projects count undersold
 * the work, so it is not shown.
 */
/* Parked, not removed: the particle word, its gate and their tests stay, the
   hero just does not use them. Turn this on to bring the word back. */
export const PARTICLE_WORD_ENABLED = false;

const plateFields = (
  plate: { where: string; shippingSince: number },
  since: (year: number) => string,
): LabelField[] => [
  { kind: "where", value: plate.where },
  { kind: "when", value: since(plate.shippingSince) },
];

/*
 * The one loading hint the figure needs, spelled the way React 18 will pass
 * on.
 *
 * `fetchPriority` — the camel-cased prop @types/react offers — is dropped by
 * React 18's DOM renderer with a console warning rather than written to the
 * element, so the attribute never reaches the preload scanner. Lowercase
 * attributes it does not recognise are forwarded untouched, which is the
 * whole of this constant. It can go back to being a plain prop on React 19.
 */
const PRIORITY: { fetchpriority: "high" } = { fetchpriority: "high" };

/*
 * Whether this hero is part of the visit's entry, and if so where it is.
 *
 *   "held"  mounted under the shutter, which has not finished lifting. The
 *           stylesheet holds every moving part on the arrival's first
 *           frame (#219) — painted, so LCP is decided as before, but under
 *           its paper, so the lifting tiles do not show a screen that has
 *           already arrived and then arrive it a second time.
 *   "play"  the shutter's last tile has finished leaving (`clearing`), or
 *           the sheet is gone. The arrival is declared, and so starts, in
 *           the commit the signal arrives in.
 *   absent  not part of the entry: mounted after the shutter left, or there
 *           was no shutter because motion is off. Nothing to play.
 *
 * Whether it is part of the entry is read once, at mount, and never again —
 * the store only moves forward, so a later read would only ever say "lifted"
 * and switch a playing arrival off halfway.
 */
type Arrival = "held" | "play" | undefined;

const alwaysLifted = (): Entry => "lifted";

function useArrival(): Arrival {
  const entry = useSyncExternalStore(subscribeEntry, getEntry, alwaysLifted);
  const [inEntry] = useState(() => getEntry() !== "lifted");
  if (!inEntry) return undefined;
  return entry === "covered" || entry === "lifting" ? "held" : "play";
}

export default function Hero({ pinnedBehindNextAct = true }: { pinnedBehindNextAct?: boolean }) {
  const arrives = useArrival();
  /* The plate's words from the content store (#163). */
  const { plate, plateTitle } = useContent().site;
  const w = useHomeWords();
  /* On the Hebrew page the fact line carries the owner's Hebrew spelling
     beside the Latin name (#308), as the server render does. */
  const fact = withHebrewName(plateTitle.fact, useLang());
  /*
    The desktop-only object: the particle word (the h1's own text, drawn as
    particles). `useParticleGate` is false on the
    server, on a phone or a coarse pointer, under reduced motion, Pause,
    forced colours, print, or without a canvas - and then neither is mounted
    and this is the static hero. See `hero/ParticleWord.tsx`.
  */
  const gate = useParticleGate(plateTitle.name);
  const particles = PARTICLE_WORD_ENABLED && gate;
  /* `?particles=settled` is the verification path: no entrance, assembled. */
  const settledOnly = typeof window !== "undefined" && window.location.search.includes("particles=settled");
  const pw: PwArrival = settledOnly ? "now" : arrives === "held" ? "wait" : arrives === "play" ? "play" : "now";
  return (
    /*
      `overflow-x: clip` and not `hidden`: the two remaining lines enter from
      their own sides, and a horizontal entry is the one gesture
      `docs/motion-contract.md` §5 bans outright — because the deleted
      `Reveal` pushed full-width sections past the right edge of the document
      and the page reported horizontal overflow until the reader scrolled
      that far. The travel here is 18px inside a gutter that is never less
      than 20px, so nothing reaches the edge; this is the guard that makes
      that a property of the section rather than an arithmetic coincidence.
      `clip` leaves the block axis alone, so the section is still a normal
      scrolling box and nothing inside it becomes a scroll container.
    */
    /*
      The holder is static and owns `--hero`; the hero inside it is held
      still until the next act has covered it (`Hero.module.css`).
    */
    <section id="hero" className={pinnedBehindNextAct ? `${styles.holder} ${styles.held}` : styles.holder}>
      <div className={`relative w-full ${styles.hero}`}>
        {/*
          `pt-28` is nav clearance, not rhythm: the island is fixed, 50px tall
          and 18px down, so the first line has to start below 68px.

          `safe center` rather than plain centring, which overflows in both
          directions the moment the content is taller than the screen — and the
          half above the top edge cannot be scrolled to. `safe` is the keyword for
          exactly this: centre while there is room, fall back to the start edge
          once there is not. A browser that does not know it drops the whole
          declaration and lands on flex-start, which is the same fallback.

          This box is the screen. The picture inside it is one flex item, and
          the figure is positioned against *that* rather than against the
          screen — which is the difference between a composition and two things
          that happen to be on the same page. Anchored to the viewport, the
          figure drifts away from the type on every window the layout was not
          tuned on: at 768×1024 it ends up a photograph in the bottom corner
          with a headline a third of a screen above it.
        */}
        <div className={`wrap flex min-h-[100svh] flex-col ${styles.screen}`}>
          {/*
            The picture: the figure and the label, in one box the height of the
            label. The section around it carries the `--hero` timeline every
            part of the picture reads.
          */}
          <div
            className={`${styles.composition} ${arrival.stage}`}
            data-arrival={arrives}
          >
            {/*
              The figure, out of flow and underneath the type.

              Out of flow is not a layout convenience: it is why this screen's
              CLS is still 0.000 with a photograph on it. An absolutely
              positioned box contributes no height to anything, so the figure
              cannot move a line of type however it is sized, and the
              `width`/`height` attributes below mean the box is the right shape
              before the bytes arrive.

              `fetchpriority="high"` because it is painted in the first frame —
              see the mask note in `HeroArrival.module.css`. Left at the
              default, the preload scanner finds it and the browser still ranks
              it below the stylesheet and the two webfonts, which is the right
              order for an image nobody sees for a second and the wrong one for
              a paint candidate.
            */}
            <div className={styles.portrait} data-portrait="">
              <picture>
                {/* Two widths of one file, chosen by the browser against the
                    screen's density (#127). `sizes` restates the box from
                    `Hero.module.css`: the column, capped at 22rem, below
                    700px (`100vw` less the two 1.25rem gutters), else
                    min(86vw, 26rem). It used to be a `media` switch that sent
                    every phone the 365px file, on the reasoning that the box
                    was never wider than 242 CSS px. It is 347 at 390 wide, so
                    a 3x phone was upscaling that file three times over.

                    551px is the largest master there is, and nothing here is
                    upscaled past it: a 2x phone now gets 0.79 file pixels per
                    device pixel instead of 0.51, and a 2x desktop stays at
                    0.66. A true 2x needs a master at least 1248px wide. */}
                <img
                  src="/img/yehuda-cut.webp"
                  srcSet="/img/yehuda-cut-sm.webp 365w, /img/yehuda-cut.webp 551w"
                  sizes="(max-width: 699px) min(calc(100vw - 2.5rem), 22rem), min(86vw, 26rem)"
                  alt={w.portraitAlt}
                  width={551}
                  height={845}
                  {...PRIORITY}
                  decoding="async"
                />
              </picture>
              {/* The paper the figure rises out from behind. Decorative in the
                  strictest sense — it is the absence of the picture — so it is
                  hidden from the accessibility tree and cannot be pointed at. */}
              <span
                className={arrival.mask}
                data-portrait-mask=""
                aria-hidden="true"
              />
            </div>

            {/*
              Four parts of one picture, each taken apart by the reader's scroll
              as the section leaves and put back as it returns.
              `HeroArrival.module.css` carries the ranges and the reasoning.

              `splitName` is the one new hook this needed from the shared label:
              a `transform` does nothing to a non-replaced inline box, so the
              letters have to be elements before anything can move them. It is
              off for every other object on the site, as `exposeFieldKinds` is —
              which writes each field's kind onto its `<li>` so the off-switches
              can be written against the kind rather than against the position
              `orderFields` happens to sort it into.
            */}
            <ObjectLabel
              scale="plate"
              nameAs="h1"
              name={plateTitle.name}
              fact={fact}
              fields={plateFields(plate, w.shippingSince)}
              exposeFieldKinds
              splitName
              className={styles.plate}
            />

            {/*
              The lower corners — issue #101. Out of flow against this box, so
              they are in neither of the two grid rows and cannot shrink the
              figure's track or move a line of type. The argument for each
              candidate is at the head of `HeroCorners.tsx`.
            */}
            <HeroCorners />
          </div>
        </div>
        {particles && <ParticleWord text={plateTitle.name} arrival={pw} />}
      </div>
    </section>
  );
}
