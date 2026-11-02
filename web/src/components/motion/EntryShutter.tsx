import { useEffect, useState, type CSSProperties } from "react";
import { MOTION_PAUSED_KEY } from "@/components/nav/useMotionPaused";
import styles from "@/components/motion/EntryShutter.module.css";

/*
 * The page arrives from behind a grid.
 *
 * On first entry the window is black, overlaid with a grid of squares drawn as
 * thin glowing borders. When the app is actually ready the squares leave one
 * at a time, radiating outward from the centre of the window, uncovering the
 * site underneath. `EntryShutter.module.css` draws it and argues about the
 * colours; this file owns the two questions that are not about drawing.
 *
 * WHAT "READY" MEANS, AND WHY IT IS NOT A NUMBER
 * ----------------------------------------------
 * A loader that always runs for 1.2s is a 1.2s tax dressed as polish. So
 * there is **no floor**: the tiles start leaving the moment the page under
 * them is worth looking at, which on a warm cache is a frame or two and is
 * supposed to be. A returning reader should catch a flicker of the grid or
 * nothing at all, and that is the device working rather than the device
 * failing to show itself off.
 *
 * "Worth looking at" is two conditions and no more:
 *
 *   - `document.fonts.ready` — the display face carries the name, which is
 *     the largest thing on the first screen. Uncovering it mid-swap means
 *     the first thing the reader sees is the fallback face, followed by the
 *     name changing width under their eyes.
 *   - every image **in the first screen** has settled. On the home page that
 *     is the portrait, and the whole hero composition is the photograph
 *     behind the type; below-the-fold images are explicitly not waited on,
 *     because a shutter that waits for the whole document is a shutter that
 *     waits for the notes shelf.
 *
 * Both are races this cannot lose: an `error` settles an image as firmly as a
 * `load` does, and a browser with no `document.fonts` at all resolves
 * immediately.
 *
 * And there **is** a ceiling, because a promise that never settles would
 * otherwise be a black window forever. 1800ms is past the point where any of
 * this is still polish: beyond it the honest thing is to show the reader the
 * page in whatever state it is in. It is deliberately not tuned to the
 * sequence's own length — it is the deadline for the *page*, not for the
 * animation.
 *
 * THE OFF-SWITCHES, AND WHY THE FIRST ONE IS HERE
 * -----------------------------------------------
 * `docs/motion-contract.md` §4 wants every exit to land on the finished state.
 * The finished state of this device is *gone*, and the only honest way to
 * give a reader who asked for no motion no loader — rather than a fast one —
 * is to never put it in the document. So the two conditions are read during
 * the first render, before anything has been painted, and the component
 * returns `null` for the whole of its life if either holds. The stylesheet
 * carries them as well; that is the second lock and it says why.
 *
 * The stored Pause preference is read **here** and not left to the class, and
 * this is the one place on the site where that distinction is worth the import.
 * `useMotionPaused` restores the stored choice in an effect, so for a
 * returning reader who pressed Pause last visit `body.motion-paused` is not on
 * the body yet at first render. A scroll-driven animation can afford that
 * one frame — at scroll 0 nothing on the first screen is mid-move. One frame
 * of the entire window going black is not, so this reads the key directly.
 *
 * NO-JS, FOR FREE
 * ---------------
 * The overlay is rendered by React and appears nowhere in `index.html`. A
 * reader with scripting off therefore gets the page with no shutter over it,
 * which is the requirement — and it is satisfied by where this component is
 * mounted rather than by anything it does. An opaque element in the HTML that
 * only JavaScript removes would be the version of this feature that can hide
 * the site completely, and it is not a version of it that exists.
 */

/** The deadline on readiness. See the argument above. */
const CEILING_MS = 1800;

/**
 * How long a tile takes to go, and how long the wave takes to cross the
 * window. Both are also in the stylesheet, which is where they are argued
 * about; they are here because the unmount has to outlast them.
 */
const TILE_MS = 320;
const SPREAD_MS = 420;

/**
 * When the sheet leaves the document.
 *
 * One frame of margin past the last tile, and it is a `setTimeout` rather than
 * an `animationend` on purpose. This is §4's fourth exit — the one no
 * stylesheet can see: an engine that runs no CSS animations, a tab backgrounded
 * mid-sequence, a stylesheet that failed to load. Any of them means no
 * `animationend` ever arrives, and a shutter waiting for one would be a black
 * window with no way out. A clock cannot fail to fire.
 */
const UNMOUNT_MS = TILE_MS + SPREAD_MS + 80;

/**
 * The target edge of a tile, in CSS pixels.
 *
 * 72px is the size at which a square reads as a tile. Much smaller and the
 * grid reads as texture — a screen door over the page, where no individual
 * square is the thing leaving. Much larger and there are nine of them and the
 * window reads as a panel being taken apart rather than a surface dissolving.
 */
const TILE_PX = 72;

/**
 * The bounds on the count, and the two different things they protect.
 *
 * The floor is about the picture: below four to a side there is no wave to
 * see, because the centre tile and the corner tile are neighbours. The
 * ceiling is about the cost — at 24 by 16 this is 384 elements in React's
 * first commit, on a page whose entire first paint is 140ms, and the point
 * past which an ultrawide monitor would be paying real main-thread time for
 * squares nobody can count.
 */
const COLS = { min: 4, max: 24 };
const ROWS = { min: 4, max: 16 };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * The grid, and one delay per tile.
 *
 * Built once, from the window it is actually covering. Not rebuilt on resize:
 * the device's whole life is under a second, a window that is resized during
 * it has a reader who is not looking at the page anyway, and a grid that
 * re-flowed mid-dissolve would restart every tile's animation from a new
 * delay.
 */
type Grid = { cols: number; rows: number; colTracks: string; rowTracks: string; delays: readonly number[] };

/**
 * The track sizes, as whole pixels that add up to the window exactly.
 *
 * `repeat(13, 1fr)` is the obvious way to divide 900px and it produces a grid
 * of visibly uneven line weight. A track is then 69.2188px, so some tile
 * boundaries land on a whole device pixel and some do not — a hairline on a
 * whole pixel is painted crisp and one on a fraction is antialiased across
 * two, at half the alpha each. On a 1440x900 window that is three bright
 * rules standing out of an otherwise even grid, and it reads as a rendering
 * fault rather than as a design.
 *
 * Integer tracks put every boundary on a pixel, so every line in the grid is
 * the same line. The remainder is spread by taking each track as the
 * difference between two running floors rather than by padding the last one,
 * which would leave one visibly fatter column at the edge.
 */
function tracks(total: number, count: number): string {
  const sizes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const size = Math.floor((total * (i + 1)) / count) - Math.floor((total * i) / count);
    sizes.push(`${size}px`);
  }
  return sizes.join(" ");
}

function plan(width: number, height: number): Grid {
  const cols = clamp(Math.round(width / TILE_PX), COLS.min, COLS.max);
  const rows = clamp(Math.round(height / TILE_PX), ROWS.min, ROWS.max);

  /*
   * The order is computed in pixels, from the real centre of the window.
   *
   * Distance between the tile's centre and the window's, over the distance
   * from the window's centre to its corner — so the normalised figure is 0 at
   * the middle and 1 at the furthest tile, whatever shape the window is.
   *
   * Doing this in grid coordinates instead is the obvious shortcut and is
   * wrong on every screen whose cells are not square, which is nearly all of
   * them: at 390x844 a cell is 78 by 70, and a radius counted in rows and
   * columns would leave the window as an ellipse stretched along whichever
   * axis has the finer cells. The wave is supposed to be a circle on the
   * glass, and the only coordinates the glass has are pixels.
   *
   * The cell used here is the ideal one, `width / cols`, and not the integer
   * track the tile is actually painted at. They differ by less than a pixel,
   * which at this spread is under a millisecond of delay — and the ideal grid
   * is exactly symmetrical about the centre, where the rounded one is not, so
   * using it is the difference between four corners that leave together and
   * four that leave a frame apart.
   */
  const cellW = width / cols;
  const cellH = height / rows;
  const corner = Math.hypot(width / 2, height / 2);
  const delays: number[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const dx = (col + 0.5) * cellW - width / 2;
      const dy = (row + 0.5) * cellH - height / 2;
      const reach = corner === 0 ? 0 : Math.hypot(dx, dy) / corner;
      delays.push(Math.round(reach * SPREAD_MS));
    }
  }

  return { cols, rows, colTracks: tracks(width, cols), rowTracks: tracks(height, rows), delays };
}

/**
 * Whether this reader has asked for no motion, by any of the three routes.
 *
 * Reduced motion and a missing `body.motion-paused`, plus the stored Pause
 * preference the class has not been applied from yet. See the note above for
 * why this one component pays for that third read.
 */
function motionIsOff(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false) return true;
  if (document.body.classList.contains("motion-paused")) return true;
  try {
    return localStorage.getItem(MOTION_PAUSED_KEY) === "1";
  } catch {
    /* Private browsing, or site data blocked. Not being able to read the
       stored choice is not a reason to refuse the loader; the class arrives
       an effect later and the stylesheet takes it from there. */
    return false;
  }
}

/**
 * Everything in the first screen that has not finished loading.
 *
 * Measured against the viewport rather than the document, because the shutter
 * covers the viewport and that is all it is hiding. An image with no box yet
 * is skipped: it has no place on the first screen to be waited for.
 */
function pendingFirstScreenImages(): HTMLImageElement[] {
  return [...document.images].filter((img) => {
    if (img.complete) return false;
    const box = img.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return false;
    return box.top < window.innerHeight && box.bottom > 0;
  });
}

const settled = (img: HTMLImageElement) =>
  new Promise<void>((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });

function readiness(): Promise<unknown> {
  const fonts: Promise<unknown> = document.fonts?.ready ?? Promise.resolve();
  return Promise.all([fonts, ...pendingFirstScreenImages().map(settled)]);
}

/**
 * The four states, and why there are four rather than two.
 *
 *   ground   one opaque black sheet, and nothing else in it
 *   grid     the same sheet with its tiles, waiting on the page
 *   leaving  the tiles going, centre outward
 *   gone     not in the document
 *
 * `ground` exists for one measured reason. The version of this component
 * that rendered all 260 tiles in React's first commit cost **+60ms of LCP at
 * 1440x900 under 4x CPU throttling**, and +16ms unthrottled, measured as an
 * interleaved A/B against the same commit with the shutter removed — eleven
 * alternating cold loads a side, both production builds served at once so
 * neither arm could drift away from the other. That is the one cost this
 * device was ever expected to have: not occlusion, which Chrome's LCP does
 * not check for, but plain main-thread work in the commit the first paint is
 * waiting on.
 *
 * So the first commit is one `<div>` with an opaque pseudo-element, and the
 * tiles arrive on the next frame. Nobody can see the difference — the tiles
 * are drawn on black, over black, and the frame they are missing from is
 * black either way — and the work moves off the critical path. The same A/B
 * after the change is in the pull request.
 */
type Phase = "ground" | "grid" | "leaving" | "gone";

/** Custom properties, typed. `Record` rather than a cast, so the names are checked. */
type ShutterStyle = CSSProperties & Record<"--col-tracks" | "--row-tracks", string>;
type TileStyle = CSSProperties & Record<"--tile-delay", string>;

export default function EntryShutter() {
  /*
   * Read in the initialiser and never again, because the answer decides what
   * the first painted frame is. An effect would be a frame too late, and the
   * frame it would be late by is the one where the whole window is black.
   */
  const [phase, setPhase] = useState<Phase>(() => (motionIsOff() ? "gone" : "ground"));
  const [grid] = useState<Grid>(() =>
    typeof window === "undefined" ? plan(0, 0) : plan(window.innerWidth, window.innerHeight)
  );

  /*
   * The tiles, one frame after the sheet.
   *
   * A single `requestAnimationFrame` and not a `setTimeout(0)`: the point is
   * to be after the browser has painted the frame this component's first
   * commit is part of, and rAF is the only callback that means that. The
   * `Phase` note above has what it buys and what it was measured at.
   */
  useEffect(() => {
    if (phase !== "ground") return;
    const next = requestAnimationFrame(() => setPhase((p) => (p === "ground" ? "grid" : p)));
    return () => cancelAnimationFrame(next);
  }, [phase]);

  /* Readiness, and the deadline on it. */
  useEffect(() => {
    if (phase !== "grid") return;
    let live = true;

    /*
     * Two frames between "ready" and the first tile moving.
     *
     * The promise settling means the bytes are in. It does not mean the
     * browser has laid the page out and painted it: one frame to let the
     * style and layout the fonts invalidated be done, and one more so the
     * paint has actually happened. Starting the dissolve a frame early
     * uncovers a hero mid-reflow, which is the one state this device exists
     * to not show anyone.
     */
    const begin = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (live) setPhase((p) => (p === "grid" ? "leaving" : p));
        });
      });
    };

    /* The deadline runs from the frame the tiles appear on rather than from
       the mount, which is one frame's difference and not worth a second timer
       to recover. */
    const ceiling = window.setTimeout(begin, CEILING_MS);
    void readiness().then(begin);

    return () => {
      live = false;
      window.clearTimeout(ceiling);
    };
  }, [phase]);

  /* The sheet's own exit, on a clock. See `UNMOUNT_MS`. */
  useEffect(() => {
    if (phase !== "leaving") return;
    const gone = window.setTimeout(() => setPhase("gone"), UNMOUNT_MS);
    return () => window.clearTimeout(gone);
  }, [phase]);

  if (phase === "gone") return null;

  const sheet: ShutterStyle = { "--col-tracks": grid.colTracks, "--row-tracks": grid.rowTracks };

  return (
    /*
      `aria-hidden` and nothing inside it to focus — no button, no link, no
      live region and no text. There is nothing here for a screen reader to
      announce: the shutter is not a loading *message*, it is the absence of
      the page, and a reader who is not looking at the screen should hear the
      page and never hear that it was briefly covered.

      No `role="progressbar"`, no `aria-busy` on anything. Both would be a
      promise about progress this makes no attempt to measure — it waits for
      two conditions, and neither reports a fraction.
    */
    <div className={styles.shutter} data-state={phase} aria-hidden="true" style={sheet}>
      {/* Not in the first commit. The sheet's own pseudo-element is the black
          for that frame; these cost 60ms of it and are worth none of it until
          the page behind them has painted. */}
      {phase === "ground"
        ? null
        : grid.delays.map((delay, i) => {
            const tile: TileStyle = { "--tile-delay": `${delay}ms` };
            /* The index is the key and the grid never reorders: it is built
               once and every tile's identity is its position in it. */
            return <span key={i} className={styles.tile} style={tile} />;
          })}
    </div>
  );
}
