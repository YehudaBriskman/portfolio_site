import type { BarTone } from "./EditorBar";
import type { SaveState } from "./StatusPill";
import type { Lang } from "@/components/dashboard/i18n";
import { useAreaEditorWords } from "@/i18n/areaEditor";

export function clock(at: Date): string {
  return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** The save state as words and a tone: what `StatusPill` shows, for the one-row editor bar. */
export function barStatus(state: SaveState, lang: Lang = "en"): { tone: BarTone; text: string } {
  const w = useAreaEditorWords.of(lang);
  switch (state.kind) {
    case "dirty": return { tone: "idle", text: w.unsaved };
    case "saving": return { tone: "busy", text: w.saving };
    case "saved": return { tone: "ok", text: w.saved(clock(state.at)) };
    case "invalid":
    case "failed": return { tone: "bad", text: state.message };
    case "conflict": return { tone: "warn", text: w.elsewhere };
    default: return { tone: "idle", text: "" };
  }
}
