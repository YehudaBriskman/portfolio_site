import type { CSSProperties } from "react";

/*
 * An icon from the media library (#253).
 *
 * A monochrome SVG (one ink, no gradient: the server decides on upload) is
 * drawn as a CSS mask filled with currentColor, so it takes the colour of the
 * text around it — and so the theme's — without the stored file being
 * rewritten. Anything else is a plain <img>, in its own colours.
 *
 * `label` empty means decorative: hidden from assistive tech, as the words
 * beside it already say what it is.
 */
export default function MediaIcon({
  src,
  label = "",
  monochrome = false,
  size = 24,
  className,
}: {
  src: string;
  label?: string;
  monochrome?: boolean;
  size?: number;
  className?: string;
}) {
  if (!monochrome) {
    return <img src={src} alt={label} width={size} height={size} className={className} style={{ objectFit: "contain" }} />;
  }
  const mask = `url("${src.replace(/["\\]/g, "")}") center / contain no-repeat`;
  const style: CSSProperties = {
    display: "inline-block",
    inlineSize: size,
    blockSize: size,
    backgroundColor: "currentColor",
    mask,
    WebkitMask: mask,
    // Forced colours ignore background-color; the system's text colour keeps the shape visible.
    forcedColorAdjust: "none",
  };
  return label ? (
    <span role="img" aria-label={label} className={className} style={style} />
  ) : (
    <span aria-hidden="true" className={className} style={style} />
  );
}
