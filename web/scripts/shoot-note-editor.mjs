#!/usr/bin/env node
/*
 * The note editor in both languages (#305), in both themes at 1440 and 390,
 * into docs/i18n/build/:
 *
 *   305-editor-*         the title and its Hebrew side by side, the stale notice
 *   305-editor-diff-*    "Show what changed": the English since the Hebrew was written
 *   305-editor-both-*    the body, English and Hebrew side by side
 *   305-publish-scope-*  the review dialog, publishing the Hebrew only
 *
 *   npm run build && xvfb-run -a node scripts/shoot-note-editor.mjs
 *
 * Under xvfb the browser is headed, which is what gives it a frame clock on
 * this box. Every wait polls on a timer (`{ polling: 500 }`), never on rAF,
 * and a capture is retried. The API is the a11y stub, with the fixture note
 * given Hebrew written against an older English body.
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
/* The Hebrew was written when the English body was its first paragraph only. */
const OLD_EN = "Opening paragraph with a [link to the projects](/projects) and `inline code`.";
const HE_BODY = "פסקת פתיחה עם [קישור לפרויקטים](/projects) ו`קוד`.";
const unit = (path, status) => ({ path, status, primary: true, en: path, he: "x", draftHe: null });

/* What each shot does after the editor loads. */
const SHOTS = [
  ["305-editor", async () => {}],
  ["305-editor-diff", async (page) => {
    await page.getByRole("button", { name: "Show what changed" }).click();
    await page.locator("[role=group] ins").first().scrollIntoViewIfNeeded();
  }],
  ["305-editor-both", async (page) => {
    await page.getByRole("button", { name: "Side by side" }).click();
    await page.getByRole("textbox", { name: "Body, Hebrew" }).scrollIntoViewIfNeeded();
  }],
  ["305-publish-scope", async (page) => {
    await page.getByRole("textbox", { name: "Title in Hebrew", exact: true }).fill("רשימה לבדיקה, מתוקנת");
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("Review and publish") && !b.disabled), null, { polling: 500, timeout: 10_000 });
    await page.getByRole("button", { name: "Review and publish" }).first().click();
    await page.getByRole("radio", { name: "Hebrew only" }).check();
  }],
];

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: !process.env.DISPLAY, args: ["--no-sandbox"] });
const problems = [];

try {
  for (const [name, act] of SHOTS.filter(([n]) => !ONLY || ONLY.includes(n))) {
    for (const theme of ["light", "dark"]) {
      for (const [w, viewport] of Object.entries(SIZES)) {
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
        await ctx.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
        await ctx.route("**/api/**", (route) => {
          const url = new URL(route.request().url());
          const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
          const { status, body } = answer(url.href, false);
          /* The fixture note, live with Hebrew written against an older English body. */
          const withHe = (post) =>
            post?.slug !== "fixture-post"
              ? post
              : {
                  ...post,
                  draft: null,
                  draftSavedAt: null,
                  he: { title: "רשימה לבדיקה", subtitle: "", excerpt: "", body: HE_BODY },
                  heMeta: { src: { title: "aaaaaaaaaaaa", body: "bbbbbbbbbbbb" }, bodyBase: OLD_EN },
                };
          if (url.pathname === "/api/admin/posts/fixture-post" && body?.post) return json({ ...body, post: withHe(body.post) });
          if (url.pathname === "/api/admin/posts" && body?.items) return json({ ...body, items: body.items.map(withHe) });
          if (url.pathname === "/api/admin/translations") {
            return json({
              ok: true,
              counts: { missing: 2, draft: 0, stale: 1, unverified: 0, translated: 1 },
              coverage: 50,
              items: [{ type: "post", id: "fixture-post", title: "A fixture note", route: "/blog/fixture-post", rank: 100, visibility: "public", status: "stale", units: [unit("title", "translated"), unit("subtitle", "missing"), unit("excerpt", "missing"), unit("body", "stale")] }],
            });
          }
          return json(body, status);
        });
        const page = await ctx.newPage();
        page.on("pageerror", (e) => problems.push(`${name}: ${e.message}`));
        await page.goto(`${base}/admin/posts/fixture-post`, { waitUntil: "load" });
        await page.waitForFunction(() => document.body.textContent?.includes("The English body changed"), null, { polling: 500, timeout: 20_000 });
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
