/*
 * The ladder a project screenshot is offered on.
 *
 * For a long time there were two rungs: `<name>-card.jpg` at 800w and the
 * 1600w original. That reads as a reasonable pair until you work out what a
 * phone does with it. `sizes` on the archive card says `100vw`, so a 390px
 * screen at DPR 3 asks for 1170 pixels, finds nothing between 800 and 1600,
 * and correctly takes the 1600 — 133 KB of JPEG for a card 300 CSS px wide.
 * A 1440px desktop needed 470 and took the 800. Measured across /projects,
 * the phone pulled 352 KB of screenshots and the desktop 215 KB: the smaller
 * screen paying two-thirds more for a smaller picture.
 *
 * Adding sizes alone would not have fixed it, because the phone was not
 * picking the wrong rung — it was picking the only one wide enough. What
 * fixes it is a rung at 1200, which is the first one that satisfies a DPR-3
 * phone, and a format that is not JPEG. AVIF of the heaviest screenshot here
 * is 29 KB at 1200 where the JPEG rung is 75 KB.
 *
 * The widths and the formats below are the ones `scripts/build-shots.mjs`
 * writes, and the two have to agree: nothing checks at runtime that a file
 * named here is on disk. The script refuses to run on a master that is not
 * exactly 1600px wide for the same reason.
 *
 * The 168px `thumb` slot went with the archive's 56px circular crops. Four
 * projects with genuinely dissimilar screenshots were being reduced to four
 * near-identical dark discs — the top-centre 56px of a web page is a nav bar
 * — so the archive now shows them at a size where they tell each other apart,
 * and nothing asks for a thumbnail any more.
 */

/*
 * Only our own screenshots have variants. Anything else — a cover pasted into
 * the admin, an absolute URL — is handed back as a single `src` with no
 * `srcSet` at all, because offering the browser a choice it cannot honour is
 * how you ship a page full of 404s.
 */
const LOCAL_SCREENSHOT = /^\/projects\/([a-z0-9_]+)\.jpg$/i;

/*
 * 400 for a DPR-1 phone, 800 for the desktop card, 1200 for a DPR-3 phone,
 * 1600 for the detail page's hero — which renders near 1072 CSS px and is the
 * one place the original was always the right file.
 */
const WIDTHS = [400, 800, 1200, 1600] as const;

/** The widest rung is the master itself: there is no `-1600.jpg` on disk. */
const MASTER_WIDTH = 1600;

/** The rung the bare `src` points at, for a browser that reads no `srcSet`. */
const FALLBACK_WIDTH = 800;

export type ShotSource = {
  /** The `type` a `<source>` advertises, so the browser can skip what it cannot read. */
  type: string;
  srcSet: string;
};

export type ShotImage = {
  /** Modern formats, best first. Empty for anything that is not one of ours. */
  sources: ShotSource[];
  /** The JPEG ladder, for the `<img>` itself. Absent when there are no variants. */
  srcSet?: string;
  /** What `src` should be: a real rung for our screenshots, the original otherwise. */
  src: string;
};

/*
 * A picture from the media library (#253) has the same rungs, made by the
 * server on upload, in AVIF and WebP only (there is no JPEG ladder). Its
 * stable URL answers `?w=<width>&f=<format>` with a redirect to the nearest
 * size at or above that width, so the ladder can be written without knowing
 * the hashed file names. A picture narrower than a rung is offered at its own
 * width under that rung's descriptor, which the browser treats as a slightly
 * soft image, never a broken one.
 */
const LIBRARY = /^(?:https?:\/\/[^/]+)?\/api\/images\/media\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

function libraryShot(src: string): ShotImage | null {
  if (!LIBRARY.test(src)) return null;
  const rungs = (f: "avif" | "webp") => WIDTHS.map((w) => `${src}?w=${w}&f=${f} ${w}w`).join(", ");
  return {
    sources: [
      { type: "image/avif", srcSet: rungs("avif") },
      { type: "image/webp", srcSet: rungs("webp") },
    ],
    src: `${src}?w=${FALLBACK_WIDTH}&f=webp`,
  };
}

function ladder(slug: string, extension: string): string {
  return WIDTHS.map((width) =>
    extension === "jpg" && width === MASTER_WIDTH
      ? `/projects/${slug}.jpg ${width}w`
      : `/projects/${slug}-${width}.${extension} ${width}w`,
  ).join(", ");
}

/**
 * Every file the browser may pick for one screenshot, or a single untouched
 * `src` when the image is not one of ours to have cut up.
 */
export function shotImage(src: string | null | undefined): ShotImage | null {
  if (!src) return null;
  const library = libraryShot(src);
  if (library) return library;
  const match = LOCAL_SCREENSHOT.exec(src);
  if (!match) return { sources: [], src };

  const slug = match[1];
  return {
    /* AVIF first because it is both the smallest and the best: at the 1200
       rung it is 29 KB against WebP's 26 KB on a picture where it scores
       nearly twice the structural fidelity. WebP is here for Safari 14 to
       16.3, which reads it and not AVIF. */
    sources: [
      { type: "image/avif", srcSet: ladder(slug, "avif") },
      { type: "image/webp", srcSet: ladder(slug, "webp") },
    ],
    srcSet: ladder(slug, "jpg"),
    src: `/projects/${slug}-${FALLBACK_WIDTH}.jpg`,
  };
}
