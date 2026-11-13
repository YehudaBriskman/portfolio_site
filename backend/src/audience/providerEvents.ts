import { hashEmail } from "./store.js";

/*
 * Provider-agnostic mapping of a delivery event to what the audience list does
 * about it. Resend's shapes are read here and nowhere else; another provider
 * means another `map...` function returning the same `Verdict`.
 *
 *   suppress  the address must not be mailed again (hard bounce, spam complaint)
 *   soft      one more temporary failure, counted toward the 3-soft rule
 *   ignore    everything else (delivered, opened, clicked, unknown): never stored
 */

export type SuppressReason = "hard-bounce" | "soft-bounces" | "complaint";
export type Verdict =
  | { action: "suppress"; reason: "hard-bounce" | "complaint"; hashes: string[] }
  | { action: "soft"; hashes: string[] }
  | { action: "ignore" };

const IGNORE: Verdict = { action: "ignore" };

const recipients = (data: unknown): string[] => {
  const to = (data as { to?: unknown } | null)?.to;
  const list = Array.isArray(to) ? to : typeof to === "string" ? [to] : [];
  return list.filter((a): a is string => typeof a === "string" && a.length > 0 && a.length <= 320).slice(0, 20).map(hashEmail);
};

export function mapResendEvent(event: unknown): Verdict {
  if (!event || typeof event !== "object") return IGNORE;
  const { type, data } = event as { type?: unknown; data?: unknown };
  if (typeof type !== "string") return IGNORE;
  const hashes = recipients(data);
  if (!hashes.length) return IGNORE;
  switch (type) {
    case "email.complained":
      return { action: "suppress", reason: "complaint", hashes };
    case "email.bounced": {
      const kind = String((data as { bounce?: { type?: unknown } }).bounce?.type ?? "").toLowerCase();
      // Only an explicit permanent bounce is final; anything else counts as soft.
      return kind === "permanent" ? { action: "suppress", reason: "hard-bounce", hashes } : { action: "soft", hashes };
    }
    case "email.delivery_delayed":
      return { action: "soft", hashes };
    default:
      return IGNORE;
  }
}
