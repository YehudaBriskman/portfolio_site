import { logger } from "../logger.js";

/*
 * What the owner may be told about. Every event carries counts, a campaign's
 * own name and a short hash prefix, never a subscriber's address or name: the
 * mail is read in an inbox the site does not control.
 */
export type OwnerEvent =
  | { kind: "budget70" | "budget90"; used: number; usable: number }
  | { kind: "budgetOut"; scope: "day" | "month" }
  | { kind: "bounce"; reason: "complaint" | "hard-bounce"; ref: string }
  | { kind: "campaign"; name: string; status: "sent" | "failed"; sent: number; failed: number; suppressed: number }
  | { kind: "subscriber"; ref: string }
  | { kind: "sweep" };

export type OwnerEventListener = (e: OwnerEvent) => void | Promise<void>;
const listeners = new Set<OwnerEventListener>();

export function onOwnerEvent(l: OwnerEventListener): () => void {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** Fire and forget. A failing listener can never fail the send, the webhook or the sweep that announced it. */
export function emitOwnerEvent(e: OwnerEvent): void {
  for (const l of listeners) {
    try {
      void Promise.resolve(l(e)).catch(() => logger.warn({ kind: e.kind }, "owner notification listener failed"));
    } catch {
      logger.warn({ kind: e.kind }, "owner notification listener failed");
    }
  }
}
