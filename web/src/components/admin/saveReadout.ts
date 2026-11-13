import type { BarTone } from "./EditorBar";
import type { SaveState } from "./StatusPill";

export function clock(at: Date): string {
  return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** The save state as words and a tone: what `StatusPill` shows, for the one-row editor bar. */
export function barStatus(state: SaveState): { tone: BarTone; text: string } {
  switch (state.kind) {
    case "dirty": return { tone: "idle", text: "Unsaved" };
    case "saving": return { tone: "busy", text: "Saving" };
    case "saved": return { tone: "ok", text: `Saved ${clock(state.at)}` };
    case "invalid":
    case "failed": return { tone: "bad", text: state.message };
    case "conflict": return { tone: "warn", text: "Changed elsewhere" };
    default: return { tone: "idle", text: "" };
  }
}
