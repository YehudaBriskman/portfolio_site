import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/*
 * Layered ridgeline at sunset, mirrored in still water.
 *
 * Built as SVG paths rather than WebGL on purpose: it is a handful of shapes,
 * it stays sharp at any resolution, it costs a few KB against three.js's ~230,
 * it needs no GPU, and it cannot fail on a machine with WebGL disabled — which
 * is a failure this site has already had once.
 *
 * Depth comes from three things working together: each band is lighter and
 * lower-contrast than the one in front of it (aerial perspective), each moves
 * at a different rate on scroll, and the water repeats the whole arrangement
 * upside down at reduced opacity.
 */

/* Depth 0 = furthest (barely moves). Depth 1 = nearest (moves most). */
const LAYERS = [
  {
    id: "far",
    depth: 0.06,
    fill: "rgb(var(--haze))",
    opacity: 0.75,
    d: "M0,506 L96,468 L152,497 C208,520 268,502 330,510 C408,520 470,472 542,456 C612,441 664,483 726,472 C794,459 842,414 912,430 C982,446 1032,488 1102,480 C1184,471 1284,497 1362,487 L1440,499 L1440,600 L0,600 Z",
  },
  {
    id: "mid",
    depth: 0.13,
    fill: "rgb(var(--ridge))",
    opacity: 0.92,
    d: "M0,536 C120,512 214,528 306,518 C420,506 486,534 574,530 C676,525 742,494 838,505 C934,516 1010,540 1104,532 C1218,522 1338,540 1440,532 L1440,600 L0,600 Z",
  },
  {
    id: "near",
    depth: 0.22,
    fill: "rgb(var(--bitumen))",
    opacity: 0.96,
    d: "M0,551 C150,543 268,553 392,548 C528,542 654,556 806,551 C946,547 1128,557 1440,549 L1440,600 L0,600 Z",
  },
];

const HORIZON = 560;

/* Deterministic scatter — a fixed table, not Math.random, so the sky is the same
   sky on every render. */
const STARS: [number, number, number][] = [
  [80, 44, 1.0], [190, 92, 0.7], [286, 38, 1.2], [372, 120, 0.6], [455, 70, 0.9],
  [548, 148, 0.8], [630, 52, 1.1], [716, 110, 0.7], [800, 64, 0.9], [884, 168, 0.6],
  [962, 88, 1.0], [1046, 40, 0.8], [1130, 132, 0.7], [1216, 74, 0.9], [1302, 116, 0.6],
  [1378, 56, 0.8], [140, 170, 0.6], [508, 210, 0.7], [1000, 226, 0.6], [1290, 196, 0.7],
];

function SkyLife() {
  return (
    <g>
      {STARS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r * 1.7} fill="rgb(var(--bone))"
          opacity={0.42 + (i % 3) * 0.14}
          style={{ animation: `twinkle ${5 + (i % 4)}s ease-in-out ${i * 0.37}s infinite` }} />
      ))}
      {/* Cloud banks, drifting slowly across the whole width. */}
      {[{ y: 250, w: 420, o: 0.07, d: 96 }, { y: 322, w: 560, o: 0.06, d: 132 }, { y: 392, w: 340, o: 0.08, d: 110 }].map((c, i) => (
        <g key={i} style={{ animation: `drift ${c.d}s linear ${-i * 24}s infinite` }}>
          <ellipse cx={280 + i * 300} cy={c.y} rx={c.w / 2} ry="11" fill="rgb(var(--bone))" opacity={c.o} />
          <ellipse cx={280 + i * 300 + 1440} cy={c.y} rx={c.w / 2} ry="11" fill="rgb(var(--bone))" opacity={c.o} />
        </g>
      ))}
      {/* One flock, crossing above the ridgeline. */}
      <g style={{ animation: "cross 110s linear -46s infinite" }}>
        {[[0, 0], [16, -7], [31, -2], [46, -10], [60, -5]].map(([dx, dy], i) => (
          <path key={i}
            d={`M${dx},${432 + dy} q4.5,-4.5 9,0 M${dx + 9},${432 + dy} q4.5,-4.5 9,0`}
            stroke="rgb(var(--bitumen))" strokeWidth="1.6" fill="none" strokeLinecap="round"
            opacity={0.42 - i * 0.04}
            style={{ animation: `flap ${1.7 + i * 0.2}s ease-in-out infinite`, transformOrigin: `${dx + 9}px 432px` }} />
        ))}
      </g>
    </g>
  );
}


/* The shoreline and its tree, the nearest thing before the water. */
function Shore() {
  return (
    <g fill="rgb(var(--bitumen))">
      <path d={`M0,${HORIZON - 4} C260,${HORIZON - 8} 520,${HORIZON - 2} 820,${HORIZON - 5} C1080,${HORIZON - 8} 1280,${HORIZON - 3} 1440,${HORIZON - 6} L1440,${HORIZON} L0,${HORIZON} Z`} />
      {/* Tree: a trunk and a canopy built from overlapping ellipses, so the
          silhouette reads organic without shipping a bitmap. */}
      <g transform="translate(1156, 0)">
        <path d={`M-3,${HORIZON - 4} L-2,${HORIZON - 42} L-6,${HORIZON - 62} L-1,${HORIZON - 58} L2,${HORIZON - 78} L5,${HORIZON - 58} L9,${HORIZON - 66} L4,${HORIZON - 40} L4,${HORIZON - 4} Z`} />
        <ellipse cx="2" cy={HORIZON - 84} rx="46" ry="22" />
        <ellipse cx="-26" cy={HORIZON - 76} rx="26" ry="15" />
        <ellipse cx="30" cy={HORIZON - 74} rx="28" ry="16" />
        <ellipse cx="2" cy={HORIZON - 96} rx="30" ry="15" />
      </g>
      {/* Scrub along the bank — small marks that give the shoreline scale. */}
      {[
        [248, 8], [300, 11], [352, 6], [640, 9], [700, 7], [980, 10], [1044, 6], [1272, 9], [1330, 7],
      ].map(([x, h]) => (
        <path key={x} d={`M${x},${HORIZON - 3} L${x - 3},${HORIZON - 3 - h} M${x + 1},${HORIZON - 3} L${x + 4},${HORIZON - 4 - h} M${x},${HORIZON - 3} L${x},${HORIZON - 5 - h}`}
          stroke="rgb(var(--bitumen))" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      ))}
    </g>
  );
}

export default function Terrain() {
  const reduced = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const el = root.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // A single custom property drives every layer; each scales it by its
        // own depth in CSS, so this handler stays O(1) regardless of layer count.
        el.style.setProperty("--y", String(window.scrollY));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden" aria-hidden="true" style={{ ["--y" as string]: 0 }}>
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="presentation"
      >
        <defs>
          {/* Spans the sky only — 0 to the horizon — so the pale band sits exactly
              where the ridges meet it, which is what gives them their silhouette. */}
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--bitumen))" />
            <stop offset="38%" stopColor="rgb(var(--surface))" />
            <stop offset="68%" stopColor="rgb(var(--haze))" />
            <stop offset="88%" stopColor="rgb(var(--haze-2))" />
            <stop offset="100%" stopColor="rgb(var(--bone))" stopOpacity="0.92" />
          </linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--bone))" stopOpacity="0.80" />
            <stop offset="34%" stopColor="rgb(var(--haze-2))" stopOpacity="0.55" />
            <stop offset="100%" stopColor="rgb(var(--bitumen))" />
          </linearGradient>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="rgb(var(--sodium))" stopOpacity="0.55" />
            <stop offset="45%" stopColor="rgb(var(--sodium))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="rgb(var(--sodium))" stopOpacity="0" />
          </radialGradient>
          {/* The reflection is the scene again, softened — still water is not a mirror. */}
          <filter id="ripple" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0 1.4" />
          </filter>
          <clipPath id="above"><rect x="0" y="0" width="1440" height={HORIZON} /></clipPath>
          <clipPath id="below"><rect x="0" y={HORIZON} width="1440" height={900 - HORIZON} /></clipPath>
        </defs>

        <rect x="0" y="0" width="1440" height={HORIZON} fill="url(#sky)" />

        {/* ---------- above the waterline ---------- */}
        <g clipPath="url(#above)">
          <SkyLife />
          <circle cx="880" cy="524" r="150" fill="url(#sunGlow)" className="t-layer" style={{ ["--d" as string]: 0.04 }} />
          <circle cx="880" cy="524" r="42" fill="rgb(var(--sodium))" className="t-layer" style={{ ["--d" as string]: 0.04 }} />
          {LAYERS.map((l) => (
            <path key={l.id} d={l.d} fill={l.fill} opacity={l.opacity}
              className="t-layer" style={{ ["--d" as string]: l.depth }} />
          ))}
          <g className="t-layer" style={{ ["--d" as string]: 0.3 }}><Shore /></g>
        </g>

        {/* ---------- the water, and everything repeated in it ---------- */}
        <g clipPath="url(#below)">
          <rect x="0" y={HORIZON} width="1440" height={900 - HORIZON} fill="url(#water)" />
          <g transform={`translate(0, ${HORIZON * 2}) scale(1, -1)`} opacity="0.42" filter="url(#ripple)">
            <circle cx="880" cy="524" r="42" fill="rgb(var(--sodium))" />
            {LAYERS.map((l) => (
              <path key={l.id} d={l.d} fill={l.fill} opacity={l.opacity * 0.8} />
            ))}
            <Shore />
          </g>
        </g>
      </svg>
    </div>
  );
}
