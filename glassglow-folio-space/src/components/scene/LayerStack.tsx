/*
 * The page as a stack of layers.
 *
 * One layer per section. Each is opaque and rises from the foot of the screen
 * as its section arrives, covering the one before it. Only a layer's top edge
 * is ever visible, so only the top edge is a ridgeline — every bottom stays
 * hidden behind the next layer, all the way to the footer.
 *
 * A layer rises in two stages: first until its ridge sits high on the screen,
 * which is the moment the handover reads, then onward until the ridge has left
 * the top entirely and its colour holds the whole page. Without that second
 * stage you spend the body of a section looking at the previous layer through
 * the gap above the ridge, which is a seam rather than a background.
 *
 * Each layer also carries its own sky: clouds, birds, a sun, trees on its own
 * slope. They belong to the layer and travel with it, so they arrive as part of
 * the handover rather than floating over the page independently of it.
 *
 * Colours are the site's palette, and the ramp is measured. The least forgiving
 * text is --sodium at 12px needing 4.5:1, which caps any layer at L=0.035.
 * These five sit under that ceiling while swinging across hue, so consecutive
 * steps are 8 to 26 dE apart and read as different colours, not shades of one.
 */

/* The ground layer is --bitumen exactly. Anything else leaves a seam wherever a
   section's own gradient resolves to the token instead of to this. */
export type Scenery = "clouds" | "birds" | "trees" | "sun" | "stars";
export type Layer = {
  id: string;
  fill: string;
  d: string;
  /* A second ridge behind the first, lighter, to give the layer its own depth
     rather than one flat silhouette. */
  back?: string;
  scenery?: Scenery[];
};

/*
 * Ridges with big rounded crowns rather than gentle undulation. The tops are
 * near-circular arcs so the edge reads as a deliberate shape at a glance, which
 * a low swell does not.
 */
const RIDGES = [
  "M0,420 L0,330 C64,330 96,196 244,196 C392,196 424,330 488,330 C556,330 588,168 736,168 C884,168 916,330 984,330 C1048,330 1080,214 1224,214 C1368,214 1392,330 1440,330 L1440,420 Z",
  "M0,420 L0,318 C56,318 84,206 214,206 C344,206 372,318 428,318 C500,318 528,150 684,150 C840,150 868,318 940,318 C1010,318 1038,228 1178,228 C1318,228 1386,318 1440,318 L1440,420 Z",
  "M0,420 L0,306 C72,306 104,168 262,168 C420,168 452,306 524,306 C596,306 624,222 762,222 C900,222 928,306 1000,306 C1072,306 1104,182 1252,182 C1400,182 1414,306 1440,306 L1440,420 Z",
  "M0,420 L0,336 C60,336 88,182 232,182 C376,182 404,336 464,336 C532,336 560,238 700,238 C840,238 868,336 936,336 C1008,336 1036,160 1196,160 C1356,160 1394,336 1440,336 L1440,420 Z",
];

/*
 * Read down the page these are one journey: night on the hero, first light over
 * the work, open day for the approach, a treeline at the stack, and the sun
 * going down on the water at the contact. Each layer is its own place — its own
 * ridge, its own depth, its own weather — and the order is the story.
 */
export const LANDING_LAYERS: Layer[] = [
  { id: "hero", fill: "15 21 21", d: RIDGES[0] },
  { id: "work", fill: "35 35 35", d: RIDGES[0], back: RIDGES[2], scenery: ["stars", "clouds"] },
  { id: "approach", fill: "28 44 58", d: RIDGES[1], back: RIDGES[3], scenery: ["clouds", "birds"] },
  { id: "stack", fill: "64 45 30", d: RIDGES[2], back: RIDGES[0], scenery: ["trees"] },
  { id: "contact", fill: "85 40 18", d: RIDGES[3], back: RIDGES[1], scenery: ["sun", "birds"] },
];

/*
 * Every area gets its own landscape, not a copy of the home page's.
 *
 * The layer stack is what makes that cheap: a page is a colour ramp, a set of
 * ridges and its own weather, declared in one place. Projects reads as open
 * daylight, notes as an evening, a single post as one quiet warm room — and
 * none of them shifts when the landing page's story is re-cut.
 */
export const PROJECTS_LAYERS: Layer[] = [
  { id: "base", fill: "15 21 21", d: RIDGES[0] },
  { id: "open", fill: "35 35 35", d: RIDGES[2], back: RIDGES[0], scenery: ["clouds"] },
  { id: "far", fill: "28 44 58", d: RIDGES[1], back: RIDGES[3], scenery: ["birds"] },
];

export const NOTES_LAYERS: Layer[] = [
  { id: "base", fill: "15 21 21", d: RIDGES[0], scenery: ["stars"] },
  { id: "dusk", fill: "28 44 58", d: RIDGES[3], back: RIDGES[1], scenery: ["stars", "clouds"] },
  { id: "wood", fill: "64 45 30", d: RIDGES[2], back: RIDGES[0], scenery: ["trees"] },
];

/*
 * A post is two layers and nothing else. Reading is the job here, so the
 * background changes once, slowly, and never asks for attention mid-paragraph.
 */
export const POST_LAYERS: Layer[] = [
  { id: "base", fill: "15 21 21", d: RIDGES[0] },
  { id: "warm", fill: "64 45 30", d: RIDGES[1], back: RIDGES[3], scenery: ["sun"] },
];

/** Kept as the neutral default for anything that does not choose. */
export const PAGE_LAYERS = PROJECTS_LAYERS;

/*
 * Scenery is drawn in the sky above the ridge, in the layer's own colour
 * lightened or darkened rather than in a new one, so it reads as weather in
 * that landscape instead of decoration laid on top of it.
 */
/*
 * Scenery, split by what the compositor can actually take.
 *
 * Everything that MOVES is an HTML element with a CSS transform on it, because
 * the compositor can animate those on its own thread. Everything that STAYS
 * still lives in the ridge's SVG, where it is rasterised once with the terrain.
 *
 * That division is the whole point. These were all SVG <g> elements with
 * animations on them, and animating inside an SVG forces the browser to
 * re-rasterise the entire promoted layer texture every frame — measured at 35ms
 * a frame on a throttled phone, against 0 for the same shapes held still.
 */

/** Moving pieces: HTML wrappers, transform-animated, cheap to composite. */
function MovingScenery({ kind }: { kind: Scenery }) {
  if (kind === "clouds") {
    return (
      <>
        {[
          { top: "16%", scale: 1, dur: 190, delay: 0 },
          { top: "30%", scale: 0.7, dur: 260, delay: -40 },
          { top: "10%", scale: 0.5, dur: 330, delay: -80 },
        ].map((c, i) => (
          <div
            key={i}
            className="absolute left-0 w-[200%] motion-reduce:!animate-none"
            style={{
              top: c.top,
              opacity: 0.16,
              animation: `drift ${c.dur}s linear ${c.delay}s infinite`,
            }}
          >
            <svg viewBox="0 0 2880 60" preserveAspectRatio="none" className="h-[6vh] w-full" role="presentation">
              {[0, 1440].map((x) => (
                <g key={x} transform={`translate(${x + i * 260}, 30) scale(${c.scale})`}>
                  <ellipse cx="120" cy="0" rx="150" ry="17" fill="rgb(var(--bone))" />
                  <ellipse cx="210" cy="-9" rx="86" ry="13" fill="rgb(var(--bone))" />
                </g>
              ))}
            </svg>
          </div>
        ))}
      </>
    );
  }

  if (kind === "birds") {
    return (
      <div
        className="absolute left-0 top-[22%] w-[16%] motion-reduce:!animate-none"
        style={{ opacity: 0.5, animation: "cross 96s linear -20s infinite" }}
      >
        <svg viewBox="0 0 200 40" className="h-[4vh] w-full" role="presentation">
          <g fill="none" stroke="rgb(var(--bone))" strokeWidth="2.6" strokeLinecap="round">
            {[[0, 22], [46, 8], [88, 28], [132, 12], [176, 24]].map(([x, y], i) => (
              <path key={i} d={`M${x},${y} q9,-8 18,0 q9,-8 18,0`} />
            ))}
          </g>
        </svg>
      </div>
    );
  }

  if (kind === "stars") {
    return (
      <>
        {[
          [6, 10, 3.1], [17, 19, 4.2], [29, 8, 2.6], [39, 23, 5.0], [49, 13, 3.6],
          [61, 7, 4.6], [70, 21, 2.9], [82, 11, 5.4], [92, 18, 3.3],
        ].map(([left, top, dur], i) => (
          <div
            key={i}
            className="absolute h-[3px] w-[3px] rounded-full bg-bone motion-reduce:!animate-none"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              opacity: 0.5,
              animation: `twinkle ${dur}s ease-in-out ${-i * 0.7}s infinite`,
            }}
          />
        ))}
      </>
    );
  }

  return null;
}

/** Still pieces: drawn into the ridge's own SVG and rasterised once with it. */
function StillScenery({ kind, fill, at }: { kind: Scenery; fill: string; at: "sky" | "surface" }) {
  const ink = `rgb(${fill})`;

  if (at === "surface") {
    if (kind !== "sun") return null;
    return (
      <g>
        {[
          [352, 24, 7], [372, 64, 9], [346, 102, 7], [338, 136, 6],
        ].map(([w, dy, h], i) => (
          <rect key={i} x={1090 - w / 2} y={336 + dy} width={w} height={h} rx={h / 2}
                fill="rgb(var(--sodium))" opacity={0.5 - i * 0.1} />
        ))}
      </g>
    );
  }

  if (kind === "trees") {
    /*
     * A treeline, and a still one. Twenty-two trees each running their own sway
     * was the single most expensive thing on the page; a forest on a distant
     * ridge does not visibly move anyway.
     */
    const TREES: Array<[number, number, number]> = [
      [176, 214, 0.62], [206, 196, 0.8], [232, 180, 0.95], [262, 170, 1.1],
      [292, 176, 1.0], [320, 190, 0.84], [348, 208, 0.66], [376, 226, 0.54],
      [640, 268, 0.5], [676, 246, 0.64], [712, 232, 0.78], [748, 224, 0.9],
      [784, 228, 0.82], [820, 240, 0.68], [856, 258, 0.55],
      [1148, 226, 0.6], [1184, 204, 0.78], [1220, 188, 0.98], [1256, 184, 1.06],
      [1292, 194, 0.88], [1326, 212, 0.7], [1358, 234, 0.56],
    ];
    return (
      <g>
        {TREES.map(([x, y, sc], i) => (
          <g key={i} transform={`translate(${x}, ${y}) scale(${sc})`}>
            <path d="M0,0 L-13,0 L0,-44 L13,0 Z" fill={ink} />
            <path d="M0,-16 L-9,-16 L0,-54 L9,-16 Z" fill={ink} />
            <rect x="-1.6" y="-3" width="3.2" height="6" fill={ink} />
          </g>
        ))}
      </g>
    );
  }

  if (kind === "sun") {
    return (
      <g>
        <circle cx="1090" cy="150" r="118" fill="rgb(var(--sodium) / 0.13)" />
        <circle cx="1090" cy="150" r="46" fill="rgb(var(--sodium) / 0.85)" />
      </g>
    );
  }

  return null;
}

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
 * It was 200vh, and five surfaces of that size cost a 67ms hitch on the first
 * scroll while the compositor rasterised them.
 */
export const REST_VH = 28;
export const OVERSHOOT_VH = 66;
const SKY_VH = 30;

export default function LayerStack({ layers, driveBy = "sections" }: LayerStackProps) {
  /*
   * Positioning happens in useScrollProgress, which writes transform straight
   * onto these elements. It used to be a calc() over a CSS custom property,
   * which looks tidy and is the wrong tool: a transform driven by a custom
   * property cannot take the compositor fast path, so every frame went through
   * style, layout and paint on the main thread — and because the property lived
   * on :root, each write invalidated style for the whole document. After a
   * flick the ridges visibly arrived late. These elements only declare what
   * they are; the hook says where they are.
   */
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {layers.map((l, i) => {
        return (
          <div
            key={l.id}
            data-layer={i}
            data-drive={driveBy}
            data-count={layers.length}
            className="absolute inset-x-0 top-0 h-[145vh] motion-reduce:!transform-none"
            style={
              i === 0
                ? { background: `rgb(${l.fill})` }
                : {
                    // Starts off-screen; the hook takes over on first frame.
                    transform: "translate3d(0, 100vh, 0)",
                    willChange: "transform",
                  }
            }
          >
            {i > 0 && (
              <>
                <div className="relative w-full overflow-hidden" style={{ height: `${SKY_VH}vh` }}>
                  {(l.scenery ?? []).map((k) => (
                    <MovingScenery key={k} kind={k} />
                  ))}
                  <svg
                    viewBox="0 0 1440 420"
                    preserveAspectRatio="none"
                    className="absolute inset-0 block h-full w-full"
                    role="presentation"
                  >
                    {(l.scenery ?? []).map((k) => (
                      <StillScenery key={k} kind={k} fill={l.fill} at="sky" />
                    ))}
                  {/* The far ridge sits behind, lifted and washed out, so each
                      layer has its own distance rather than one flat edge. */}
                    {l.back && (
                      <path d={l.back} fill={`rgb(${l.fill})`} opacity="0.55" transform="translate(0, -46)" />
                    )}
                    <path d={l.d} fill={`rgb(${l.fill})`} />
                    {(l.scenery ?? []).map((k) => (
                      <StillScenery key={`${k}-s`} kind={k} fill={l.fill} at="surface" />
                    ))}
                  </svg>
                </div>
                <div className="h-[115vh] w-full" style={{ background: `rgb(${l.fill})` }} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
