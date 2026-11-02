import { AURORA_STOPS } from "@/components/motion/ribbon";
import styles from "@/components/motion/Strands.module.css";

/*
 * The aurora's ribbon, rendered (#192, #191): the run's aurora and the
 * living line both draw their light with these two pieces, so the site has
 * one ribbon and one set of colours. The geometry is `ribbon.ts`; the
 * weight and strength of each strand are `Strands.module.css`, by index.
 *
 * `AuroraGradient` is the colours. Along the run it spans the curve left to
 * right; down the living line it repeats every `period` px of height, so a
 * line of any length cycles through the same light.
 *
 * `Strands` is a group of fine paths. A caller either hands it the path
 * data (`ds`, the run's static curve) or writes `d` onto the paths itself
 * after measuring (the living line); `count` is how many to render then.
 * Everything is decoration: the caller's SVG is `aria-hidden`.
 */

export function AuroraGradient({ id, period }: { id: string; period?: number }) {
  const stops = AURORA_STOPS.map(([at, colour]) => <stop key={at} offset={at} stopColor={colour} />);
  if (period) {
    return (
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={period} spreadMethod="repeat">
        {stops}
      </linearGradient>
    );
  }
  return (
    <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
      {stops}
    </linearGradient>
  );
}

type StrandsProps = {
  /** `url(#…)` of the gradient. */
  stroke: string;
  ds?: readonly string[];
  count?: number;
  className?: string;
  /** Each strand's own class, e.g. the living line's dash clock. */
  strandClassName?: string;
  pathLength?: number;
};

export function Strands({ stroke, ds, count, className = "", strandClassName = "", pathLength }: StrandsProps) {
  const n = ds?.length ?? count ?? 0;
  return (
    <g className={`${styles.ribbon} ${className}`.trimEnd()} stroke={stroke} data-strands={n}>
      {Array.from({ length: n }, (_, i) => (
        <path
          key={i}
          d={ds?.[i]}
          data-strand={i}
          className={`${styles.strand} ${strandClassName}`.trimEnd()}
          pathLength={pathLength}
        />
      ))}
    </g>
  );
}
