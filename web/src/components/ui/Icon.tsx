import type { LucideIcon, LucideProps } from "lucide-react";

/*
 * The one place an icon gets its size and stroke. Sizes are 16, 20 or 24 and
 * the stroke follows the size (smaller = heavier) so icons at mixed sizes keep
 * one visual weight. Decorative by default; pass an aria-label to expose one.
 * `mirrorInRtl` is for directional glyphs (chevrons, arrows): it marks the
 * svg `data-mirror-rtl`, which the stylesheet flips under `[dir="rtl"]`.
 * New code imports icons from lucide-react only through here (see
 * `Icon.guard.test.ts`).
 */
export type IconSize = 16 | 20 | 24;

export const STROKE_FOR_SIZE: Record<IconSize, number> = { 16: 2, 20: 1.75, 24: 1.5 };

export type IconProps = Omit<LucideProps, "size" | "strokeWidth" | "ref"> & {
  icon: LucideIcon;
  size?: IconSize;
  mirrorInRtl?: boolean;
};

export function Icon({ icon: Glyph, size = 20, mirrorInRtl, ...rest }: IconProps) {
  const labelled = rest["aria-label"] != null || rest["aria-labelledby"] != null;
  return (
    <Glyph
      size={size}
      strokeWidth={STROKE_FOR_SIZE[size]}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      data-mirror-rtl={mirrorInRtl ? "true" : undefined}
      {...rest}
    />
  );
}

/** A lucide-shaped component drawn through `Icon`, for APIs that take a `LucideIcon` (nav trees). */
export function iconOf(glyph: LucideIcon, size: IconSize = 20): LucideIcon {
  const Wrapped = ((props: LucideProps) => <Icon {...props} icon={glyph} size={size} />) as LucideIcon;
  Wrapped.displayName = `Icon(${glyph.displayName ?? "glyph"})`;
  return Wrapped;
}
