/*
 * What lives on the water, at the foot of the page.
 *
 * Sky inhabitants (stars, clouds, birds) belong inside the hero scene instead:
 * the hero paints an opaque sky, so anything in a layer behind it is simply
 * never seen. These appear only once the hero has scrolled away, which is why
 * they can live in a fixed layer without ever colliding with it.
 *
 * All of it is decorative and aria-hidden. It must never compete with the type,
 * which is why nothing exceeds ~0.5 opacity and everything sits in the right
 * half where the copy is not.
 */

/* Deterministic scatter — a fixed table rather than Math.random, so the sky is
   the same sky on every visit and between renders. */
export default function Drifters() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* ---- the water: reeds and a boat, only once you are down there ---- */}
      <svg
        viewBox="0 0 1440 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-x-0 bottom-0 h-[38vh] w-full"
        style={{ opacity: "clamp(0, (var(--p, 0) - 0.70) / 0.22, 1)" }}
        role="presentation"
      >
        {/* a small boat, far out */}
        <g transform="translate(1088, 120)" opacity="0.5">
          <path d="M-16,10 L16,10 L11,17 L-11,17 Z" fill="rgb(var(--bitumen))" />
          <path d="M0,10 L0,-16 L13,10 Z" fill="rgb(var(--bitumen))" />
          <path d="M0,10 L0,-16 L-9,10 Z" fill="rgb(var(--bitumen))" opacity="0.8" />
          {/* its reflection */}
          <g transform="translate(0, 34) scale(1,-1)" opacity="0.28">
            <path d="M-16,10 L16,10 L11,17 L-11,17 Z" fill="rgb(var(--bitumen))" />
            <path d="M0,10 L0,-16 L13,10 Z" fill="rgb(var(--bitumen))" />
          </g>
        </g>
        {/* reeds along the near bank */}
        {[64, 88, 104, 126, 1268, 1300, 1338, 1372].map((x, i) => (
          <path
            key={x}
            d={`M${x},300 C${x + 2},${262 - (i % 3) * 9} ${x - 3},${244 - (i % 2) * 12} ${x + 4},${226 - (i % 3) * 10}`}
            stroke="rgb(var(--bitumen))"
            strokeWidth="1.7"
            fill="none"
            strokeLinecap="round"
            opacity="0.55"
            style={{ animation: `sway ${4 + (i % 3)}s ease-in-out ${i * 0.3}s infinite`, transformOrigin: `${x}px 300px` }}
          />
        ))}
      </svg>
    </div>
  );
}
