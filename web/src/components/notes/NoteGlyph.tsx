import { useId } from "react";

/*
 * A generated cover for a note that has no image of its own.
 *
 * Two problems, one answer. A grid where some cards carry media and some do not
 * reads as unfinished rather than as a choice, and the landscape that gives this
 * site its identity only ever appeared *behind* the content. Deriving a skyline
 * from the slug puts the scene inside the card and levels the grid at the same
 * time, without a byte of network or a stored asset.
 *
 * The hash is deterministic, so a post keeps its own skyline forever. Nothing
 * animates: this sits a few pixels from body copy, where the reeds and birds of
 * the full scene would be noise.
 *
 * Which way up the light goes
 * ---------------------------
 * This was drawn for a near-black ground and then had its colours re-pointed
 * at the paper palette without the drawing being looked at again, which
 * inverted it: `--bone` became `--ink`, so the sun came out as a near-black
 * disc, and `--bitumen` became `--paper`, so the nearest and supposedly
 * darkest ridge came out lighter than the sky behind it. On the index that
 * read as a grey smudge with a hole in it.
 *
 * Right way up, the sky is light at the top and the four bands get darker as
 * they come forward, which is aerial perspective; see the note on the bands
 * for why they are one ink at four strengths rather than four named greys.
 *
 * Where its colour comes from
 * ---------------------------
 * Nowhere, on purpose. Every fill is a neutral or a translucent white, and the
 * panel behind the drawing is the card's own `--card-wash`: the sky shows
 * through the pale end of the gradient, so a note resting in the blue wash
 * gets a blue sky and one resting in the yellow gets a yellow one, without
 * this file knowing which. One rule decides the colour of a card and its
 * picture at once.
 */

/* djb2-ish. Cheap, stable across engines, and only ever used for picking a
   number out of a small range — no security claim is being made here. */
function hash(seed: string): number {
  let h = 0;
  for (const ch of seed) h = ((h << 5) - h + (ch.codePointAt(0) ?? 0)) | 0;
  return Math.abs(h);
}

/* One ridge band: a fixed curve shape lifted or dropped by `y`, closed to the
   bottom of the box so it silhouettes against the band behind it. */
function band(y: number, sway: number): string {
  return [
    `M0,${y + sway}`,
    `C54,${y - 14 + sway} 96,${y + 8 + sway} 148,${y - 2 + sway}`,
    `C196,${y - 11 + sway} 244,${y + 9 + sway} 288,${y - 5 + sway}`,
    `L320,${y + 2 + sway} L320,180 L0,180 Z`,
  ].join(" ");
}

export default function NoteGlyph({ seed, className = "" }: { seed: string; className?: string }) {
  // Gradient ids are document-global; several cards render at once on the index.
  const uid = useId().replace(/:/g, "");
  const h = hash(seed);

  const sunX = 78 + (h % 150);
  const sunY = 92 - ((h >> 4) % 18);
  const sway = [((h >> 7) % 13) - 6, ((h >> 11) % 13) - 6, ((h >> 15) % 11) - 5];

  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        {/* White at the top and nothing at the bottom, so the card's wash is
            the lower sky rather than a grey this file chose. */}
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(255 255 255)" stopOpacity="0.72" />
          <stop offset="58%" stopColor="rgb(255 255 255)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="rgb(var(--rule))" stopOpacity="0.3" />
        </linearGradient>
        {/* The light behind the ridges. Quiet, because this sits a few pixels
            from body copy: a glow strong enough to be noticed on its own is a
            blown-out hole rather than a distance. */}
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0%" stopColor="rgb(255 255 255)" stopOpacity="0.85" />
          <stop offset="55%" stopColor="rgb(255 255 255)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(255 255 255)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="320" height="180" fill={`url(#sky-${uid})`} />
      <circle cx={sunX} cy={sunY} r="52" fill={`url(#glow-${uid})`} />
      <circle cx={sunX} cy={sunY} r="13" fill="rgb(255 255 255)" opacity="0.92" />

      {/*
       * Aerial perspective: each band is nearer and darker than the one
       * behind it, exactly as in the hero — and on paper that means the ramp
       * runs down the palette rather than up it.
       *
       * One ink at four strengths rather than four named greys. The named
       * greys are warm (they are mixed for the cream ground) and laying them
       * over a cool wash gave a brown-grey smudge with no hue left in it;
       * thin ink lets the card's own colour through every band, so a note
       * resting in the blue wash has blue hills and one resting in the
       * yellow has yellow ones. The steps shorten as they come forward — 12,
       * 10, 12, 12 points of alpha — because that is what distance does.
       */}
      <path d={band(104, sway[0])} fill="rgb(var(--ink))" opacity="0.12" />
      <path d={band(126, sway[1])} fill="rgb(var(--ink))" opacity="0.22" />
      <path d={band(148, sway[2])} fill="rgb(var(--ink))" opacity="0.34" />
      <path d={band(166, 0)} fill="rgb(var(--ink))" opacity="0.46" />
    </svg>
  );
}
