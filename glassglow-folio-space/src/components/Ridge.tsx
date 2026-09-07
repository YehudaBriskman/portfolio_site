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
  return (
    <div className="pointer-events-none relative h-16 w-full" aria-hidden="true">
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
