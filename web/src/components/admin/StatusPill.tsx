/*
 * One save-state readout for every admin editor.
 *
 * The old editor carried success and failure in a single string rendered in
 * --sodium, so "Save failed" arrived in the same accent colour as "Saved." — a
 * failure that looked like a success. These are distinct states with distinct
 * colours, and failure gets its own ink.
 */

export type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "invalid"; message: string }
  | { kind: "failed"; message: string }
  | { kind: "conflict" };

function clock(at: Date): string {
  return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function StatusPill({ state }: { state: SaveState }) {
  const isProblem = state.kind === "failed" || state.kind === "conflict" || state.kind === "invalid";

  return (
    <span
      // Failures interrupt; a routine "Saved" should not.
      aria-live={isProblem ? "assertive" : "polite"}
      className="mono flex min-h-[1.25rem] items-center gap-2 text-[0.6875rem] uppercase tracking-[0.18em]"
    >
      {state.kind === "dirty" && (
        <>
          <span className="a-dot bg-bone/40" aria-hidden="true" />
          <span className="text-clay">Unsaved</span>
        </>
      )}
      {state.kind === "saving" && (
        <>
          <span className="a-dot animate-pulse-soft bg-sodium" aria-hidden="true" />
          <span className="text-clay">Saving</span>
        </>
      )}
      {state.kind === "saved" && (
        <>
          <span className="a-dot bg-sodium" aria-hidden="true" />
          <span className="text-clay">Saved {clock(state.at)}</span>
        </>
      )}
      {state.kind === "invalid" && (
        <span className="text-[rgb(var(--destructive-ink))]">{state.message}</span>
      )}
      {state.kind === "failed" && (
        <span className="text-[rgb(var(--destructive-ink))]">{state.message}</span>
      )}
      {state.kind === "conflict" && <span className="text-sodium">Changed elsewhere</span>}
    </span>
  );
}
