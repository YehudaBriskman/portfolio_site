/*
 * The run's curve, as one path (#181).
 *
 * Every card on the run plays the same lap (ProjectRun.module.css): `run-x`
 * carries the slot from `100cqw + 15%` to `-115%` of its own width, and
 * `run-y` lifts it by one full sine of `--run-amp`. Every card has the same
 * lap, so the cards' centres all lie on one curve that is fixed in the frame:
 * at lap p (0 at the reading end, 1 past the start), in the run's box,
 *
 *   x = W + 0.65c − p·(W + 1.3c)        y = H/2 + A·sin(2πp)
 *
 * for a run W wide and H tall, a card c wide and an amplitude A. That curve's
 * bounding box is half a card past each edge and one amplitude either side of
 * the middle, and the stylesheet sets the aurora's box to exactly that from
 * the same custom properties. Inside the box the curve is one period of a
 * sine — and a sine stretched to any box is still the sine — so the path is
 * declared once here, in a 1000 × 100 viewBox drawn with
 * `preserveAspectRatio="none"`.
 *
 * In the box, u = x / width runs left to right and p = 1 − u, so the height
 * is 50 − 50·sin(2πu) (y grows downward, and the card's `run-y` is +A at a
 * quarter lap).
 */

export const CURVE_W = 1000;
export const CURVE_H = 100;
const SAMPLES = 240;

/** The height of the curve at u (0..1, left to right), in viewBox units. */
export function curveY(u: number): number {
  return CURVE_H / 2 - (CURVE_H / 2) * Math.sin(2 * Math.PI * u);
}

/** The path, as straight pieces fine enough to be smooth at any size. */
export const CURVE_PATH = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const u = i / SAMPLES;
    pts.push(`${(u * CURVE_W).toFixed(2)} ${curveY(u).toFixed(3)}`);
  }
  return `M${pts.join(" L")}`;
})();

/** Where a card's centre is at lap p, in the run's box (left-to-right). */
export function cardCentre(p: number, W: number, H: number, c: number, A: number) {
  return {
    x: W + 0.65 * c - p * (W + 1.3 * c),
    y: H / 2 + A * Math.sin(2 * Math.PI * p),
  };
}

/** The curve's box in the run's box, as the stylesheet sets it. */
export function curveBox(W: number, H: number, c: number, A: number) {
  return { left: -0.65 * c, top: H / 2 - A, width: W + 1.3 * c, height: 2 * A };
}
