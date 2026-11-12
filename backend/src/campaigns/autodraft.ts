import { createHash } from "node:crypto";
import type { AnnounceEvent, AnnounceSettings } from "../announce/schemas.js";
import { SYSTEM_GROUP } from "../audience/schemas.js";
import { escapeHtml as esc } from "./sanitize.js";
import { campaignId, createCampaign } from "./store.js";
import type { Campaign } from "./schemas.js";

/**
 * A post or release event makes a DRAFT campaign for the subscribers group when
 * the owner turned `autoDraftCampaign` on. It is never scheduled or sent here:
 * the owner reads it, edits it and presses send. One draft per event (the id is
 * derived from the event id), so a re-recorded event cannot make a second.
 */
export async function autoDraftFor(ev: AnnounceEvent, settings: AnnounceSettings, now = new Date()): Promise<boolean> {
  if (!settings.sender.autoDraftCampaign || (ev.kind !== "post" && ev.kind !== "release")) return false;
  const he = ev.titleHe || ev.summaryHe;
  const html =
    `<h2>${esc(ev.title)}</h2>` +
    (ev.summary ? `<p>${esc(ev.summary)}</p>` : "") +
    `<p><a href="${esc(ev.url)}">${esc(ev.url)}</a></p>` +
    (he ? `<div dir="rtl"><h2>${esc(ev.titleHe ?? ev.title)}</h2>${ev.summaryHe ? `<p>${esc(ev.summaryHe)}</p>` : ""}</div>` : "");
  const text = [ev.title, ev.summary, ev.url, he ? [ev.titleHe, ev.summaryHe].filter(Boolean).join("\n") : ""].filter(Boolean).join("\n\n");
  const stamp = now.toISOString();
  const c: Campaign = {
    _id: campaignId(`ev-${createHash("sha256").update(ev._id).digest("hex").slice(0, 16)}`),
    type: "campaign",
    name: ev.title.slice(0, 120),
    subject: ev.title.replace(/[\r\n]+/g, " ").slice(0, 200),
    bodyHtml: html,
    bodyText: text,
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
