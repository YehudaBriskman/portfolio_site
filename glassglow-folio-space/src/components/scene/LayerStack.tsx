/*
 * The page as a stack of photographic plates.
 *
 * One plate per section. Each is opaque and rises from the foot of the screen
 * as its section arrives, covering the one before it. Only a plate's top edge
 * is ever visible, so only the top edge is cut into a ridgeline — every bottom
 * stays hidden behind the next plate, all the way to the footer.
 *
 * A plate rises in two stages: first until its ridge sits high on the screen,
 * which is the moment the handover reads, then onward until the ridge has left
 * the top entirely and the photograph holds the whole page. Without that second
 * stage you spend the body of a section looking at the previous plate through
 * the gap above the ridge, which is a seam rather than a background.
 *
 * What changed, and why
 * ---------------------
 * These layers used to be flat fills with a landscape drawn on them: trees as
 * three ellipses and a zig-zag, birds as two 1.8px arcs, ripples as ellipses
 * 1.6px tall, all at opacities between 0.05 and 0.5, and thirty-nine infinite
 * animations keeping them moving. At that scale and that contrast it read as a
 * small clip-art drawing rather than as a place.
 *
 * The palette comment at the top of index.css says it was sampled from a
 * photograph — a lone tree against layered ridges at sunset, mirrored in still
 * water. So the fix is not to draw the landscape better. It is to stop drawing
 * it: the plates ARE that photograph and three others, graded to the same key
 * at build time (see scripts/build-plates.mjs).
 *
 * The ridgelines survive, because the handover is the one genuinely memorable
 * idea here — but as a MASK on the plate's top edge rather than as a silhouette
 * painted over it. You see the photograph through a ridge-shaped cut, which is
 * the same gesture with a real image behind it.
 */

/*
 * Ridges with big rounded crowns rather than gentle undulation. The tops are
 * near-circular arcs so the edge reads as a deliberate shape at a glance, which
 * a low swell does not. Unchanged from the drawn version — the shapes were
 * never the problem.
 */
const RIDGES = [
  "M0,420 L0,330 C64,330 96,196 244,196 C392,196 424,330 488,330 C556,330 588,168 736,168 C884,168 916,330 984,330 C1048,330 1080,214 1224,214 C1368,214 1392,330 1440,330 L1440,420 Z",
  "M0,420 L0,318 C56,318 84,206 214,206 C344,206 372,318 428,318 C500,318 528,150 684,150 C840,150 868,318 940,318 C1010,318 1038,228 1178,228 C1318,228 1386,318 1440,318 L1440,420 Z",
  "M0,420 L0,306 C72,306 104,168 262,168 C420,168 452,306 524,306 C596,306 624,222 762,222 C900,222 928,306 1000,306 C1072,306 1104,182 1252,182 C1400,182 1414,306 1440,306 L1440,420 Z",
  "M0,420 L0,336 C60,336 88,182 232,182 C376,182 404,336 464,336 C532,336 560,238 700,238 C840,238 868,336 936,336 C1008,336 1036,160 1196,160 C1356,160 1394,336 1440,336 L1440,420 Z",
];

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
  /** Which ridge cuts this plate's top edge. */
  d: string;
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
   * Per-plate accent, as an `R G B` triple.
   *
   * --sodium was measured once, against --bitumen, and then shipped over five
   * different grounds. On the warm plates it lands at roughly its own hue and
   * stops reading as an accent at all. Where that happens the layer names a
   * cooler or paler substitute, and everything under it inherits.
   */
  accent?: string;
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
  { id: "hero", fill: "15 21 21", d: RIDGES[0], scrim: 0 },
  { id: "work", fill: "16 24 34", d: RIDGES[0], plate: "night", scrim: 0.58 },
  { id: "approach", fill: "18 30 26", d: RIDGES[1], plate: "evening", scrim: 0.6 },
  { id: "stack", fill: "34 44 50", d: RIDGES[2], plate: "afternoon", scrim: 0.72, accent: "244 170 126" },
  { id: "contact", fill: "48 34 32", d: RIDGES[3], plate: "morning", scrim: 0.64, accent: "246 196 170" },
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
  { id: "base", fill: "15 21 21", d: RIDGES[0], scrim: 0 },
  { id: "open", fill: "34 44 50", d: RIDGES[2], plate: "afternoon", scrim: 0.72, accent: "244 170 126" },
  { id: "far", fill: "16 24 34", d: RIDGES[1], plate: "night", scrim: 0.58 },
];

export const NOTES_LAYERS: Layer[] = [
  { id: "base", fill: "15 21 21", d: RIDGES[0], scrim: 0 },
  { id: "dusk", fill: "16 24 34", d: RIDGES[3], plate: "night", scrim: 0.58 },
  { id: "wood", fill: "18 30 26", d: RIDGES[2], plate: "evening", scrim: 0.6 },
];

/*
 * A post is two layers and nothing else. Reading is the job here, so the
 * background changes once, slowly, and never asks for attention mid-paragraph —
 * and the scrim runs harder than anywhere else on the site for the same reason.
 */
export const POST_LAYERS: Layer[] = [
  { id: "base", fill: "15 21 21", d: RIDGES[0], scrim: 0 },
  { id: "warm", fill: "48 34 32", d: RIDGES[1], plate: "morning", scrim: 0.78, accent: "246 196 170" },
];

/** Kept as the neutral default for anything that does not choose. */
export const PAGE_LAYERS = PROJECTS_LAYERS;

export type LayerStackProps = {
  layers: Layer[];
  driveBy?: "sections" | "progress";
};

/*
 * Where the ridge rests once the handover lands, and how far past the top the
 * layer travels afterwards. The overshoot has to exceed the ridge's own height
 * on screen, or the crown never clears the viewport.
 * Exported because useScrollProgress does the positioning; see below.
 *
 * These also set how tall a layer needs to be. Its top travels from 100vh down
 * to (REST - OVERSHOOT) = -38vh, so 138vh of height is the minimum that still
 * covers the bottom of the screen at full overshoot; 145vh gives a margin.
 */
export const REST_VH = 28;
export const OVERSHOOT_VH = 66;
const SKY_VH = 30;

/**
 * The ridge as a mask rather than a drawing.
 *
 * Two mask layers: the ridge silhouette across the top band, and a plain
 * rectangle for everything below it. White is kept, so the photograph survives
 * from the ridgeline down and the sky above the crown belongs to whatever plate
 * is behind this one.
 */
function ridgeMask(d: string): React.CSSProperties {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 420' preserveAspectRatio='none'>` +
    `<path d='${d}' fill='%23fff'/></svg>`;
  const image = `url("data:image/svg+xml,${svg.replace(/#/g, "%23").replace(/"/g, "'")}"), linear-gradient(#fff, #fff)`;
  const size = `100% ${SKY_VH}vh, 100% ${145 - SKY_VH}vh`;
  const position = `top left, bottom left`;
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: size,
    WebkitMaskSize: size,
    maskPosition: position,
    WebkitMaskPosition: position,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };
}

export default function LayerStack({ layers, driveBy = "sections" }: LayerStackProps) {
  /*
   * Positioning happens in useScrollProgress, which writes transform straight
   * onto these elements. It used to be a calc() over a CSS custom property,
   * which looks tidy and is the wrong tool: a transform driven by a custom
   * property cannot take the compositor fast path, so every frame went through
   * style, layout and paint on the main thread — and because the property lived
   * on :root, each write invalidated style for the whole document. These
   * elements only declare what they are; the hook says where they are.
   *
   * `will-change` is deliberately absent. It used to be set statically on every
   * layer and never released, which held four full-viewport textures resident
   * for the session — roughly 36MB on a desktop and 68MB on a phone at DPR 3.
   * The hook now sets it on the first scroll and clears it once scrolling
   * stops.
   */
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {layers.map((l, i) => (
        <div
          key={l.id}
          data-layer={i}
          data-drive={driveBy}
          data-count={layers.length}
          data-rest={i === 0 ? undefined : ""}
          className="scene-layer absolute inset-x-0 top-0 h-[145vh]"
          style={
            {
              background: `rgb(${l.fill})`,
              ...(l.accent ? { "--sodium": l.accent } : {}),
              /*
               * No inline transform. The starting position is a stylesheet
               * rule (`.scene-layer`), so the reduced-motion resting pose can
               * override it in the normal way — an inline style would win over
               * both, which is how the resting scene ended up stuck at the
               * off-screen start position. At runtime the scroll hook writes
               * inline transforms and beats the stylesheet, which is exactly
               * the precedence we want when motion is allowed.
               */
            } as React.CSSProperties
          }
        >
          {l.plate && (
            <div className="absolute inset-0 overflow-hidden" style={ridgeMask(l.d)}>
              {/*
                The photograph occupies the top viewport of the layer, and the
                layer's own fill carries the rest.

                A plate is 145vh tall — tall enough that its ridge can climb
                clear of the screen — but the photographs are 16:9. Stretching
                one over the whole height with `object-cover` cropped roughly
                40% off each side and left a narrow vertical slice on screen,
                which is why four good pictures were reading as flat colour
                fields. Held to one viewport the crop is about a tenth, and the
                picture survives.
              */}
              <div className="absolute inset-x-0 top-0 h-screen overflow-hidden">
                <picture>
                  <source type="image/avif" srcSet={plateSrcSet(l.plate, "avif")} sizes="100vw" />
                  <source type="image/webp" srcSet={plateSrcSet(l.plate, "webp")} sizes="100vw" />
                  {/*
                   * The first plate is the largest thing on the first screen a
                   * reader scrolls to, so it loads eagerly and at high
                   * priority. The rest are several viewports further down and
                   * can wait.
                   */}
                  <img
                    src={`/plates/plate-${l.plate}-1200.jpg`}
                    alt=""
                    width={1920}
                    height={1080}
                    loading={i === 1 ? "eager" : "lazy"}
                    fetchpriority={i === 1 ? "high" : "low"}
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </picture>
                {/* Into the fill rather than onto an edge, so the join between
                    the photograph and the colour below it is not a line. */}
                <div
                  className="absolute inset-x-0 bottom-0 h-[26vh]"
                  style={{ background: `linear-gradient(to bottom, transparent, rgb(${l.fill}))` }}
                />
              </div>
              {/*
               * Only the plate's own edges are darkened here. The reading pool
               * that protects the text is a separate, viewport-anchored layer
               * in Atmosphere — see the note there. It used to live on this
               * element, which meant it travelled with the plate: by the time
               * a section's copy was on screen the pool had slid off the top
               * with the photograph it was attached to, and the text was left
               * sitting on whatever part of the picture happened to be behind
               * it.
               */}
              <div
                className="absolute inset-x-0 top-0 h-screen"
                style={{
                  background: `linear-gradient(to bottom, rgb(var(--bitumen) / ${l.scrim * 0.42}) 0%, transparent 22%)`,
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
