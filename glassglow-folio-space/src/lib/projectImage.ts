/*
 * The project screenshots ship at three sizes.
 *
 * They are 1600px wide originals, and the archive rows render them as 56px
 * circles — 218KB downloaded to paint 17KB worth of pixels. This picks the
 * variant that fits the slot. Anything that is not one of our own local
 * screenshots (a cover image pasted into the admin, for instance) is returned
 * untouched, because we have no variants of it.
 */
const LOCAL_SCREENSHOT = /^\/projects\/([a-z0-9_]+)\.jpg$/i;

export type ImageSlot = "thumb" | "card";

export function projectImage(src: string | null | undefined, slot: ImageSlot): string | null {
  if (!src) return null;
  const match = LOCAL_SCREENSHOT.exec(src);
  return match ? `/projects/${match[1]}-${slot}.jpg` : src;
}
