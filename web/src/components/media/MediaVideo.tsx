import { useEffect, useRef } from "react";
import { useMotionPaused } from "@/hooks/useMotionPaused";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/*
 * A short video from the media library (#253).
 *
 *   - Always muted and playsinline: it is a moving picture, not a soundtrack,
 *     and iOS will not start an inline video with sound.
 *   - Always a poster: the owner uploads one with every video, and it is all
 *     a visitor sees until the video plays, and all they ever see with motion
 *     off.
 *   - It plays by itself only when asked to (`autoPlay`) AND motion is on:
 *     not under prefers-reduced-motion, and not under the site's Pause. Turn
 *     either on while it plays and it stops, on the frame it was showing.
 *     Controls are always there, so a visitor can still choose to play it.
 *   - preload="none" when it will not play by itself: the poster costs a
 *     picture, the video costs nothing until someone asks for it.
 *   - Captions are optional; when the library has them they are a default
 *     <track>, so they show without a visitor having to find them.
 *
 * `src` and the captions URL are the library's same-origin /api/images/m/
 * paths, which the page's CSP (media-src falling back to default-src 'self')
 * allows. The absolute public URL a content field stores would not be, on the
 * admin host; use the item's `file`, not its `url`.
 */
export type MediaVideoProps = {
  src: string;
  type: string;
  poster: string;
  /** What the video shows, for a screen reader. */
  label: string;
  captions?: { src: string; lang: string; label: string } | null;
  /** Every track, one per language (#306); the page's language is the default. */
  tracks?: { src: string; lang: string; label: string }[];
  /** The page's language, which picks the default track. */
  lang?: string;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
};

export default function MediaVideo({
  src,
  type,
  poster,
  label,
  captions,
  tracks,
  lang = "en",
  width,
  height,
  autoPlay = false,
  loop = false,
  className,
}: MediaVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = usePrefersReducedMotion();
  const paused = useMotionPaused();
  const motionOn = !reduced && !paused;

  // React does not reliably reflect `muted` as a property; set it directly so a browser's autoplay rule sees it.
  useEffect(() => {
    if (ref.current) ref.current.muted = true;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (autoPlay && motionOn) {
      // A browser may still decline (data saver, a background tab): the poster and the controls remain.
      el.play()?.catch(() => undefined);
    } else if (!motionOn) {
      el.pause();
    }
  }, [autoPlay, motionOn]);

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      width={width}
      height={height}
      muted
      playsInline
      controls
      loop={loop}
      preload={autoPlay && motionOn ? "auto" : "none"}
      aria-label={label}
      data-motion={motionOn ? "on" : "off"}
    >
      <source src={src} type={type} />
      {(tracks?.length ? tracks : captions ? [captions] : []).map((t, i, all) => (
        <track
          key={t.lang}
          kind="captions"
          src={t.src}
          srcLang={t.lang}
          label={t.label}
          default={all.some((x) => x.lang === lang) ? t.lang === lang : i === 0}
        />
      ))}
    </video>
  );
}
