import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import styles from "@/components/motion/BlurShot.module.css";

export type BlurShotProps = {
  src: string;
  /** Required, and empty only for a genuinely decorative photograph. */
  alt: string;
  /**
   * A tiny placeholder as a complete data URI, painted as the frame's
   * background until the real pixels arrive. A handful of pixels is the whole
   * point: it has to be inline, because a placeholder that costs a request is
   * a request racing the image it was meant to cover for.
   */
  lqip?: string;
  /**
   * Intrinsic size. Supplied together they reserve the frame's shape before
   * anything has loaded, which is what stops the paragraph below from moving
   * when it does.
   */
  width?: number;
  height?: number;
  sizes?: string;
  srcSet?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  /** The ground tone behind the frame, as an `R G B` triple. */
  ground?: string;
  className?: string;
  imgClassName?: string;
};

/*
 * A photograph that resolves out of a blurred stand-in.
 *
 * The alternative — an empty box that snaps to a full-bleed image — makes the
 * page lurch at whatever moment the network happens to finish, and on a site
 * that is mostly photographs that happens several times a screen. Holding the
 * frame with a few bytes of blurred colour means the composition is right from
 * the first paint and only the detail arrives late.
 *
 * The one case worth code is the cache hit. An image that is already decoded
 * when React mounts never fires a load event for us to listen to, and flipping
 * the state anyway would run the un-blur on a picture the reader is already
 * looking at. So the mount path flips without a transition, forces the style
 * to settle, and only then hands the transition back for anything that
 * follows.
 *
 * Nothing here is scroll-driven, so only two of the three off-switches in
 * `docs/motion-contract.md` apply to it. The contract has the rest of what is
 * true across every file in this directory.
 */
export default function BlurShot({
  src,
  alt,
  lqip,
  width,
  height,
  sizes,
  srcSet,
  loading = "lazy",
  fetchPriority,
  ground,
  className = "",
  imgClassName = "",
}: BlurShotProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [instant, setInstant] = useState(false);

  /* A layout effect rather than an effect: both of these have to run before
     the browser paints, or the flash they exist to prevent happens anyway. */
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || loaded) return;
    /* `complete` alone is true for an image that failed as well as one that
       arrived, so the decoded width is what actually distinguishes a cache
       hit from a broken src. */
    if (img.complete && img.naturalWidth > 0) {
      setInstant(true);
      setLoaded(true);
    }
  }, [loaded]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!instant || !frame) return;
    /*
     * Reading a layout property forces the style recalculation that commits
     * the sharp image while transitions are still suppressed. Without it the
     * attribute goes on and comes off within one frame, the engine only ever
     * sees the before and after, and it animates between them — which is the
     * flash this whole branch exists to avoid.
     */
    void frame.offsetWidth;
    setInstant(false);
  }, [instant]);

  const frame = {
    ...(lqip ? { "--shot-lqip": `url("${lqip}")` } : {}),
    ...(ground ? { "--shot-ground": ground } : {}),
    ...(width && height ? { aspectRatio: `${width} / ${height}` } : {}),
  } as CSSProperties;

  return (
    <div
      ref={frameRef}
      className={`${styles.frame} ${className}`}
      style={frame}
      data-loaded={loaded ? "true" : "false"}
      data-instant={instant ? "true" : undefined}
    >
      <img
        ref={imgRef}
        className={`${styles.image} ${imgClassName}`}
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        srcSet={srcSet}
        loading={loading}
        /* Lowercase, as elsewhere in this codebase: React 18 does not know
           the camelCase spelling and drops the attribute with a warning. */
        fetchpriority={fetchPriority}
        decoding="async"
        onLoad={() => setLoaded(true)}
        /* A failed image is unblurred too. Leaving the blur on means the
           reader is shown a broken-image glyph behind 26px of smear, which
           looks like a bug in the page rather than a missing file. */
        onError={() => setLoaded(true)}
      />
    </div>
  );
}
