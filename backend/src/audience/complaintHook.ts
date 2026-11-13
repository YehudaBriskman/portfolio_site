/*
 * The seam the owner notification will plug into: "a spam complaint was
 * received". Carries the contact hash and a time, never an address.
 */
/** `reason` is absent on older callers and means a complaint. */
export type ComplaintEvent = { hash: string; at: string; reason?: "complaint" | "hard-bounce" };
export type ComplaintListener = (e: ComplaintEvent) => void | Promise<void>;

const listeners = new Set<ComplaintListener>();

/** Registers a listener; returns the function that removes it. */
export function onComplaintReceived(l: ComplaintListener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** A failing listener never fails the webhook. */
export function emitComplaint(e: ComplaintEvent): void {
  for (const l of listeners) {
    try {
      void Promise.resolve(l(e)).catch(() => {});
    } catch {
      /* ignored */
    }
  }
}
