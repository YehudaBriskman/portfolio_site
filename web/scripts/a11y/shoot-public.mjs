#!/usr/bin/env node
/*
 * Screenshots of any public routes on a phone, for the before/after
 * folders of docs/design/public-<name>-a/:
 *
 *   npm run build && OUT=../docs/design/public-<name>-a/after npm run shoot:public
 *
 * WIDTH (default 390), ROUTES (comma list), CHROME override the defaults.
 * Fixed waits, never rAF: headless Chromium here emits about one frame per 40 s.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startPreview } from "./site-stub.mjs";
import { handler } from "./projects-fixture.mjs";

const OUT = process.env.OUT ?? "shots";
const WIDTH = Number(process.env.WIDTH ?? 390);
const ROUTES = (process.env.ROUTES ?? "/").split(",");
mkdirSync(OUT, { recursive: true });
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
      await page.waitForTimeout(1200);
      const name = route.replace(/[/?=]/g, "-").replace(/^-/, "");
      await page.screenshot({ path: `${OUT}/${name}.${lang}.${theme}.full.png`, fullPage: true, timeout: 120000 });
      await page.screenshot({ path: `${OUT}/${name}.${lang}.${theme}.view.png`, timeout: 120000 });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
base.stop();
