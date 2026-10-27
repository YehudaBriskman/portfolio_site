import { useEffect, useState } from "react";

/*
 * The page as a set of held photographic plates.
 *
 * One plate per section, each full-bleed and still. As a section takes the
 * viewport its plate cross-fades in over the one before it; nothing slides,
 * nothing parallaxes, nothing drifts.
 *
 * What this replaces, and why
 * ---------------------------
 * The plates used to rise from the foot of the screen as their section
 * arrived — 145vh tall, travelling from 100vh to -38vh, positioned by a
 * requestAnimationFrame loop that measured every section against every layer
 * on every frame. It was the site's one memorable idea and it cost four
 * transforms a frame, a permanent compositor texture per layer, a viewport of
 * runway padding per section, and a pile of overshoot constants.
 *
 * It also fought the photographs. A plate that is moving is a plate you are
 * reading past; a plate that holds still is a place the type is standing in.
 * That is what windom.app does with its wallpapers and what every reference
 * this direction is drawn from does with its imagery.
 *
 * So the ridgeline masks go too. They existed to shape a moving top edge, and
 * there is no longer an edge in motion to shape — section boundaries carry
 * that job now, in CSS, where a shape is one property rather than a path.
 */

/*
 * The three regions a plate can occupy.
 *
 * These were hard `clip-path` polygons, and a hard edge was the wrong tool
 * here for a reason that is not about taste. A plate is fixed to the
 * viewport and the content scrolls past it, so the cut sits at one screen
 * position for ever while the words move through it — which means that at
 * some scroll offset the diagonal will always run straight across a heading.
 * It did: a 1px edge slicing through "Stack" and its eyebrow, which reads as
 * a rendering fault rather than as a shape.
 *
 * A mask with a feathered edge says the same thing and survives the
 * collision. Text crossing a soft boundary reads as atmosphere; text
 * crossing a hard one reads as a bug. The feather is wide on purpose —
 * narrow enough to still be a shape, wide enough that no single line of type
 * ever sits on both sides of it at once.
 *
 * Expressed as masks rather than clip-paths because one property then
 * carries both the region and its falloff, and because a mask interpolates
 * between any two gradients while a clip-path only interpolates between
 * polygons with matching point counts.
 */
/** The whole screen. */
const FULL = "none";
/**
 * A column on the right, fading out before it reaches the reading. The
 * boundary is angled a few degrees so it does not read as a rule.
 */
const SLAB = "linear-gradient(96deg, transparent 30%, #000 54%, #000 100%)";
/**
 * A band across the top, falling away toward the left — the same slope the
 * polygon had, with 20% of the viewport given over to the fade.
 */
const BAND = "linear-gradient(176deg, #000 0%, #000 42%, transparent 64%)";

/** The four graded plates, by the stage of day they were shot at. */
export type Plate = "morning" | "afternoon" | "evening" | "night";

const PLATE_WIDTHS = [800, 1200, 1920] as const;

/**
 * A plate's srcset, one entry per generated width. The browser picks; we only
 * have to tell it the element is full-bleed, which `sizes="100vw"` does.
 */
function plateSrcSet(plate: Plate, ext: "avif" | "webp"): string {
  return PLATE_WIDTHS.map((w) => `/plates/plate-${plate}-${w}.${ext} ${w}w`).join(", ");
}

export type Layer = {
  id: string;
  /**
   * The ground colour. Still required: it fills the plate's own letterboxing
   * on an extreme aspect ratio, and it is what shows for the one layer that
   * has no photograph.
   */
  fill: string;
  /** Omitted on the ground layer, which is flat --bitumen and nothing else. */
  plate?: Plate;
  /**
   * How hard to hold the photograph down so text stays legible over it.
   *
   * A flat wash at this strength turns the picture to mud, which defeats the
   * point of having one, so the scrim is shaped: a pool under the reading
   * column and a gradient at the foot, leaving the middle distance alone.
   * Bright plates need more; the aurora needs almost none.
   */
  scrim: number;
  /**
   * The region of the screen this plate occupies, as a `clip-path`.
   *
   * A plate does not have to be the whole rectangle. Giving each section a
   * different shape is what stops four photographs behind four sections
   * reading as one wallpaper that keeps changing colour — the page gains a
   * geometry of its own, and the ground shows through where the shape stops.
   *
   * One rule: none of them puts a hard edge where the reading is, because a
   * fixed plate and scrolling text eventually meet and a hard edge loses
   * that argument. Omit, or use FULL, for full bleed.
   */
  shape?: string;
};

/*
 * Read down the page these are one journey: the dark ground under the hero,
 * an aurora over the work, a green evening for the approach, open water at the
 * stack, and the sun going down on the water at the contact — which is the
 * photograph the whole palette was sampled from, so the page ends on the image
 * it has been quoting all along.
 *
 * This table is the whole art direction. Re-cutting the story is four lines.
 */
export const LANDING_LAYERS: Layer[] = [
  { id: "hero", fill: "10 10 11", scrim: 0 },
  { id: "work", fill: "16 24 34", plate: "night", scrim: 0.58, shape: FULL },
  { id: "approach", fill: "18 30 26", plate: "evening", scrim: 0.52, shape: SLAB },
  { id: "stack", fill: "34 44 50", plate: "afternoon", scrim: 0.6, shape: BAND },
  { id: "contact", fill: "48 34 32", plate: "morning", scrim: 0.64, shape: FULL },
];

/*
 * Every area gets its own landscape, not a copy of the home page's.
 *
 * The stack is what makes that cheap: a page is a set of plates, a set of
 * ridges and a scrim strength, declared in one place. Projects reads as open
 * daylight, notes as an evening, a single post as one quiet warm room — and
 * none of them shifts when the landing page's story is re-cut.
 */
export const PROJECTS_LAYERS: Layer[] = [
  { id: "base", fill: "10 10 11", scrim: 0 },
  { id: "open", fill: "34 44 50", plate: "afternoon", scrim: 0.6, shape: BAND },
  { id: "far", fill: "16 24 34", plate: "night", scrim: 0.58, shape: FULL },
];

export const NOTES_LAYERS: Layer[] = [
  { id: "base", fill: "10 10 11", scrim: 0 },
  { id: "dusk", fill: "16 24 34", plate: "night", scrim: 0.58, shape: FULL },
  { id: "wood", fill: "18 30 26", plate: "evening", scrim: 0.52, shape: SLAB },
];

/*
 * A post is two layers and nothing else. Reading is the job here, so the
 * background changes once, slowly, and never asks for attention mid-paragraph —
 * and the scrim runs harder than anywhere else on the site for the same reason.
 */
export const POST_LAYERS: Layer[] = [
  { id: "base", fill: "10 10 11", scrim: 0 },
  { id: "warm", fill: "48 34 32", plate: "morning", scrim: 0.78 },
];

/** Kept as the neutral default for anything that does not choose. */
export const PAGE_LAYERS = PROJECTS_LAYERS;

export type LayerStackProps = {
  layers: Layer[];
};

/**
 * Which plate is showing.
 *
 * An IntersectionObserver over the page's own `[data-crest]` sections, rather
 * than arithmetic on scroll position: a cross-fade only needs to know which
 * section owns the viewport, and that is exactly the question an observer
 * answers without reading layout. The rootMargin picks the band across the
 * middle of the screen, so a plate changes when a section genuinely takes
 * over rather than the moment its first pixel appears.
 */
function useActiveSection(count: number) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-crest]")];
    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = sections.indexOf(e.target as HTMLElement);
          if (i >= 0) setActive(Math.min(i, count - 1));
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [count]);

  return active;
}

export default function LayerStack({ layers }: LayerStackProps) {
  const active = useActiveSection(layers.length);

  /*
   * Every plate is mounted and full-bleed; only opacity changes. Keeping them
   * all in the tree costs the four decoded images — around 400KB of AVIF
   * across the whole set — and buys a cross-fade with no blank frame, which
   * is the trade windom.app makes for the same reason.
   */
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {layers.map((l, i) => (
        <div
          key={l.id}
          data-plate={i}
          data-on={i === active ? "" : undefined}
          className="scene-plate absolute inset-0"
          style={
            {
              background: `rgb(${l.fill})`,
              maskImage: l.shape === "none" ? undefined : l.shape,
              WebkitMaskImage: l.shape === "none" ? undefined : l.shape,
            } as React.CSSProperties
          }
        >
          {l.plate && (
            <>
              <picture>
                <source type="image/avif" srcSet={plateSrcSet(l.plate, "avif")} sizes="100vw" />
                <source type="image/webp" srcSet={plateSrcSet(l.plate, "webp")} sizes="100vw" />
                {/*
                 * The first plate is what a reader meets one screen into the
                 * page, so it loads eagerly and at high priority. The rest
                 * are several sections down and can wait.
                 */}
                <img
                  src={`/plates/plate-${l.plate}-1200.jpg`}
                  alt=""
                  width={1920}
                  height={1080}
                  loading={i <= 1 ? "eager" : "lazy"}
                  fetchpriority={i === 1 ? "high" : "low"}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </picture>
              {/*
               * Only the plate's own edges. The reading pool that protects
               * the copy is a single viewport-anchored layer in Atmosphere —
               * it has to be, because the text is anchored to the viewport
               * too.
               */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, rgb(var(--bitumen) / ${l.scrim * 0.42}) 0%, transparent 22%, transparent 72%, rgb(var(--bitumen) / ${Math.min(1, l.scrim + 0.12)}) 100%)`,
                }}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
