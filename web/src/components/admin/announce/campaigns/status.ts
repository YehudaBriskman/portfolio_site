import type { CampaignStatus } from "@/services/adminCampaigns";

/* Which of the admin's shared pill shapes a campaign status wears; the word always says the state. */
export const pillState = (s: CampaignStatus) => (s === "sending" ? "active" : s === "sent" ? "published" : s === "scheduled" || s === "paused" ? "changes" : s === "failed" ? "revoked" : s === "canceled" ? "archived" : "draft");
