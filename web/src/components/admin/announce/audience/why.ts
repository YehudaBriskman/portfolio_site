import type { Contact } from "@/services/adminAudience";

export type Why = { key: "active" | "activeNoTopics" | "pending" | "unsubscribed" | "suppressed"; mailable: boolean };

/** Why a contact can or cannot be mailed: the status decides, then topics. */
export function whyOf(c: Pick<Contact, "status" | "topics">): Why {
  if (c.status === "suppressed") return { key: "suppressed", mailable: false };
  if (c.status === "unsubscribed") return { key: "unsubscribed", mailable: false };
  if (c.status === "pending") return { key: "pending", mailable: false };
  if (!c.topics.blog && !c.topics.releases) return { key: "activeNoTopics", mailable: false };
  return { key: "active", mailable: true };
}
