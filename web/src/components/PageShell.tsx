import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import Atmosphere from "@/components/Atmosphere";
import { PAGE_LAYERS, type Layer } from "@/components/scene/LayerStack";
import { useScrollProgress } from "@/hooks/useScrollProgress";

/* Blog pages sit in the same landscape as the home page rather than on a plain
   background — otherwise leaving the index feels like leaving the site. */
export default function PageShell({
  children,
  reading = false,
  layers = PAGE_LAYERS,
}: {
  children: ReactNode;
  /* Each area brings its own landscape; see LayerStack. */
  layers?: Layer[];
  /*
   * Set on long-form pages. Atmosphere's legibility scrim is a horizontal ramp
   * (0.92 -> 0.55 left to right) tuned for the home page's left-aligned column.
   * A post is a centred column, so deep in the document its prose drifts over
   * the thin end of that ramp and onto the pale water band — losing contrast at
   * exactly the point the reader is most committed. One flat layer holds the
   * ground steady; measured at 7.3:1 for bone/85 at the palest point.
   */
  reading?: boolean;
}) {
  useScrollProgress();
  return (
    <div className="grain relative min-h-screen">
      <a href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-sodium focus:px-4 focus:py-2 focus:text-bitumen">
        Skip to content
      </a>
      <Atmosphere layers={layers} driveBy="progress" />
      {/* After Atmosphere, so it paints over it at the same depth. */}
      {reading && <div className="reading-ground" aria-hidden="true" />}
      <Nav />
      <main id="content">{children}</main>
      {/* Content pages had no footer at all; these are the pages people land on
          from a search, and they offered no way onward. */}
      <div className="footer-ground">
        <div className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-6">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
