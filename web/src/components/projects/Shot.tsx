import { useState } from "react";
import { projectImage } from "@/lib/projectImage";

/*
 * A screenshot in a fixed aspect box.
 *
 * `object-top` is the whole point: an app screenshot puts its interface at the
 * top of the frame, so centring the crop — which is what the old `h-36
 * object-cover` did — showed the empty middle of the page and none of the
 * product. The scrim exists so the status chip sitting on top of the image has
 * something to sit on, and lifts on hover to hand the image back.
 *
 * Which file the browser gets
 * ---------------------------
 * This used to hand the 800px `-card` variant to every slot, including the
 * detail page's hero, where the figure is around 1150 CSS px wide and is the
 * LCP element — so the one screenshot a reader actually stops on was being
 * upscaled by half again and looked soft. The fix is not to hardcode the
 * larger file either: the archive and the landing page really do want the
 * small one. Both variants are offered and the slot says how wide it is, which
 * is the only place that knows.
 *
 * There are no explicit `width`/`height` attributes any more. They said
 * 1600×1000 — an aspect no file on disk has; the real sources are 1600×724
 * through 1600×848 — and they bought nothing, because the wrapper already
 * fixes the box with `aspect-[…]` and the image fills it. A wrong ratio there
 * is a layout jump waiting for the first image that does not match.
 */
export default function Shot({
  src,
  alt,
  className = "",
  sizes = "(min-width: 1024px) 45vw, 100vw",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  /** How wide this slot renders. Wrong here means the wrong file downloads. */
  sizes?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  /* `projectImage` hands back anything it does not recognise untouched — a
     cover pasted into the admin, say — and we have no variants of those, so
     there is nothing to offer the browser a choice between. */
  const card = projectImage(src, "card") ?? src;
  const srcSet = card === src ? undefined : `${card} 800w, ${src} 1600w`;

  return (
    <div className={`card-shot relative ${className}`}>
      {!loaded && <div className="absolute inset-0 animate-pulse-soft bg-edge/40" aria-hidden="true" />}
      <img
        src={card}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchpriority={eager ? "high" : undefined}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover object-top ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bitumen/65 via-transparent to-transparent transition-opacity duration-500 group-hover:opacity-40"
        aria-hidden="true"
      />
    </div>
  );
}
