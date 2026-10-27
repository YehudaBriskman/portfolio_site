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
 * What happened to the sun
 * ------------------------
 * It was a sodium disc, and it was the only chromatic thing left in this card.
 * Keeping it would have made the one place the retired accent survived on the
 * public site a decorative drawing — exactly the use the accent was retired
 * for — and a small orange circle inside a card standing on a photograph is
 * the thing most certain to read as a sticker.
 *
 * But the disc is not only colour: it is the light source the four bands are
 * silhouetted against, and without one the glyph is a flat grey ramp with some
 * hills in it. So the light stays and the hue goes. A pale bone disc over a
 * neutral sky is the same composition built out of value alone, which is the
 * rule the rest of the site now runs on — and it finally agrees with the
 * photographs behind it, none of which is tinted to match an accent either.
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
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--surface))" />
          <stop offset="62%" stopColor="rgb(var(--haze))" stopOpacity="0.55" />
          <stop offset="100%" stopColor="rgb(var(--haze-2))" stopOpacity="0.75" />
        </linearGradient>
        {/* Less than half the alpha the sodium glow carried. A hue can be laid
            on thickly and still read as atmosphere; the same strength in bone
            over a grey sky is a blown-out hole rather than a light in the
            distance, so value has to be asked for more quietly. */}
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0%" stopColor="rgb(var(--bone))" stopOpacity="0.22" />
          <stop offset="55%" stopColor="rgb(var(--bone))" stopOpacity="0.06" />
          <stop offset="100%" stopColor="rgb(var(--bone))" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="320" height="180" fill={`url(#sky-${uid})`} />
      <circle cx={sunX} cy={sunY} r="52" fill={`url(#glow-${uid})`} />
      <circle cx={sunX} cy={sunY} r="13" fill="rgb(var(--bone))" opacity="0.72" />

      {/* Aerial perspective: each band is nearer, darker and higher-contrast
          than the one behind it, exactly as in the hero. */}
      <path d={band(104, sway[0])} fill="rgb(var(--haze-2))" opacity="0.5" />
      <path d={band(126, sway[1])} fill="rgb(var(--haze))" opacity="0.75" />
      <path d={band(148, sway[2])} fill="rgb(var(--ridge))" opacity="0.95" />
      <path d={band(166, 0)} fill="rgb(var(--bitumen))" opacity="0.9" />
    </svg>
  );
}
