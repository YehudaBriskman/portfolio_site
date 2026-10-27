/*
 * The refraction filter the thin glass tier bends its backdrop through.
 *
 * Ported from WindoM (`site/src/components/GlassFilters.tsx`), which in turn
 * copied it verbatim from the extension — deliberately, so the site's glass is
 * the product's glass rather than a lookalike. The same reasoning applies
 * here: this is the same material, on a different surface.
 *
 * Only the small variant is carried over. The large one is tuned for a 28px
 * blur, and at that radius the displacement is invisible: the blur has already
 * destroyed the detail the map would bend. `.glass-thin` blurs at 8px, where
 * it reads.
 *
 * Mounted once per page, not per pane — the filter is referenced by id, and a
 * second copy would just be a duplicate id.
 */
export default function GlassFilters() {
  return (
    <svg style={{ display: "none" }} aria-hidden="true" focusable="false">
      <filter id="glass-distort-sm" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.012 0.012"
          numOctaves="2"
          seed="42"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="0.02" result="blur" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="blur"
          scale="30"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
