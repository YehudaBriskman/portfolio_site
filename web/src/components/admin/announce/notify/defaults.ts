import type { NotifySettings } from "@/services/adminAnnounce";

/* What the server resets to (backend DEFAULT_NOTIFY); the server stays the authority. */
export const DEFAULT_NOTIFY: NotifySettings = {
  enabled: false,
  lang: "he",
  events: {
    budget70: { on: true, hours: 24 },
    budget90: { on: true, hours: 24 },
    budgetOut: { on: true, hours: 24 },
    bounce: { on: true, hours: 6 },
    campaign: { on: true, hours: 0 },
    subscriber: { on: false, hours: 24 },
    sweep: { on: true, hours: 24 },
  },
  digest: { enabled: false, hour: 8 },
};
