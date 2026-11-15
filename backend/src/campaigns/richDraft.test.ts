import { beforeEach, describe, expect, it, vi } from "vitest";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { DEFAULT_ANNOUNCE_SETTINGS, DEFAULT_DRAFT_LABELS, type AnnounceEvent } from "../announce/schemas.js";
import { releaseNotes } from "../services/github.js";
import { renderMail } from "../mail/render.js";
import { buildDraft } from "./autodraft.js";
import { bodyBlocks } from "./body.js";
import { renderCampaignMail } from "./render.js";
import { CampaignCreate } from "./schemas.js";

const SITE = new URL(env.SITE_URL).origin;
beforeEach(() => {
  (env as { SUBSCRIBE_SECRET?: string }).SUBSCRIBE_SECRET = "s".repeat(32);
  vi.spyOn(couch, "get").mockImplementation(async () => {
    throw new CouchError(404, "404");
  });
});

const post: AnnounceEvent = {
  _id: "announce:post:my-post:1", type: "announce", kind: "post", ref: "my-post", title: "A <b>post</b>", titleHe: "פוסט", summary: "The summary.", summaryHe: "התקציר.",
  tags: ["TypeScript", "Email"], url: `${SITE}/blog/my-post`, path: "/blog/my-post", publishedAt: "2026-11-10T08:00:00Z", readMinutes: 6, langs: ["en", "he"], createdAt: "2026-11-10T08:00:00Z", done: {},
};
const release: AnnounceEvent = {
  _id: "announce:release:v1.8.0:1", type: "announce", kind: "release", ref: "v1.8.0", title: "site v1.8.0", summary: "Phone redesign", tags: [], url: "https://github.com/o/r/releases/tag/v1.8.0",
  version: "v1.8.0", publishedAt: "2026-11-20T10:00:00Z", notes: ["Phone admin redesign", "Faster newsletter send"], langs: ["en", "he"], createdAt: "2026-11-20T10:00:00Z", done: {},
};
const sender = { ...DEFAULT_ANNOUNCE_SETTINGS.sender, footerIdentity: "Yehuda", identityEmail: "me@example.org" };

describe("auto-draft content comes from the real event", () => {
  it("a post: cover, title, date / read time / topics rows, excerpt, labelled button", () => {
    const d = buildDraft(post, DEFAULT_DRAFT_LABELS, SITE);
    expect(d.blocks[0]).toEqual({ type: "image", url: `${SITE}/api/seo/og/blog/my-post.png?format=og`, text: "A <b>post</b>" });
    expect(d.blocks).toContainEqual({ type: "h2", text: "A <b>post</b>" });
    const facts = d.blocks.find((b) => b.type === "facts");
    expect(facts?.rows).toEqual([
      { label: "Date", value: "November 10, 2026" },
      { label: "Read time", value: "6 min" },
      { label: "Topics", value: "TypeScript, Email" },
    ]);
    expect(d.blocks).toContainEqual({ type: "cta", url: post.url, label: "Read the post" });
    expect(d.blocks).toContainEqual({ type: "p", text: "The summary." });
    /* The Hebrew half: its own labels, its own text, marked he. */
    expect(d.blocks).toContainEqual({ type: "cta", url: post.url, label: "לקריאת הפוסט" });
    expect(d.blocks.filter((b) => b.type === "facts").map((b) => b.lang)).toEqual([undefined, "he"]);
  });

  it("a release: version row, 'what changed' list from the release's own notes, See the release button", () => {
    const d = buildDraft(release, DEFAULT_DRAFT_LABELS, SITE);
    expect(d.blocks).toContainEqual({ type: "h2", text: "What changed" });
    expect(d.blocks).toContainEqual({ type: "ul", items: ["Phone admin redesign", "Faster newsletter send"] });
    expect(d.blocks.find((b) => b.type === "facts")?.rows?.[0]).toEqual({ label: "Version", value: "v1.8.0" });
    expect(d.blocks).toContainEqual({ type: "cta", url: release.url, label: "See the release" });
  });

  it("never invents: no read time, date or notes when the event has none", () => {
    const d = buildDraft({ ...post, readMinutes: undefined, publishedAt: undefined, tags: [] }, DEFAULT_DRAFT_LABELS, SITE);
    expect(d.blocks.some((b) => b.type === "facts")).toBe(false);
    const r = buildDraft({ ...release, notes: undefined }, DEFAULT_DRAFT_LABELS, SITE);
    expect(JSON.stringify(r.blocks)).not.toContain("What changed");
  });

  it("is accepted by the campaign schema the editor saves with, and its text twin is in sync", () => {
    const d = buildDraft(release, DEFAULT_DRAFT_LABELS, SITE);
    expect(CampaignCreate.safeParse({ name: "n", subject: "s", bodyText: d.bodyText, blocks: d.blocks, groups: ["subscribers"] }).success).toBe(true);
    expect(d.bodyText).toContain("Version: v1.8.0");
    expect(d.bodyText).toContain("- Phone admin redesign");
    expect(d.bodyText).toContain(`See the release: ${release.url}`);
  });

  it("the labels default to unapproved and are editable settings, not constants in the template", () => {
    expect(DEFAULT_DRAFT_LABELS.approved).toBe(false);
    const d = buildDraft(post, { ...DEFAULT_DRAFT_LABELS, en: { ...DEFAULT_DRAFT_LABELS.en, ctaPost: "Go read it" } }, SITE);
    expect(d.blocks).toContainEqual({ type: "cta", url: post.url, label: "Go read it" });
  });
});

describe("release notes parsing", () => {
  it("keeps bullets, drops marks, links, credits and the changelog line", () => {
    const body = "## What's Changed\n* **Admin:** phone redesign by @someone in https://github.com/o/r/pull/9\n- [Send](https://x.test) is faster\n\n**Full Changelog**: https://github.com/o/r/compare/a...b";
    expect(releaseNotes(body)).toEqual(["Admin: phone redesign", "Send is faster"]);
    expect(releaseNotes(null)).toEqual([]);
    expect(releaseNotes(Array.from({ length: 20 }, (_, i) => `- item ${i}`).join("\n"))).toHaveLength(8);
  });
});

describe("the rich campaign mail", () => {
  it("renders the data rows, escaped, in both languages with the text twin in sync", async () => {
    const d = buildDraft(post, DEFAULT_DRAFT_LABELS, SITE);
    for (const lang of ["en", "he"] as const) {
      const m = await renderCampaignMail({ subject: "S", bodyText: d.bodyText, blocks: d.blocks }, { lang }, "h".repeat(32), { ...sender, labelMode: "all" });
      expect(m.html).toContain("Read time");
      expect(m.html).toContain("A &lt;b&gt;post&lt;/b&gt;");
      expect(m.html).not.toContain("<b>post</b>");
      expect(m.text).toContain("Date: November 10, 2026");
      expect(m.text).toContain(`Read the post: ${SITE}/blog/my-post`);
      expect(m.html).toMatch(lang === "he" ? /<html lang="he" dir="rtl"/ : /<html lang="en" dir="ltr"/);
    }
  });

  it("keeps the legal frame untouched: List-Unsubscribe headers, one-click post, label, visible unsubscribe link, no tracking", async () => {
    const d = buildDraft(release, DEFAULT_DRAFT_LABELS, SITE);
    const m = await renderCampaignMail({ subject: "S", bodyText: d.bodyText, blocks: d.blocks }, { lang: "he" }, "h".repeat(32), { ...sender, labelMode: "hebrew" });
    expect(m.headers["List-Unsubscribe"]).toMatch(/^<https?:\/\/[^>]+\/api\/subscribe\/unsubscribe\?token=/);
    expect(m.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(m.headers.Precedence).toBe("bulk");
    expect(m.subject.startsWith("פרסומת: ")).toBe(true);
    expect(m.text.startsWith("פרסומת")).toBe(true);
    expect(m.html).toContain("/unsubscribe?token=");
    expect(m.html).toContain(sender.unsubscribeNoteHe.split(" {site}")[0]);
  });

  it("no tracking pixel, no tracked or redirected link, no script, flex or grid", async () => {
    const d = buildDraft(post, DEFAULT_DRAFT_LABELS, SITE);
    const { html } = await renderCampaignMail({ subject: "S", bodyText: d.bodyText, blocks: d.blocks }, { lang: "en" }, "h".repeat(32), sender);
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    for (const i of imgs) {
      expect(i).toMatch(/alt="/);
      expect(i).toMatch(/width="\d+"/);
      expect(i).not.toMatch(/width="1"|height="1"/);
      expect(i).toContain(`src="${SITE}/`);
    }
    for (const m of html.matchAll(/href="([^"]+)"/g)) {
      expect(m[1]).not.toMatch(/utm_|[?&](track|click|open|redirect|r|u)=|\/(track|click|redirect|r)\//i);
    }
    expect(html).not.toMatch(/<script|display:\s*(flex|grid)|<form|<link\b/i);
  });

  it("text twin snapshot (post, English)", async () => {
    const d = buildDraft(post, DEFAULT_DRAFT_LABELS, SITE);
    const { text } = renderMail(bodyBlocks({ bodyText: d.bodyText, blocks: d.blocks }), { lang: "en", origin: SITE });
    expect(text).toMatchInlineSnapshot(`
      "A <b>post</b>: https://yehudabriskman.com/api/seo/og/blog/my-post.png?format=og

      A <b>post</b>

      Date: November 10, 2026
      Read time: 6 min
      Topics: TypeScript, Email

      The summary.

      Read the post: https://yehudabriskman.com/blog/my-post

      פוסט

      תאריך: 10 בנובמבר 2026
      זמן קריאה: 6 דקות
      נושאים: TypeScript, Email

      התקציר.

      לקריאת הפוסט: https://yehudabriskman.com/blog/my-post"
    `);
  });
});
