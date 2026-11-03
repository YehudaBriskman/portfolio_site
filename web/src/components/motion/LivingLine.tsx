import { useId, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import styles from "@/components/motion/LivingLine.module.css";
import { STOPS, compose, parseMoves, sample, scrollStops, type Box, type LineMove, type Station } from "@/components/motion/lineMoves";
import { strandPaths } from "@/components/motion/ribbon";
import { AuroraGradient, Strands } from "@/components/motion/Strands";

/*
 * `line` — one line behind a whole page or section, drawn by the reader's
 * scroll (#176, #178), composed from moves and dressed as the aurora (#191).
 *
 * The primitive both /story and "How I work" use; there is no second one.
 *
 * HOW A CALLER USES IT
 * --------------------
 * Wrap the content. Mark each box the line should visit with `data-line`,
 * holding its moves as JSON (`lineAttr(moves)` in `lineMoves.ts`; the
 * vocabulary is documented there). The moves belong to the content, so they
 * are written in data beside it — `data/story.ts`, `data/site.ts` — and any
 * amount of content draws a line: each box adds its own moves, and the
 * composer joins them with circular turns in the gaps.
 *
 *   data-line='[{"move":"line-to","lane":"start"}]'   down the start lane
 *   data-line='[{"move":"circle-around","pad":12}]'    once round the box
 *   data-line='[{"move":"origin","dot":true}]'         start here, with a dot
 *
 * The old keywords (`start`, `end`, `loop` with `data-line-pad`) still read
 * as their moves. A loop inside a `data-line-hold` box spends the hold's
 * height straight down the circle's tangent, so text beside it is never
 * crossed.
 *
 * `from` names one more station OUTSIDE the container — a selector and its
 * moves — as the line's start: on the home page, a full-bleed marker above
 * "How I work", whose `enter` move brings the line in from the page's left
 * edge and round the head (owner, 2026-11-03). A move there may say `until`
 * with a selector: the line runs straight down to the foot of that ancestor
 * before it turns. The drawing grows upward and outward to reach it, and
 * the clock grows with it.
 *
 * A line that comes in from an edge carries `data-enter` on its drawing,
 * and its lead — the run in from the edge — is not drawn by the tip but
 * uncovered by a soft window from that edge, the work run's appearing
 * (`motion/AuroraStrand`), before the tip takes over (the stylesheet).
 *
 * MEASURED, NOT DECLARED
 * ----------------------
 * The path is computed from the laid-out boxes and recomputed whenever they
 * can have moved: a resize of the container or of the document (which also
 * catches a picture or a late font, and the origin moving above it), a font
 * finishing loading, and a change of `dir` or `lang` on <html>. It is
 * written straight onto the SVG — no React state, no render per
 * measurement, nothing per frame. The scroll is entirely CSS: one keyframe
 * on a view timeline, whose 101 stops read custom properties this writes
 * once per measurement (see the stylesheet).
 *
 * THE LOOK
 * --------
 * The aurora's ribbon (`Strands.tsx`): six fine strands braided about the
 * path, gathered to a point at each end, with no glow under them (a wide faint stroke cost a tenth of the
 * frame rate at 4x throttle; measured, #191), in the run's
 * colours repeating down the page. The ribbon is as wide as the lanes allow
 * — the composer is told its half-width and keeps that clear of every box.
 *
 * The SVG is `aria-hidden`: the line carries no information, and the words
 * in a loop are real HTML text inside the box. The three off-switches land
 * on the line fully drawn and still; that is the resting declaration as
 * well.
 */

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** The line's start, outside the container: an element, and the moves it makes. */
  from?: { selector: string; moves: readonly LineMove[] };
};

/** How many strands the line's ribbon has. */
export const LINE_STRANDS = 5;
/** The colours repeat every this many px down the line. */
const PERIOD = 1100;

type Read = { stations: Station[]; lanes: { left: number; right: number }; rtl: boolean; half: number; width: number; height: number };

function read(root: HTMLElement, from?: Props["from"]): Read {
  const r = root.getBoundingClientRect();
  const cs = getComputedStyle(root);
  const rtl = cs.direction === "rtl";
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const local = (x: DOMRect): Box => ({ top: x.top - r.top, bottom: x.bottom - r.top, left: x.left - r.left, right: x.right - r.left });
  const stations: Station[] = [];

  const add = (el: HTMLElement, given?: readonly LineMove[]) => {
    const b = el.getBoundingClientRect();
    const raw = given ?? parseMoves(el.dataset.line, Number(el.dataset.linePad ?? 0) || 0);
    /* `until: <selector>` is the foot of that ancestor, measured here. */
    const moves = raw.map((m): LineMove => {
      if (typeof m.until !== "string" || m.until === "top" || m.until === "bottom") return m;
      const to = el.closest<HTMLElement>(m.until);
      return to ? { ...m, y: local(to.getBoundingClientRect()).bottom } : m;
    });
    const holder = el.parentElement?.closest<HTMLElement>("[data-line-hold]");
    const hold = holder && root.contains(holder) ? local(holder.getBoundingClientRect()) : undefined;
    stations.push({ box: local(b), moves, hold });
  };

  const origin = from ? document.querySelector<HTMLElement>(from.selector) : null;
  if (from && origin && !root.contains(origin) && origin.getClientRects().length) add(origin, from.moves);
  for (const el of root.querySelectorAll<HTMLElement>("[data-line]")) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0 && !el.dataset.line?.includes("origin")) continue;
    add(el);
  }
  /* The ribbon fills the lane less a margin either side, up to 9px a side. */
  const lane = Math.min(padL, padR);
  const half = Math.max(2, Math.min(9, lane / 2 - 4));
  return { stations, lanes: { left: padL / 2, right: r.width - padR / 2 }, rtl, half, width: r.width, height: r.height };
}

export default function LivingLine({ className = "", children, from, ...rest }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const gid = `line-aurora-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useLayoutEffect(() => {
    const el = root.current;
    const s = svg.current;
    if (!el || !s) return;
    const strands = [...s.querySelectorAll<SVGPathElement>("[data-strand]")];
    const dot = s.querySelector<SVGCircleElement>("[data-line-dot]");

    let last = "";
    const measure = () => {
      const m = read(el, from);
      const c = compose(m.stations, { lanes: m.lanes, rtl: m.rtl, half: m.half });
      /* The drawing reaches up to the start when the start is above the box,
         and out to the page's edge when the line comes in from it. */
      const top = Math.min(0, Math.floor(c.top - m.half - 12));
      const height = Math.max(1, m.height - top);
      const left = Math.min(0, Math.floor(c.left - m.half - 12));
      const width = Math.max(1, Math.max(Math.round(m.width), Math.ceil(c.right + m.half + 12)) - left);
      const key = `${m.width}x${m.height}:${top}:${left}:${width}:${m.half}:${c.d}`;
      if (key === last) return;
      last = key;
      s.setAttribute("viewBox", `${left} ${top} ${width} ${Math.round(height)}`);
      s.style.setProperty("top", `${top}px`);
      s.style.setProperty("height", `${height}px`);
      s.style.setProperty("left", `${left}px`);
      s.style.setProperty("width", `${width}px`);
      if (c.enter) s.setAttribute("data-enter", c.enter);
      else s.removeAttribute("data-enter");
      s.style.setProperty("--line-half", `${m.half}px`);
      const ds = strandPaths(sample(c.segs, 8), { count: strands.length, half: m.half, wave: 280, taper: 160 });
      strands.forEach((p, i) => p.setAttribute("d", ds[i] ?? ""));
      const first = c.dots[0];
      if (dot) {
        dot.setAttribute("cx", String(first?.x ?? 0));
        dot.setAttribute("cy", String(first?.y ?? 0));
        dot.setAttribute("r", first ? String(Math.max(3, m.half * 0.6)) : "0");
      }
      const stops = scrollStops(c, top, m.height);
      for (let i = 0; i <= STOPS; i += 1) s.style.setProperty(`--l${i}`, String(stops[i]));
    };

    measure();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    /* The start can sit outside the container; the document's size moving is how it moves. */
    if (from) ro?.observe(document.documentElement);
    const mo = typeof MutationObserver === "function" ? new MutationObserver(measure) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["dir", "lang"] });
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    fonts?.addEventListener?.("loadingdone", measure);
    void fonts?.ready?.then(measure);
    return () => {
      ro?.disconnect();
      mo?.disconnect();
      fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [from]);

  const stroke = `url(#${gid})`;
  return (
    <div {...rest} ref={root} className={`${styles.line} ${className}`.trimEnd()} data-living-line="">
      <svg ref={svg} className={styles.svg} aria-hidden="true" focusable="false" preserveAspectRatio="none">
        <defs>
          <AuroraGradient id={gid} period={PERIOD} />
        </defs>
        <Strands stroke={stroke} count={LINE_STRANDS} strandClassName={styles.ink} pathLength={1} />
        <circle className={styles.dot} fill={stroke} r="0" data-line-dot="" />
      </svg>
      {children}
    </div>
  );
}
