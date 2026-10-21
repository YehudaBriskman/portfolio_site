import LayerStack, { LANDING_LAYERS, type Layer } from "@/components/scene/LayerStack";
import Drifters from "@/components/scene/Drifters";

/*
 * One atmosphere for the whole document.
 *
 * The background is a stack of opaque layers, one per section, each rising over
 * the last with a ridgeline for its top edge. See LayerStack.
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

      <Drifters />

      {/*
        A light veil, not the heavy ramp this used to be. The layer colours are
        now chosen against the contrast floor rather than corrected for after
        the fact, so the scrim no longer has to erase them to keep text legible.
        What is left is only there to settle the drifters.
      */}
      <div className="absolute inset-0 bg-bitumen/25" />
    </div>
  );
}
