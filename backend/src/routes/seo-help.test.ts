/*
 * The help area's heads (#803): /help/<id> for each page, in both languages.
 * What every page shares (one title, description, canonical, JSON-LD, the
 * sitemap) is held for all of them in seo-gates.test.ts; this holds what is
 * particular to the help pages.
 */
import fs from "fs";
import path from "path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { DEFAULT_SETTINGS } from "../schemas/site-settings.js";
import * as settings from "../services/site-settings.js";
import { resetShellCache } from "../services/seo.js";
import { HELP_PAGES } from "../services/help-pages.js";

const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, "../../../web/index.html"), "utf8");

beforeEach(() => {
  resetShellCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(INDEX_HTML, { status: 200 })));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetShellCache();
});

const get = (p: string, lang: "en" | "he" = "en") => request(createApp()).get(`/api/seo/render${lang === "he" ? "/he" : ""}${p}`);
const crumbs = (html: string) => {
  const doc = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);
  return (doc["@graph"] as Record<string, unknown>[]).find((n) => n["@type"] === "BreadcrumbList")!.itemListElement as { name: string; item: string }[];
};

describe("a help page's head", () => {
  it("is the topic's own title and heading, with breadcrumbs Home, Help, the topic", async () => {
    const res = await get("/help/contact-sent");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>Message sent · Yehuda Briskman</title>");
    expect(res.text).toContain('<link rel="canonical" href="https://yehudabriskman.com/help/contact-sent" />');
    expect(res.text).toContain("<h1>Message sent</h1>");
    expect(crumbs(res.text).map((c) => c.name)).toEqual(["Home", "Help", "Message sent"]);
    expect(crumbs(res.text).map((c) => c.item)).toEqual([
      "https://yehudabriskman.com/",
      "https://yehudabriskman.com/help",
      "https://yehudabriskman.com/help/contact-sent",
    ]);
  });

  it("is in Hebrew under /he, indexed, with its own canonical", async () => {
    const res = await get("/help/rss", "he");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<link rel="canonical" href="https://yehudabriskman.com/he/help/rss" />');
    expect(res.text).toMatch(/<title>פיד RSS · /);
    expect(res.text).not.toMatch(/noindex/);
    expect(crumbs(res.text).map((c) => c.name)).toEqual(["בית", "עזרה", "פיד RSS"]);
  });

  it("is noindex in Hebrew only when the page has no Hebrew of its own (#318)", async () => {
    const page = HELP_PAGES.find((p) => p.id === "rss")!;
    const bare = { ...page, hebrew: false };
    const spy = vi.spyOn(HELP_PAGES, "find").mockReturnValue(bare);
    const he = await get("/help/rss", "he");
    expect(he.text).toMatch(/<meta name="robots" content="noindex/);
    const en = await get("/help/rss");
    expect(en.text).not.toMatch(/noindex/);
    spy.mockRestore();
  });

  it("answers 404 for an id that is no page", async () => {
    const res = await get("/help/no-such-topic");
    expect(res.status).toBe(404);
    expect(res.text).toMatch(/noindex/);
    expect((await get("/help/problems")).status).toBe(404);
    expect((await get("/help/toString")).status).toBe(404);
  });

  it("answers 404 for the contact form's guide while the form is hidden, and still serves its outcomes", async () => {
    const hidden = { ...DEFAULT_SETTINGS, home: { sections: DEFAULT_SETTINGS.home.sections.map((s) => (s.id === "contact" ? { ...s, visible: false } : s)) } };
    vi.spyOn(settings, "settingsOrDefault").mockResolvedValue(hidden);
    expect((await get("/help/contact-form")).status).toBe(404);
    expect((await get("/help/contact-sent")).status).toBe(200);
  });
});

describe("grouped help topics are noindex (#907)", () => {
  it("serves noindex on a message explainer and not on a guide", async () => {
    const grouped = await request(createApp()).get("/api/seo/render/help/contact-sent");
    const guide = await request(createApp()).get("/api/seo/render/help/language");
    expect(grouped.text).toMatch(/<meta name="robots" content="noindex/);
    expect(guide.text).not.toMatch(/noindex/);
  });
});
