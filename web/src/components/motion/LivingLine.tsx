import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import styles from "@/components/motion/LivingLine.module.css";
import { STOPS, trace, type Station } from "@/components/motion/lineTrace";

/*
 * `line` — one hand-drawn line behind a whole page or section, drawn by the
 * reader's scroll (#176, #178).
 *
 * The primitive both /story and "How I work" use; there is no second one.
 *
 * HOW A CALLER USES IT
 * --------------------
 * Wrap the content. Mark the boxes the line should visit with `data-line`:
 *
 *   data-line="start" | "end"   the line runs down the lane on that side
 *                               (logical: the right-hand lane in Hebrew)
 *                               for the box's whole height;
 *   data-line="loop"            the line goes once round the box, which
 *                               holds a few words or a figure, and carries
 *                               on down. `data-line-pad` (px) is the
 *                               clearance between the box and the circle.
 *                               A loop inside a `data-line-hold` box (a
 *                               figure inside its principle) arrives at
 *                               the hold's top and leaves at its foot,
 *                               straight down the circle's side, so the
 *                               text beside the figure is never crossed.
 *
 * The lanes are this component's own inline padding (`--line-lane`), which
 * holds nothing, so a run down a lane cannot touch text; between stations
 * the line swings across the gap, which is margin and holds nothing either.
 * The geometry and the argument are in `lineTrace.ts`.
 *
 * MEASURED, NOT DECLARED
 * ----------------------
 * The path is computed from the laid-out boxes and recomputed whenever they
 * can have moved: a resize of the container (which also catches a picture
 * or a late font changing its height), a font finishing loading, and a
 * change of `dir` or `lang` on <html>. It is written straight onto the SVG
 * — no React state, no render per measurement, nothing per frame. The
 * scroll is entirely CSS: one keyframe on a view timeline, whose 101 stops
 * read custom properties this writes once per measurement (see the
 * stylesheet).
 *
 * The SVG is `aria-hidden`: the line carries no information, and the words
 * in a loop are real HTML text inside the box, read and translated like any
 * other text.
 *
 * The three off-switches land on the line fully drawn and still; that is
 * the resting declaration as well, so a page measured before its stylesheet
 * or in a browser with no scroll timeline shows the whole line.
 */

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

function read(root: HTMLElement): { stations: Station[]; lanes: { left: number; right: number }; width: number; height: number } {
  const r = root.getBoundingClientRect();
  const cs = getComputedStyle(root);
  const rtl = cs.direction === "rtl";
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const stations: Station[] = [];
  for (const el of root.querySelectorAll<HTMLElement>("[data-line]")) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    const local = (x: DOMRect) => ({ top: x.top - r.top, bottom: x.bottom - r.top, left: x.left - r.left, right: x.right - r.left });
    const box = local(b);
    const want = el.dataset.line;
    if (want === "loop") {
      const holder = el.parentElement?.closest<HTMLElement>("[data-line-hold]");
      const hold = holder && root.contains(holder) ? local(holder.getBoundingClientRect()) : undefined;
      stations.push({ kind: "loop", box, pad: Number(el.dataset.linePad ?? 0) || 0, hold });
    } else if (want === "start" || want === "end") {
      const left = (want === "start") !== rtl;
      stations.push({ kind: left ? "left" : "right", box });
    }
  }
  return {
    stations,
    lanes: { left: padL / 2, right: r.width - padR / 2 },
    width: r.width,
    height: r.height,
  };
}

export default function LivingLine({ className = "", children, ...rest }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const path = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    const s = svg.current;
    const p = path.current;
    if (!el || !s || !p) return;

    let last = "";
    const measure = () => {
      const { stations, lanes, width, height } = read(el);
      const t = trace(stations, lanes, height);
      const key = `${width}x${height}:${t.d}`;
      if (key === last) return;
      last = key;
      s.setAttribute("viewBox", `0 0 ${Math.max(1, Math.round(width))} ${Math.max(1, Math.round(height))}`);
      p.setAttribute("d", t.d);
      for (let i = 0; i <= STOPS; i += 1) p.style.setProperty(`--l${i}`, String(t.stops[i]));
    };

    measure();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
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
  }, []);

  return (
    <div {...rest} ref={root} className={`${styles.line} ${className}`.trimEnd()} data-living-line="">
      <svg ref={svg} className={styles.svg} aria-hidden="true" focusable="false" preserveAspectRatio="none">
        <path ref={path} className={styles.path} pathLength={1} />
      </svg>
      {children}
    </div>
  );
}
