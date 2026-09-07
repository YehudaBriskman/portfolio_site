/*
 * The page is the landscape, read top to bottom: night sky at the hero, down
 * through the ridgeline and the haze, to the pale water at the foot of the page.
 *
 * Four fixed layers, cross-faded by document progress. Colour cannot be
 * interpolated from a custom property in CSS, so instead each band is a static
 * gradient whose OPACITY is a function of --p. Cheap (four composited layers,
 * no repaint), and it means the whole document shares one atmosphere rather
 * than each section inventing its own background.
 */
const BANDS = [
  {
    id: "sky",
    // visible 0 -> 0.35
    opacity: "calc(1 - clamp(0, var(--p, 0) / 0.35, 1))",
    background:
      "linear-gradient(to bottom, rgb(var(--bitumen)) 0%, rgb(var(--surface)) 60%, rgb(var(--haze) / 0.55) 100%)",
  },
  {
    id: "ridge",
    // peaks around 0.35
    opacity: "min(clamp(0, (var(--p, 0) - 0.06) / 0.26, 1), clamp(0, (0.64 - var(--p, 0)) / 0.26, 1))",
    background:
      "linear-gradient(to bottom, rgb(var(--surface)) 0%, rgb(var(--ridge)) 55%, rgb(var(--haze) / 0.7) 100%)",
  },
  {
    id: "haze",
    // peaks around 0.68
    opacity: "min(clamp(0, (var(--p, 0) - 0.38) / 0.26, 1), clamp(0, (0.98 - var(--p, 0)) / 0.26, 1))",
    background:
      "linear-gradient(to bottom, rgb(var(--ridge)) 0%, rgb(var(--haze)) 50%, rgb(var(--haze-2) / 0.85) 100%)",
  },
  {
    id: "water",
    // visible 0.72 -> 1
    opacity: "clamp(0, (var(--p, 0) - 0.72) / 0.28, 1)",
    background:
      "linear-gradient(to bottom, rgb(var(--haze-2) / 0.55) 0%, rgb(var(--surface)) 45%, rgb(var(--bitumen)) 100%)",
  },
];

import Drifters from "@/components/scene/Drifters";

export default function Atmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      {BANDS.map((b) => (
        <div
          key={b.id}
          className="absolute inset-0"
          style={{ background: b.background, opacity: b.opacity }}
        />
      ))}
      <Drifters />
      {/* Keeps content legible wherever a band is at its palest. Sits ABOVE the
          drifters so nothing decorative can ever reduce text contrast. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgb(var(--bitumen) / 0.92) 0%, rgb(var(--bitumen) / 0.72) 45%, rgb(var(--bitumen) / 0.55) 100%)",
        }}
      />
    </div>
  );
}
