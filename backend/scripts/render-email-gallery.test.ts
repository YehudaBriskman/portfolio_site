import { mkdirSync, writeFileSync } from "node:fs";
import { vi, it } from "vitest";
import { couch, CouchError } from "../src/db/couch.js";
import { env } from "../src/env.js";
import { DEFAULT_ANNOUNCE_SETTINGS, type AnnounceEvent } from "../src/announce/schemas.js";
import { buildIssue } from "../src/campaigns/issue.js";
import { renderCampaignMail } from "../src/campaigns/render.js";

/* Writes the sample emails (HTML, light and dark forced) to $EMAIL_GALLERY_DIR for the screenshots. Skipped unless that variable is set. */
const dir = process.env.EMAIL_GALLERY_DIR;
it.skipIf(!dir)("renders the gallery", async () => {
  (env as { SUBSCRIBE_SECRET?: string }).SUBSCRIBE_SECRET = "s".repeat(32);
  vi.spyOn(couch, "get").mockImplementation(async () => {
    throw new CouchError(404, "404");
  });
  mkdirSync(dir!, { recursive: true });
  const site = new URL(env.SITE_URL).origin;
  const post: AnnounceEvent = {
    _id: "p", type: "announce", kind: "post", ref: "my-post", title: "Notes on building a calm newsletter", titleHe: "רשימות על בניית עלון רגוע", summary: "How the mail design system keeps one layout for every client.", summaryHe: "איך מערכת העיצוב של המייל שומרת על פריסה אחת לכל לקוח.",
    tags: ["Email", "Design"], url: `${site}/blog/my-post`, path: "/blog/my-post", publishedAt: "2026-11-10T08:00:00Z", readMinutes: 6, langs: ["en", "he"], createdAt: "2026-11-10T08:00:00Z", done: {},
  };
  const release: AnnounceEvent = {
    _id: "r", type: "announce", kind: "release", ref: "v1.8.0", title: "portfolio v1.8.0", summary: "Phone redesign", url: "https://github.com/YehudaBriskman/portfolio_site/releases/tag/v1.8.0", tags: [],
    version: "v1.8.0", publishedAt: "2026-11-20T10:00:00Z", notes: ["Phone admin redesign", "Faster newsletter send", "Email data rows and release notes"], langs: ["en", "he"], createdAt: "2026-11-20T10:00:00Z", done: {},
  };
  const sender = { ...DEFAULT_ANNOUNCE_SETTINGS.sender, footerIdentity: "Yehuda Briskman", identityEmail: "hello@example.org", identityWebsite: "https://example.org" };
  const more: AnnounceEvent[] = [
    { ...release, _id: "r0", ref: "v1.7.0", title: "WindoM v1.7.0", version: "v1.7.0", publishedAt: "2026-11-05T10:00:00Z", notes: ["Faster tiling", "New shortcuts"] },
    { ...release, _id: "r1", ref: "v1.8.0", title: "WindoM v1.8.0", publishedAt: "2026-11-20T10:00:00Z" },
    { ...release, _id: "r2", ref: "v0.5.0", title: "Bothy v0.5.0", version: "v0.5.0", publishedAt: "2026-11-12T10:00:00Z", notes: ["Files view", "Live search"] },
    { ...release, _id: "r3", ref: "v1.8.1", title: "WindoM v1.8.1", version: "v1.8.1", publishedAt: "2026-11-22T10:00:00Z", notes: undefined },
    { ...post, _id: "p1", ref: "p-1", publishedAt: "2026-11-03T08:00:00Z", title: "Why a calm newsletter", lead: "A newsletter should read like a letter, not a promotion. This note walks through the choices I made: one column, real paragraphs, one button per item and nothing that follows you around the web.\n\nThe rest is about how an issue is put together from what happened since the last one." },
    { ...post, _id: "p2", ref: "p-2", publishedAt: "2026-11-08T08:00:00Z", title: "Plain text first", titleHe: undefined, summaryHe: undefined, readMinutes: 4 },
    post,
    { ...post, _id: "p4", ref: "p-4", publishedAt: "2026-11-15T08:00:00Z", title: "Tiling windows on Windows", titleHe: undefined, summaryHe: undefined, tags: ["Tools"], readMinutes: 8 },
  ];
  const issue = buildIssue(more, { ...DEFAULT_ANNOUNCE_SETTINGS, sender }, new Date("2026-12-01T09:00:00Z"), new Date("2026-11-01T00:00:00Z"))!;
  for (const lang of ["en", "he"] as const) {
    const m = await renderCampaignMail({ subject: issue.subject, bodyText: issue.bodyText, blocks: issue.blocks, labelAd: false }, { lang }, "h".repeat(32), sender);
    writeFileSync(`${dir}/issue-${lang}-light.html`, m.html);
    writeFileSync(`${dir}/issue-${lang}-dark.html`, m.html);
    writeFileSync(`${dir}/issue-${lang}-label.html`, (await renderCampaignMail({ subject: issue.subject, bodyText: issue.bodyText, blocks: issue.blocks, labelAd: true }, { lang }, "h".repeat(32), sender)).html);
  }
});
