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
 */
export default function Shot({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`card-shot relative ${className}`}>
      {!loaded && <div className="absolute inset-0 animate-pulse-soft bg-edge/40" aria-hidden="true" />}
      <img
        src={projectImage(src, "card") ?? src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={1600}
        height={1000}
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
