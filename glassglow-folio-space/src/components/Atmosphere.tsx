import LayerStack, { LANDING_LAYERS, type Layer } from "@/components/scene/LayerStack";
import GlassFilters from "@/components/scene/GlassFilters";

/*
 * One atmosphere for the whole document.
 *
 * The background is a stack of opaque photographic plates, one per section,
 * each rising over the last with a ridgeline cut into its top edge. See
 * LayerStack.
 */
export default function Atmosphere({
  layers = LANDING_LAYERS,
  driveBy = "sections",
}: {
  layers?: Layer[];
  driveBy?: "sections" | "progress";
}) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <LayerStack layers={layers} driveBy={driveBy} />
      <GlassFilters />

      {/*
        The reading pool.

        Fixed to the viewport rather than to a plate, because the text is fixed
        to the viewport too. Attached to the plates it travelled with them, and
        a section's copy would arrive on screen long after the pool that was
        supposed to protect it had scrolled away above.

        Shaped, not a wash: an even scrim strong enough for the brightest
        photograph turns the other three to mud, and the pictures are the point.
        This is roughly the width of the reading column, anchored where the
        copy actually sits, and it fades out entirely before the right-hand
        third of the screen — which is where the plates are left alone to be
        looked at.
      */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(62% 54% at 24% 46%, rgb(var(--bitumen) / .80) 0%," +
            " rgb(var(--bitumen) / .46) 52%, transparent 80%)",
        }}
      />
    </div>
  );
}
