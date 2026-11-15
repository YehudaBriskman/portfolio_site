import { createHash } from "node:crypto";
import { cardUrl } from "../announce/emailHtml.js";
import type { AnnounceEvent, AnnounceSettings, SenderSettings } from "../announce/schemas.js";
import type { Lang } from "../audience/schemas.js";
import { SITE_URL } from "../services/seo.js";
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
/* x.y.Z with Z above 0: a fix release, which is not news to a reader. Minor, major and anything that is not plain semver still draft. */
const PATCH_RELEASE = /^v?\d+\.\d+\.[1-9]\d*$/;

const dateOf = (iso: string | undefined, lang: Lang): string => {
  const t = iso ? new Date(iso) : null;
  return t && !Number.isNaN(t.getTime()) ? new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-US", { dateStyle: "long", timeZone: "UTC" }).format(t) : "";
};

/**
 * The review copy of one event: cover (the site's own generated card), title,
 * data rows, excerpt, release notes and the button, all from the event's real
 * fields. A field the event does not have is left out, never made up. The
 * wording around the data is the owner's `draftLabels` setting.
 */
export function buildDraft(ev: AnnounceEvent, labels: SenderSettings["draftLabels"], siteUrl: string): { blocks: Block[]; bodyText: string } {
  const card = cardUrl(ev, siteUrl);
  const link = safeHref(ev.url);
  const section = (lang: Lang): Block[] => {
    const w = labels[lang];
    const he = lang === "he";
    const title = (he && ev.titleHe) || ev.title;
    const summary = (he && ev.summaryHe) || ev.summary;
    const date = dateOf(ev.publishedAt, lang);
    const rows = [
      ev.kind === "release" && ev.version ? { label: w.factVersion, value: ev.version } : null,
      date ? { label: w.factDate, value: date } : null,
      ev.kind === "post" && ev.readMinutes ? { label: w.factRead, value: w.readValue.replace("{n}", String(ev.readMinutes)) } : null,
      ev.kind === "post" && ev.tags.length ? { label: w.factTopics, value: ev.tags.join(", ") } : null,
    ].filter((r): r is { label: string; value: string } => r !== null);
    const notes = ev.kind === "release" && !he ? (ev.notes ?? []).filter(Boolean) : [];
    const lng = he ? { lang: "he" as const } : {};
    return [
      { type: "h2", text: title },
      ...(rows.length ? [{ type: "facts" as const, rows, ...lng }] : []),
      ...(summary ? [{ type: "p" as const, text: summary }] : []),
      ...(notes.length ? [{ type: "h2" as const, text: w.changesTitle }, { type: "ul" as const, items: notes }] : []),
      ...(link ? [{ type: "cta" as const, url: ev.url, label: ev.kind === "release" ? w.ctaRelease : w.ctaPost }] : []),
    ];
  };
  const hasHe = Boolean(ev.titleHe || ev.summaryHe);
  const blocks: Block[] = [...(card ? [{ type: "image" as const, url: card, text: ev.title }] : []), ...section("en"), ...(hasHe ? section("he") : [])];
  const bodyText = blocks
    .map((b) => {
      switch (b.type) {
        case "ul":
          return (b.items ?? []).map((i) => `- ${i}`).join("\n");
        case "facts":
          return (b.rows ?? []).map((r) => `${r.label}: ${r.value}`).join("\n");
        case "cta":
          return `${b.label}: ${b.url}`;
        case "image":
          return "";
        default:
          return b.text ?? "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
  return { blocks, bodyText };
}

export async function autoDraftFor(ev: AnnounceEvent, settings: AnnounceSettings, now = new Date()): Promise<boolean> {
  if (!settings.sender.autoDraftCampaign || (ev.kind !== "post" && ev.kind !== "release")) return false;
  if (ev.kind === "release" && PATCH_RELEASE.test(ev.version ?? "")) return false;
  const { blocks, bodyText: text } = buildDraft(ev, settings.sender.draftLabels, SITE_URL);
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
