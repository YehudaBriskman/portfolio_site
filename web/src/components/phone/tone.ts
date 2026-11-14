import type { Tone } from "@/components/phone/AvatarCircle";

/**
 * The tint of a project's state, from the palette's own hues: live is green,
 * in use blue, open source purple, a release number yellow, anything else
 * (archive) neutral. The word is always printed beside it (WCAG 1.4.1).
 */
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
