#!/usr/bin/env node
/*
 * Media words and note links in Hebrew (#306), in both themes at 1440 and
 * 390, into docs/i18n/build/:
 *
 *   306-media-he-*        a picture's alt and caption, the Hebrew beside each
 *   306-media-captions-*  a video's captions, one track per language
 *   306-note-links-*      a note's links, each label with its Hebrew
 *   306-area-links-*      an area's links, each label `Text` with its Hebrew
 *
 *   npm run build && xvfb-run -a node scripts/shoot-media-text.mjs
 *
 * Under xvfb the browser is headed, which is what gives it a frame clock on
 * this box. Every wait polls on a timer (`{ polling: 500 }`), never on rAF,
 * scrolling is done in the page (Playwright's own waits for a stable box,
 * which is rAF again), and a capture is retried. The API is the a11y stub.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./a11y/site-stub.mjs";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/i18n/build");
mkdirSync(OUT, { recursive: true });

const SIZES = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };
const ONLY = process.env.ONLY?.split(",");
const unit = (path, status, primary = true) => ({ path, status, primary, en: path, he: status === "missing" ? null : "x", draftHe: null });
const REPORT = {
  ok: true,
  counts: { missing: 1, draft: 0, stale: 1, unverified: 0, translated: 2 },
  coverage: 50,
  items: [
    { type: "media", id: "fixture-media", title: "fixture-media.jpg", route: "/admin/media?id=fixture-media", rank: 200, visibility: "public", status: "translated", units: [unit("alt", "translated"), unit("caption", "missing", false)] },
    { type: "post", id: "fixture-post", title: "A fixture note", route: "/blog/fixture-post", rank: 100, visibility: "public", status: "translated", units: [unit("title", "translated"), unit("links.0.label", "translated", false), unit("links.1.label", "stale", false)] },
  ],
};
const LINKS = [
  { label: "Repository", url: "https://example.com/" },
  { label: "Live demo", url: "https://example.com/demo" },
];

/* An area whose link labels are `Text`, one from before #306 still a string. */
const AREA = {
  _rev: "1-area",
  slug: "fixture-area",
  title: "A fixture area",
  tagline: "An area for the audit",
  he: { title: "אזור לבדיקה", tagline: null, description: null },
  kind: "project",
  repo: null,
  stats: null,
  description: "",
  coverImage: null,
  icon: null,
  links: [
    { label: { en: "Source on GitHub", he: "הקוד ב-GitHub" }, url: "https://example.com/src" },
    { label: "Changelog", url: "https://example.com/changes" },
  ],
  order: 50,
  status: "published",
};

/* [name, path, what it waits for, what it does once loaded] */
const SHOTS = [
  ["306-media-he", "/admin/media?id=fixture-media", "Alt text in Hebrew", async (page) => {
    await page.getByRole("textbox", { name: "Caption in Hebrew" }).fill("זוהר הצפון מעל הבקתה");
    await page.getByRole("textbox", { name: "Alt text in Hebrew" }).evaluate((el) => el.scrollIntoView({ block: "center" }));
  }],
  ["306-media-captions", "/admin/media?id=fixture-video", "Remove the", async (page) => {
    await page.getByRole("region", { name: "Captions" }).evaluate((el) => el.scrollIntoView({ block: "center" }));
  }],
  ["306-note-links", "/admin/posts/fixture-post", "Link label in Hebrew", async (page) => {
    /* The links sit under "Advanced", closed until opened. */
    await page.locator("details:has([data-path^='links.'])").evaluate((d) => (d.open = true));
    await page.getByRole("textbox", { name: "Link label in Hebrew" }).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
  }],
  ["306-area-links", "/admin/areas/fixture-area", "Link label in Hebrew", async (page) => {
    await page.locator("details:has([data-path^='links.'])").evaluate((d) => (d.open = true)).catch(() => {});
    await page.getByRole("textbox", { name: "Link label in Hebrew" }).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
  }],
];

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: !process.env.DISPLAY, args: ["--no-sandbox"] });
const problems = [];

try {
  for (const [name, path, ready, act] of SHOTS.filter(([n]) => !ONLY || ONLY.includes(n))) {
    for (const theme of ["light", "dark"]) {
      for (const [w, viewport] of Object.entries(SIZES)) {
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
        await ctx.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
        await ctx.route("**/api/**", (route) => {
          const url = new URL(route.request().url());
          const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
          const { status, body } = answer(url.href, false);
          /* The fixture note, live, with two links and one Hebrew label. */
          const withLinks = (post) =>
            post?.slug !== "fixture-post"
              ? post
              : {
                  ...post,
                  draft: null,
                  draftSavedAt: null,
                  content: post.content ? { ...post.content, links: LINKS } : post.content,
                  links: LINKS,
                  he: { title: "רשימה לבדיקה", subtitle: "", excerpt: "", body: "", "links.0.label": "מאגר הקוד" },
                };
          if (url.pathname === "/api/admin/posts/fixture-post" && body?.post) return json({ ...body, post: withLinks(body.post) });
          if (url.pathname === "/api/admin/posts" && body?.items) return json({ ...body, items: body.items.map(withLinks) });
          if (url.pathname === "/api/admin/translations") return json(REPORT);
          if (url.pathname === "/api/admin/collections") return json({ ok: true, items: [AREA] });
          return json(body, status);
        });
        const page = await ctx.newPage();
        page.on("pageerror", (e) => problems.push(`${name}: ${e.message}`));
        await page.goto(`${base}${path}`, { waitUntil: "load" });
        await page.waitForFunction(
          (t) => [...document.querySelectorAll("label, button, h3")].some((el) => el.textContent?.includes(t)),
          ready,
          { polling: 500, timeout: 20_000 },
        );
        await page.evaluate(() => document.fonts.ready);
        await act(page);
        await page.waitForTimeout(1200);
        for (let i = 0; ; i++) {
          try {
            await page.screenshot({ path: `${OUT}/${name}-${theme}-${w}.png`, timeout: 45_000 });
            break;
          } catch (e) {
            if (i >= 3) throw e;
          }
        }
        console.log("shot", name, theme, w);
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
  stop();
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
