/*
 * Per-section scenery. The atmosphere gives each band its colour; this gives it
 * something in it.
 *
 * Rules that keep it from becoming noise:
 *  - anchored to a section edge, never floating in the middle of the reading area
 *  - right-weighted, because the copy column is on the left
 *  - low opacity and always behind content (-z-0 inside a relative section)
 *  - decorative only: aria-hidden, no information lives here
 */

type Variant = "ridge" | "copse" | "shore" | "ripples";

/* A far range along the foot of a section — the ridgeline you are level with. */
function Ridge() {
  return (
    <svg viewBox="0 0 1440 220" preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full" role="presentation">
      <path d="M0,168 L118,120 L186,152 C250,180 322,150 392,158 C470,166 536,120 610,104 C676,90 726,132 792,122 C864,110 916,64 990,80 C1062,96 1114,140 1186,132 C1268,122 1352,150 1440,138 L1440,220 L0,220 Z"
        fill="rgb(var(--haze-2))" opacity="0.16" />
      <path d="M0,190 C140,172 260,190 384,182 C520,173 624,196 760,190 C900,183 1080,200 1440,188 L1440,220 L0,220 Z"
        fill="rgb(var(--bitumen))" opacity="0.30" />
      {/* two birds, riding the ridge line */}
      <g opacity="0.30" style={{ animation: "cross 130s linear -70s infinite" }}>
        {[[0, 0], [22, -9]].map(([dx, dy], i) => (
          <path key={i} d={`M${dx},${74 + dy} q5,-5 10,0 M${dx + 10},${74 + dy} q5,-5 10,0`}
            stroke="rgb(var(--bitumen))" strokeWidth="1.8" fill="none" strokeLinecap="round"
            style={{ animation: `flap ${1.9 + i * 0.3}s ease-in-out infinite`, transformOrigin: `${dx + 10}px 74px` }} />
        ))}
      </g>
    </svg>
  );
}

/* A stand of trees cut by the right edge — the haze band, at tree height. */
function Copse() {
  const trees: [number, number, number][] = [
    [1180, 1.0, 0.42], [1268, 0.72, 0.30], [1338, 1.18, 0.50], [1412, 0.6, 0.24],
  ];
  return (
    <svg viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full" role="presentation">
      {trees.map(([x, sc, o], i) => (
        /* Two nested groups on purpose. A CSS `transform` animation overrides an
           SVG transform ATTRIBUTE outright — with both on one element the sway
           silently discarded the translate and scale, and the whole stand drew
           at the origin, off-canvas. Position on the outer, animate the inner. */
        <g key={x} transform={`translate(${x}, 300) scale(${sc})`} opacity={o}>
          <g style={{ animation: `sway ${7 + i * 1.4}s ease-in-out ${i * 0.8}s infinite`, transformOrigin: "0px 0px" }}>
            <path d="M-2,0 L-1,-52 L-5,-72 L0,-68 L2,-88 L4,-68 L8,-76 L3,-50 L3,0 Z" fill="rgb(var(--haze-2))" />
            <ellipse cx="1" cy="-96" rx="38" ry="18" fill="rgb(var(--haze-2))" />
            <ellipse cx="-20" cy="-88" rx="21" ry="12" fill="rgb(var(--haze-2))" />
            <ellipse cx="24" cy="-86" rx="23" ry="13" fill="rgb(var(--haze-2))" />
          </g>
        </g>
      ))}
      {[248, 268].map((y, i) => (
        <ellipse key={y} cx={1240 + i * 90} cy={y} rx={230 - i * 40} ry="7"
          fill="rgb(var(--bone))" opacity={0.07}
          style={{ animation: `drift ${140 + i * 40}s linear ${-i * 30}s infinite` }} />
      ))}
    </svg>
  );
}

/* The bank: reeds and mooring posts, level with the horizon. */
function Shore() {
  return (
    <svg viewBox="0 0 1440 180" preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full" role="presentation">
      <path d="M0,150 C240,142 520,156 820,148 C1080,141 1280,154 1440,146 L1440,180 L0,180 Z"
        fill="rgb(var(--bitumen))" opacity="0.28" />
      {[1104, 1142, 1178].map((x, i) => (
        <rect key={x} x={x} y={150 - 34 + i * 6} width="4" height={34 - i * 6}
          fill="rgb(var(--bitumen))" opacity="0.32" />
      ))}
      {[1040, 1062, 1080, 1218, 1250, 1284, 1318, 1360, 1398].map((x, i) => (
        <path key={x} d={`M${x},152 C${x + 2},${126 - (i % 3) * 7} ${x - 3},${112 - (i % 2) * 9} ${x + 4},${98 - (i % 3) * 8}`}
          stroke="rgb(var(--bitumen))" strokeWidth="1.7" fill="none" strokeLinecap="round" opacity="0.34"
          style={{ animation: `sway ${4.5 + (i % 3)}s ease-in-out ${i * 0.25}s infinite`, transformOrigin: `${x}px 152px` }} />
      ))}
    </svg>
  );
}

/* Still water: a few slow bands of light, nothing more. */
function Ripples() {
  return (
    <svg viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full" role="presentation">
      {[70, 116, 158, 196, 228].map((y, i) => (
        <ellipse key={y} cx={720 + (i % 2 ? 180 : -160)} cy={y} rx={340 - i * 34} ry={1.6}
          fill="rgb(var(--bone))" opacity={0.10 - i * 0.012}
          style={{ animation: `drift ${170 + i * 34}s linear ${-i * 26}s infinite` }} />
      ))}
    </svg>
  );
}

const VARIANTS: Record<Variant, { Shape: () => JSX.Element; height: number }> = {
  ridge:   { Shape: Ridge,   height: 220 },
  copse:   { Shape: Copse,   height: 300 },
  shore:   { Shape: Shore,   height: 180 },
  ripples: { Shape: Ripples, height: 260 },
};

export default function Scenery({ variant }: { variant: Variant }) {
  const { Shape, height } = VARIANTS[variant];
  return (
    <div
      className="pointer-events-none absolute bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden"
      style={{ height }}
      aria-hidden="true"
    >
      <Shape />
    </div>
  );
}
