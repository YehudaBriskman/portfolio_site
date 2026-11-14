#!/usr/bin/env node
/*
 * Screenshots of the blog list, a tag filter, an area and the reader on a
 * phone, for docs/design/public-blog-a/:
 *
 *   npm run build && OUT=../docs/design/public-blog-a/after npm run shoot:blog
 *
 * WIDTH (default 390), ROUTES (comma list), SCROLLS (reader scroll fractions
 * of the long post, default "0.35,0.7,1" -> `the-long-note.<lang>.<theme>.sN.png`),
 * CHROME override the defaults. Fixed waits, never rAF.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startPreview } from "./site-stub.mjs";
import { handler } from "./blog-fixture.mjs";

const OUT = process.env.OUT ?? "shots";
const WIDTH = Number(process.env.WIDTH ?? 390);
const ROUTES = (process.env.ROUTES ?? "/blog,/blog?view=feed&tag=process,/blog/area/bothy,/blog/merging-does-not-ship").split(",");
const SCROLLS = (process.env.SCROLLS ?? "0.35,0.7,1").split(",").map(Number);
mkdirSync(OUT, { recursive: true });
/* this headless Chromium sometimes refuses a capture: try again, with a pause */
const shot = async (page, opts) => {
  for (let i = 0; ; i++) {
    try {
      return await page.screenshot({ timeout: 120000, ...opts });
    } catch (e) {
      if (i >= 3) throw e;
      await page.waitForTimeout(1500);
    }
  }
};
const base = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
for (const lang of ["en", "he"]) {
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({
      viewport: { width: WIDTH, height: 844 },
      hasTouch: WIDTH < 640,
      isMobile: WIDTH < 640,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      colorScheme: theme,
      locale: lang === "he" ? "he-IL" : "en-US",
    });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("theme", t);
      } catch {
        /* blocked */
      }
    }, theme);
    await ctx.route("**/api/**", handler());
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      await page.goto(base.base + (lang === "he" ? `/he${route}` : route), { waitUntil: "load" });
      await page.locator("footer").first().waitFor({ state: "attached" });
      await page.waitForTimeout(1500);
      const name = route.replace(/[/?=&]/g, "-").replace(/^-/, "");
      await shot(page, { path: `${OUT}/${name}.${lang}.${theme}.full.png`, fullPage: true });
      await shot(page, { path: `${OUT}/${name}.${lang}.${theme}.view.png` });
      await page.close();
    }
    /* the long post at several scroll positions, one viewport each */
    const page = await ctx.newPage();
    await page.goto(base.base + (lang === "he" ? "/he" : "") + "/blog/the-long-note", { waitUntil: "load" });
    await page.locator("footer").first().waitFor({ state: "attached" });
    await page.waitForTimeout(1500);
    for (const [i, f] of SCROLLS.entries()) {
      await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), f);
      await page.waitForTimeout(700);
      await shot(page, { path: `${OUT}/the-long-note.${lang}.${theme}.s${i + 1}.png` });
    }
    await ctx.close();
  }
}
await browser.close();
base.stop();
