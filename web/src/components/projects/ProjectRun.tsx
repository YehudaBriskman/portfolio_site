import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
} from "react";
import { Link } from "react-router-dom";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import Plate from "@/components/projects/Plate";
import Shot from "@/components/projects/Shot";
import { arrival, newestYear } from "@/components/projects/pileArrival";
import type { ProjectEntry } from "@/hooks/useProjects";
import styles from "@/components/projects/ProjectRun.module.css";
import { objectAnchorId } from "@/lib/objectAnchor";
import RunAurora from "@/components/projects/RunAurora";

/*
 * The work, travelling along a curve (#57, reopened by the owner 2026-11-02).
 *
 * The home page's peak. The stage pins, and while it is held the reader's
 * scroll carries the projects in from the reading end (the right in English,
 * the left in Hebrew, #168) and along one snaking line,
 * each card held at the angle of the curve where it is. Several are on screen
 * at once, partly cropped at the edges, so the run reads as one continuous
 * line rather than as a slideshow of separate arrivals. Scrolling back up
 * runs every card back along the same line, exactly: the only clock is the
 * scroll position, as in the contribution city (#111).
 *
 * It replaced the pile (`ProjectPile`, still the catalogue's) on the owner's
 * call. The pile's argument was that a lateral shelf shows one card at a time;
 * a run held at this spacing shows two to three on a laptop, which is the
 * part of that argument the curve answers.
 *
 * ── what this file does ───────────────────────────────────────────────────
 *
 * Very little, as the pile did. It writes each card's index and the card's
 * own arrival (`pileArrival.ts`, carried over unchanged: the state picks the
 * gesture, the year how much of it is left) as custom properties, and the
 * stylesheet does the rest — because all three off-switches are at-rules or a
 * class on `body`, none of which an inline style can see. No state, no
 * observer, no scroll listener, no per-frame work.
 *
 * The one piece of script is the keyboard answer. A card's place on screen is
 * a transform driven by the scroll position, so Tab reaching a card that is
 * still off at the reading end has nothing the browser can scroll sideways to: the
 * frame clips, it does not scroll. So on focus the page is scrolled — the
 * real scroll container, the document — to the moment that card stands in
 * the middle of the curve. The moment is not computed here: each card has a
 * zero-height marker in the static stage, placed by the stylesheet at that
 * card's point in the runway, and focus asks the browser to scroll the marker
 * to the top. The formula lives once, in CSS, beside the ranges that use it.
 * With motion off the markers are inert and the browser's own focus scrolling
 * does the job on the plain list.
 *
 * The second is the tilt (#177). Under a fine pointer, the card the pointer is
 * over turns a few degrees towards it in 3D. One passive `pointermove` on the
 * list notes where the pointer is and, at most once a frame, writes where it
 * sits on the card as two numbers from -1 to 1 (`--tilt-x`, `--tilt-y`) on
 * the card's face. That is all it does: no React state, no re-render, and the
 * stylesheet turns the numbers into a rotation, so the three off-switches and
 * touch, which are all at-rules or a class, simply never apply them. The face
 * is an element inside the link, so its transform is its own and never
 * overwrites the lean or the arrival the link carries; and the link, which
 * does not tilt, is what is hovered, so the hit area holds still while the
 * face turns.
 *
 * Behind the cards runs the aurora (#181, `RunAurora.tsx`): one line of
 * light on the cards' own path, so every card is visibly on the same road
 * as its neighbours. Decoration, `aria-hidden`, all stylesheet.
 *
 * And a way past it: a skip link ahead of the run, visible on focus, that
 * moves focus to just after the stage, so a keyboard reader is never made to
 * walk the cards to leave the act.
 *
 * ── the markup ────────────────────────────────────────────────────────────
 *
 * An ordered list of links, one link per card wrapping the whole object, the
 * same contract as the pile and for the same reasons (see ProjectPile.tsx):
 * the order is content, the list is the whole fallback, and the link's name is
 * the label. No carousel role, no live region, no buttons: it is a list that
 * happens to be laid along a line while motion is on.
 */

export type ProjectRunProps = {
  entries: ProjectEntry[];
  /** The list's accessible name. */
  label: string;
  /** The heading level of each card's name; the home page's head is an h2. */
  heading: "h2" | "h3";
};

/*
 * Above 700px a card is at most 28rem in the run and 40rem in the plain list;
 * on a phone it is four fifths of the window in the run and the full
 * column in the list. The larger of each pair is the hint.
 */
const SHOT_SIZES = "(min-width: 700px) 640px, 92vw";

/** Four of the stack on a stand-in plate, as on the pile. */
const PLATE_TECH = 4;

/**
 * The arrival's origin as offsets from the card's centre.
 *
 * `pileArrival` speaks `transform-origin` ("50% 100%"), but on the run the
 * card's origin belongs to the lean, which pivots on the centre; so the
 * arrival's keyframe carries its own origin as a translate pair and needs it
 * as two lengths. "0% 50%" becomes "-50%" and "0%".
 */
function originOffsets(origin: string): CSSProperties {
  const [x = "50%", y = "50%"] = origin.split(" ");
  const off = (v: string) => `${Number.parseFloat(v) - 50}%`;
  return { "--arrive-ox": off(x), "--arrive-oy": off(y) } as CSSProperties;
}

/** Is the run actually moving? One read covers all three off-switches. */
function running(slot: Element): boolean {
  return getComputedStyle(slot).animationName !== "none";
}

export default function ProjectRun({ entries, label, heading }: ProjectRunProps) {
  const onFocus = useCallback((e: FocusEvent<HTMLOListElement>) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>("[data-run-i]");
    if (!slot || !running(slot)) return;
    const stage = slot.closest<HTMLElement>("[data-run-stage]");
    const marker = stage?.querySelector<HTMLElement>(
      `[data-run-mark="${slot.dataset.runI}"]`
    );
    /* `instant` and not smooth: focus has already moved, and a smooth scroll
       here would be the page moving on its own for half a second. */
    marker?.scrollIntoView({ behavior: "instant", block: "start" });
  }, []);

  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let card: HTMLElement | null = null;
    let face: HTMLElement | null = null;
    let x = 0;
    let y = 0;
    let frame = 0;

    const unit = (v: number) => Math.max(-1, Math.min(1, v)).toFixed(3);
    const write = () => {
      frame = 0;
      if (!card || !face) return;
      const r = card.getBoundingClientRect();
      face.style.setProperty("--tilt-x", unit(((x - r.left) / r.width) * 2 - 1));
      face.style.setProperty("--tilt-y", unit(((y - r.top) / r.height) * 2 - 1));
    };
    const release = () => {
      face?.style.removeProperty("--tilt-x");
      face?.style.removeProperty("--tilt-y");
      card = face = null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !fine.matches) return;
      const next = (e.target as Element).closest<HTMLElement>("[data-run-card]");
      if (next !== card) {
        release();
        const slot = next?.closest("[data-run-i]");
        /* Off-switches on, or touch: nothing is written at all. */
        if (next && slot && running(slot)) {
          card = next;
          face = next.querySelector<HTMLElement>("[data-run-face]");
        }
      }
      if (!card) return;
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(write);
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      release();
    };

    list.addEventListener("pointermove", onMove, { passive: true });
    list.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      list.removeEventListener("pointermove", onMove);
      list.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  }, []);

  const skip = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(e.currentTarget.hash.slice(1));
    if (!target) return;
    e.preventDefault();
    target.focus({ preventScroll: false });
  }, []);

  if (entries.length === 0) return null;

  const newest = newestYear(entries);
  const onward = "work-run-onward";

  return (
    <div className={styles.act}>
      <a
        href={`#${onward}`}
        onClick={skip}
        className={`${styles.skip} sr-only focus:not-sr-only`}
      >
        Skip past the work
      </a>

      {/*
        The static stage owns the clock: it is as tall as the frame plus the
        runway, it keeps travelling while the frame inside it is held, and its
        named view timeline is what every card reads. See §1 of
        docs/motion-contract.md for why the name has to be up here.
      */}
      <div
        className={styles.stage}
        data-run-stage=""
        style={{ "--run-n": entries.length } as CSSProperties}
      >
        {entries.map((entry, i) => (
          /*
            Each card's moment: a zero-height box in the runway, placed by the
            stylesheet where that card crosses the middle of the window. Focus
            scrolls to it, and the chrome's `#object-<slug>` anchor lands on it.
            `aria-hidden` and outside the list, so the list still announces
            exactly its projects.
          */
          <span
            key={`mark-${entry.collection.slug}`}
            id={objectAnchorId(entry.collection.slug)}
            data-run-mark={i}
            className={styles.mark}
            style={{ "--run-i": i } as CSSProperties}
            aria-hidden="true"
          />
        ))}

        <div className={styles.frame}>
          {/* The aurora along the cards' path (#181), behind the list. */}
          <RunAurora />
          <ol ref={listRef} className={styles.run} aria-label={label} onFocus={onFocus}>
            {entries.map((entry, i) => {
              const { collection: c } = entry;
              const arrive = arrival(entry, newest);
              return (
                <li
                  key={c.slug}
                  data-run-i={i}
                  className={styles.slot}
                  style={
                    {
                      "--run-i": i,
                      ...(entry.tint ? { "--run-tint": entry.tint.join(" ") } : {}),
                      ...arrive,
                      ...originOffsets(arrive["--arrive-origin"]),
                    } as CSSProperties
                  }
                >
                  <Link to={`/projects/${c.slug}`} className={styles.card} data-run-card="">
                    <div className={styles.face} data-run-face="">
                      <div className={styles.shot}>
                        {c.coverImage ? (
                          <Shot src={c.coverImage} alt="" sizes={SHOT_SIZES} />
                        ) : (
                          <Plate
                            className={styles.plate}
                            title={c.title}
                            tech={entry.tech.slice(0, PLATE_TECH)}
                          />
                        )}
                      </div>
                      <div className={styles.plinth}>
                        <ObjectLabel
                          name={c.title}
                          fact={c.tagline}
                          fields={entry.fields}
                          scale="object"
                          nameAs={heading}
                          className={styles.label}
                        />
                        <span className={styles.onward} aria-hidden="true">
                          &rarr;
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Where the skip link lands: focusable by script only, so the next Tab
          goes on to whatever follows the act. */}
      <span id={onward} tabIndex={-1} className={styles.onwardMark} />
    </div>
  );
}
