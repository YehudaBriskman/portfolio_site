/*
 * The project screenshots ship at two sizes.
 *
 * They are 1600px wide originals, and a card slot is 800. This picks the
 * variant that fits. Anything that is not one of our own local screenshots (a
 * cover image pasted into the admin, for instance) is returned untouched,
 * because we have no variants of it.
 *
 * The 168px `thumb` slot went with the archive's 56px circular crops. Four
 * projects with genuinely dissimilar screenshots were being reduced to four
 * near-identical dark discs — the top-centre 56px of a web page is a nav bar
 * — so the archive now shows them at a size where they tell each other apart,
 * and nothing asks for a thumbnail any more.
 */
const LOCAL_SCREENSHOT = /^\/projects\/([a-z0-9_]+)\.jpg$/i;

export type ImageSlot = "card";

export function projectImage(src: string | null | undefined, slot: ImageSlot): string | null {
  if (!src) return null;
  const match = LOCAL_SCREENSHOT.exec(src);
  return match ? `/projects/${match[1]}-${slot}.jpg` : src;
}
