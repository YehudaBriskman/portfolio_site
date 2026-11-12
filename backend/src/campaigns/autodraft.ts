import { createHash } from "node:crypto";
import type { AnnounceEvent, AnnounceSettings } from "../announce/schemas.js";
import { SYSTEM_GROUP } from "../audience/schemas.js";
import { safeHref } from "./body.js";
import { campaignId, createCampaign } from "./store.js";
import type { Block, Campaign } from "./schemas.js";

/**
 * A post or release event makes a DRAFT campaign for the subscribers group when
 * the owner turned `autoDraftCampaign` on. It is never scheduled or sent here:
 * the owner reads it, edits it and presses send. One draft per event (the id is
 * derived from the event id), so a re-recorded event cannot make a second.
 */
export async function autoDraftFor(ev: AnnounceEvent, settings: AnnounceSettings, now = new Date()): Promise<boolean> {
  if (!settings.sender.autoDraftCampaign || (ev.kind !== "post" && ev.kind !== "release")) return false;
  const he = ev.titleHe || ev.summaryHe;
  const blocks: Block[] = [
    { type: "h2", text: ev.title },
    ...(ev.summary ? [{ type: "p" as const, text: ev.summary }] : []),
    ...(safeHref(ev.url) ? [{ type: "cta" as const, url: ev.url, label: ev.url }] : []),
    ...(he ? [{ type: "h2" as const, text: ev.titleHe ?? ev.title }, ...(ev.summaryHe ? [{ type: "p" as const, text: ev.summaryHe }] : [])] : []),
  ];
  const text = [ev.title, ev.summary, ev.url, he ? [ev.titleHe, ev.summaryHe].filter(Boolean).join("\n") : ""].filter(Boolean).join("\n\n");
  const stamp = now.toISOString();
  const c: Campaign = {
    _id: campaignId(`ev-${createHash("sha256").update(ev._id).digest("hex").slice(0, 16)}`),
    type: "campaign",
    name: ev.title.slice(0, 120),
    subject: ev.title.replace(/[\r\n]+/g, " ").slice(0, 200),
    bodyText: text,
    blocks,
    groups: [SYSTEM_GROUP],
    lang: "all",
    topic: ev.kind === "release" ? "releases" : "blog",
    status: "draft",
    counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 },
    eventId: ev._id,
    createdAt: stamp,
    updatedAt: stamp,
  };
  return createCampaign(c);
}
