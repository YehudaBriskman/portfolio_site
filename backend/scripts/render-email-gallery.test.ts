import { mkdirSync, writeFileSync } from "node:fs";
import { vi, it } from "vitest";
import { couch, CouchError } from "../src/db/couch.js";
import { env } from "../src/env.js";
import { DEFAULT_ANNOUNCE_SETTINGS, DEFAULT_DRAFT_LABELS, type AnnounceEvent } from "../src/announce/schemas.js";
import { buildDraft } from "../src/campaigns/autodraft.js";
import { renderCampaignMail } from "../src/campaigns/render.js";
import { renderMail } from "../src/mail/render.js";
import { bodyBlocks } from "../src/campaigns/body.js";

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
  const sender = { ...DEFAULT_ANNOUNCE_SETTINGS.sender, footerIdentity: "Yehuda Briskman", identityEmail: "hello@example.org", labelMode: "all" as const };
  for (const [name, ev] of [["post", post], ["release", release]] as const) {
    const d = buildDraft(ev, DEFAULT_DRAFT_LABELS, site);
    for (const lang of ["en", "he"] as const) {
      const m = await renderCampaignMail({ subject: ev.title, bodyText: d.bodyText, blocks: d.blocks }, { lang }, "h".repeat(32), sender);
      writeFileSync(`${dir}/${name}-${lang}-light.html`, m.html);
      const dark = renderMail(bodyBlocks({ bodyText: d.bodyText, blocks: d.blocks }), { lang, theme: "dark", origin: site, title: ev.title });
      writeFileSync(`${dir}/${name}-${lang}-dark.html`, dark.html);
    }
  }
});
