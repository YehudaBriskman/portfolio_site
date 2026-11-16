/*
 * One save-state readout for every admin editor.
 *
 * The old editor carried success and failure in a single string rendered in
 * --sodium, so "Save failed" arrived in the same accent colour as "Saved." — a
 * failure that looked like a success. These are distinct states with distinct
 * colours, and failure gets its own ink.
 */

import { useAreaEditorWords } from "@/i18n/areaEditor";
import { clock } from "./saveReadout";

export type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "invalid"; message: string }
  | { kind: "failed"; message: string }
  | { kind: "conflict" };

export default function StatusPill({ state }: { state: SaveState }) {
  const w = useAreaEditorWords();
  const isProblem = state.kind === "failed" || state.kind === "conflict" || state.kind === "invalid";

  return (
    <span
      // Failures interrupt; a routine "Saved" should not.
      aria-live={isProblem ? "assertive" : "polite"}
      className="flex min-h-[1.25rem] items-center gap-2 text-sm tabular-nums"
    >
      {state.kind === "dirty" && (
        <>
          <span className="a-dot bg-bone/40" aria-hidden="true" />
          <span className="text-clay">{w.unsaved}</span>
        </>
      )}
      {state.kind === "saving" && (
        <>
          <span className="a-dot scrub-pulse bg-sodium" aria-hidden="true" />
          <span className="text-clay">{w.saving}</span>
        </>
      )}
      {state.kind === "saved" && (
        <>
          <span className="a-dot bg-sodium" aria-hidden="true" />
          <span className="text-clay">{w.saved(clock(state.at))}</span>
        </>
      )}
      {state.kind === "invalid" && (
        <span className="text-[rgb(var(--destructive-ink))]">{state.message}</span>
      )}
      {state.kind === "failed" && (
        <span className="text-[rgb(var(--destructive-ink))]">{state.message}</span>
      )}
      {state.kind === "conflict" && <span className="text-sodium">{w.elsewhere}</span>}
    </span>
  );
}
