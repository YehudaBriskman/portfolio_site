import { useState } from "react";
import { shotImage } from "@/lib/projectImage";

/*
 * A screenshot in a fixed aspect box.
 *
 * `object-top` is the whole point: an app screenshot puts its interface at the
 * top of the frame, so centring the crop — which is what the old `h-36
 * object-cover` did — showed the empty middle of the page and none of the
 * product.
 *
 * What came off with the dark ground
 * ----------------------------------
 * There was a gradient scrim over the bottom of every screenshot, there so
 * the status chip had something to sit on, and `--r-md` of rounding on the
 * box. Both were right when the image was a glass pane over a photograph and
 * both are wrong now. The scrim is `--bitumen`, which is paper, so it had
 * become a cream fog laid over the lower third of every picture; the chip
 * that needed it has a ground of its own. And the corners are square because
 * the image sits inside a mount with a visible border — a rounded picture in
 * a square frame reads as a sticker, not as a print.
 *
 * Which file the browser gets
 * ---------------------------
 * This used to hand the 800px `-card` variant to every slot, including the
 * detail page's hero, where the figure is around 1150 CSS px wide and is the
 * LCP element — so the one screenshot a reader actually stops on was being
 * upscaled by half again and looked soft. The fix is not to hardcode the
 * larger file either: the archive and the landing page really do want the
 * small one. Every variant is offered and the slot says how wide it is, which
 * is the only place that knows.
 *
 * It is a `<picture>` rather than a bare `<img srcSet>` because the choice is
 * now a format as well as a width. A phone was taking the 1600px JPEG — the
 * only rung wide enough for 390 CSS px at DPR 3 — and spending 133 KB on a
 * card 300 px across; measured over /projects it pulled 352 KB of screenshots
 * where a 1440px desktop pulled 215 KB. The rungs at 400 and 1200 give it
 * somewhere else to land and AVIF makes the landing cheap. The `<img>` keeps
 * the JPEG ladder, so a browser that reads neither `<source>` is exactly
 * where it was before.
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

  /* `shotImage` hands back anything it does not recognise as a single `src` —
     a cover pasted into the admin, say — and we have no variants of those, so
     there is nothing to offer the browser a choice between. */
  const picture = shotImage(src) ?? { sources: [], src };

  return (
    /* `rounded-none` and the border beat `.card-shot` on cascade order rather
       than on specificity: both selectors weigh the same, and Tailwind's
       utilities layer is emitted after the components layer the class lives
       in. The border is the one `.figure-frame > img` would have drawn if
       this were a bare `<img>` rather than a box with a placeholder in it. */
    <div className={`card-shot relative rounded-none border border-[rgb(var(--rule))] ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 scrub-pulse bg-[rgb(var(--rule)_/_0.4)]" aria-hidden="true" />
      )}
      {/* `sizes` is repeated on every `<source>` on purpose: a `<source>` does
          not inherit the `<img>`'s, and one that omits it falls back to 100vw
          — which is the exact mistake that made the phone download the
          1600px file in the first place. */}
      {/* The wrapper has to be told to be a box. `<picture>` is inline by
          default, and the image's `h-full` resolves against it, not against
          the aspect-ratio frame outside — left alone it collapses the
          screenshot to its intrinsic height and the card loses its shape. */}
      <picture className="block h-full w-full">
        {picture.sources.map((source) => (
          <source key={source.type} type={source.type} srcSet={source.srcSet} sizes={sizes} />
        ))}
        <img
          src={picture.src}
          srcSet={picture.srcSet}
          sizes={picture.srcSet ? sizes : undefined}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          fetchpriority={eager ? "high" : undefined}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover object-top ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      </picture>
    </div>
  );
}
