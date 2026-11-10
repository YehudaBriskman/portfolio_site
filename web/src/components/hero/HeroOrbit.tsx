import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "@/components/hero/HeroOrbit.module.css";
import { useContent } from "@/content/store";
import type { Arrival } from "@/components/hero/ParticleWord";
import { topTech } from "@/components/hero/topTech";

/*
 * The orbit constellation: thin rings, dots, glass shards and a few chips
 * that fly in from both sides when the page loads, settle on a big ellipse
 * round the hero's content, and then STAY STILL. Desktop only, behind the
 * same gate as the particle word (it is only mounted when that says yes).
 *
 * No loop, no script per frame, no keyframes: the entrance is a CSS
 * transition from `data-phase="away"` to `"in"`, flipped once. The path
 * curves because each object is two nested boxes whose transforms ease
 * differently: the outer travels in x on a fast-out curve, the inner in y on
 * a slow-in-out one, so the composite is an arc rather than a diagonal.
 * `transform` and `opacity` only. It is `pointer-events: none`, `aria-hidden`
 * and painted behind the composition, so it can neither take a click nor sit
 * on the type; the horizontal travel is inside the hero's `overflow-x: clip`
 * (motion-contract §5's licence for sideways motion).
 *
 * The labels are real: the tools the site's own projects are built with,
 * counted from the content store (most used first, version tails folded), so
 * a chip is a claim the repository can check and nothing here is invented.
 */

type Hue = "sage" | "blue" | "sand" | "lilac";
type Item =
  | { kind: "dot"; x: number; y: number; hue: Hue; size: number }
  | { kind: "shard"; x: number; y: number; hue: Hue; rot: number }
  | { kind: "chip"; x: number; y: number; hue: Hue };

/* The ellipse the objects sit on, in % of the hero box. */
const CX = 50;
const CY = 50;
const RX = 47;
const RY = 41;
const on = (deg: number, k = 1) => ({
  x: CX + RX * k * Math.cos((deg * Math.PI) / 180),
  y: CY + RY * k * Math.sin((deg * Math.PI) / 180),
});

const LAYOUT: Item[] = [
  { kind: "dot", ...on(18), hue: "sage", size: 9 },
  { kind: "dot", ...on(52), hue: "lilac", size: 6 },
  { kind: "dot", ...on(118), hue: "sand", size: 8 },
  { kind: "dot", ...on(160), hue: "blue", size: 6 },
  { kind: "dot", ...on(205), hue: "sage", size: 10 },
  { kind: "dot", ...on(262), hue: "lilac", size: 6 },
  { kind: "dot", ...on(305), hue: "blue", size: 8 },
  { kind: "dot", ...on(338), hue: "sand", size: 6 },
  { kind: "dot", ...on(238, 1.1), hue: "blue", size: 5 },
  { kind: "dot", ...on(24, 0.9), hue: "lilac", size: 5 },
  { kind: "shard", ...on(14, 1.02), hue: "blue", rot: -24 },
  { kind: "shard", ...on(168, 1.02), hue: "sage", rot: 18 },
  { kind: "shard", ...on(250, 1.02), hue: "sand", rot: -12 },
  { kind: "shard", ...on(318, 1.02), hue: "lilac", rot: 26 },
  { kind: "chip", ...on(172), hue: "blue" },
  { kind: "chip", ...on(8), hue: "sage" },
  { kind: "chip", ...on(140, 0.98), hue: "sand" },
  { kind: "chip", ...on(40, 0.98), hue: "lilac" },
];

export default function HeroOrbit({ arrival }: { arrival: Arrival }) {
  const { projects } = useContent();
  const labels = useMemo(() => topTech(projects.map((p) => p.tech), 4), [projects]);
  const [phase, setPhase] = useState<"away" | "in">(arrival === "play" || arrival === "now" ? "in" : "away");

  useEffect(() => {
    if (arrival === "wait") return;
    /* A tick later than mount, so the `away` styles have been committed and
       the change is a transition and not a first paint. */
    const t = window.setTimeout(() => setPhase("in"), arrival === "play" ? 40 : 0);
    return () => window.clearTimeout(t);
  }, [arrival]);

  let chip = 0;
  return (
    <div className={styles.orbit} aria-hidden="true" data-phase={phase} data-instant={arrival === "now" ? "" : undefined} data-hero-orbit="">
      <svg className={styles.ring} viewBox="0 0 100 100" preserveAspectRatio="none">
        <ellipse cx={CX} cy={CY} rx={RX} ry={RY} />
        <ellipse cx={CX} cy={CY} rx={RX * 0.82} ry={RY * 0.78} className={styles.dashed} transform={`rotate(-8 ${CX} ${CY})`} />
      </svg>
      {LAYOUT.map((it, i) => {
        const side = it.x < 50 ? -1 : 1;
        const style = {
          left: `${it.x}%`,
          top: `${it.y}%`,
          "--sx": `${side * 62}vw`,
          "--sy": `${((i * 37) % 9) * 6 - 24}vh`,
          "--d": `${(i % 6) * 70}ms`,
        } as CSSProperties;
        if (it.kind === "chip") {
          const label = labels[chip++];
          if (!label) return null;
          return (
            <span key={i} className={styles.item} style={style}>
              <span className={styles.fly}>
                <span className={styles.rise}>
                  <span className={styles.chip} data-hue={it.hue}>
                    {label}
                  </span>
                </span>
              </span>
            </span>
          );
        }
        return (
          <span key={i} className={styles.item} style={style}>
            <span className={styles.fly}>
              <span className={styles.rise}>
                {it.kind === "dot" ? (
                  <span className={styles.dot} data-hue={it.hue} style={{ width: it.size, height: it.size }} />
                ) : (
                  <span className={styles.shard} data-hue={it.hue} style={{ transform: `rotate(${it.rot}deg)` }} />
                )}
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
