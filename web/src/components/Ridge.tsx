/*
 * Section boundary as a ridgeline rather than a rule.
 * Uniform hairlines between every section are the broadsheet tell, and they make
 * every section read as equally weighted. A silhouette carries the same job and
 * keeps the landscape running down the page.
 */
const SHAPES = [
  "M0,48 C160,26 268,44 392,34 C520,24 618,46 742,40 C880,33 1040,50 1200,38 C1320,29 1390,40 1440,36 L1440,64 L0,64 Z",
  "M0,40 C120,52 240,30 360,38 C500,47 604,26 728,32 C868,39 1010,24 1160,36 C1290,46 1380,34 1440,42 L1440,64 L0,64 Z",
  "M0,44 L96,30 C200,20 300,44 420,40 C560,35 660,50 800,44 C930,38 1080,26 1210,40 C1320,52 1390,44 1440,46 L1440,64 L0,64 Z",
];

export default function Ridge({ variant = 0, flip = false }: { variant?: number; flip?: boolean }) {
  // Runs to the gutters of whatever column it is placed in, so a horizon is a
  // horizon rather than a floating bar with a gap at each end.
  //
  // `.bleed-x` and not `left-1/2 w-screen -translate-x-1/2`: `100vw` counts the
  // scrollbar, so that recipe is 8-17px wider than the visible page on every
  // scrolling document and reports an overflow forever. The horizon only ever
  // needed to escape the padding.
  return (
    <div className="bleed-x pointer-events-none relative h-16" aria-hidden="true">
      <svg
        viewBox="0 0 1440 64"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        style={flip ? { transform: "scaleY(-1)" } : undefined}
        role="presentation"
      >
        <path d={SHAPES[variant % SHAPES.length]} fill="rgb(var(--edge) / 0.55)" />
        <path
          d={SHAPES[(variant + 1) % SHAPES.length]}
          fill="rgb(var(--bitumen) / 0.85)"
          transform="translate(0, 8)"
        />
      </svg>
    </div>
  );
}
