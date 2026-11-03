import { useLang } from "@/components/dashboard/i18n";
import { ARROWS } from "./words";

/**
 * An arrow that points the way the page reads: onward is → in English and
 * ← in Hebrew. The glyph is swapped rather than mirrored with a transform,
 * because the arrows that nudge on hover already own their `transform`.
 */
export default function Arrow({ to = "on" }: { to?: "on" | "back" | "out" }) {
  return <>{ARROWS[useLang()][to]}</>;
}
