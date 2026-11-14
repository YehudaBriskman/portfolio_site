import type { Tone } from "@/components/phone/AvatarCircle";

/**
 * The tint of a project's state, from the palette's own hues: live is green,
 * in use blue, open source purple, a release number yellow, anything else
 * (archive) neutral. The word is always printed beside it (WCAG 1.4.1).
 */
const AREA_TONES: Tone[] = ["green", "purple", "yellow", "red", "blue"];

/**
 * The tint of a note's circle, by the area it is filed in: the site's own
 * notes are blue, every other area takes one of the palette's hues from a
 * hash of its slug, so an area is the same colour on every screen.
 */
export function toneOfArea(slug: string): Tone {
  if (slug === "site") return "blue";
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return AREA_TONES[(h >>> 0) % AREA_TONES.length];
}

export function toneOfKind(kind: string): Tone {
  switch (kind) {
    case "live":
      return "green";
    case "use":
      return "blue";
    case "open":
      return "purple";
    case "release":
      return "yellow";
    default:
      return "neutral";
  }
}
