#!/usr/bin/env node
/*
 * "Before" shots of the CURRENT public screens at 390x844 (touch + mobile),
 * he + en, light + dark, from the built site and the audit fixtures.
 *   cd web && npm run build && xvfb-run -a node ../docs/design/public-mobile-direction/shoot-before.mjs
 * Polling is by hand: headless Chromium here has about one rAF per 40 s.
 */
import { chromium } from "../../../web/node_modules/playwright-core/index.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "../../../web/scripts/a11y/site-stub.mjs";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "before");
const SCREENS = [
  ["projects", "/projects"],
  ["project", "/projects/bothy"],
  ["blog", "/blog"],
  ["post", "/blog/fixture-post"],
  ["area", "/blog/area/bothy"],
  ["log", "/blog/log"],
];
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: !process.env.DISPLAY, args: ["--no-sandbox"] });
try {
  for (const theme of ["light", "dark"]) for (const lang of ["en", "he"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch {} }, theme);
    await ctx.route("**/api/**", (r) => {
      const { status, body } = answer(r.request().url(), false);
      return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });
    for (const [name, route] of SCREENS) {
      const page = await ctx.newPage();
      await page.goto(base + (lang === "he" ? "/he" : "") + route, { waitUntil: "load" });
      await page.waitForTimeout(2500);
      const f = `${OUT}/${name}-${lang}-${theme}`;
      await page.screenshot({ path: f + "-view.png", timeout: 120000, animations: "disabled" });
      await page.evaluate(() => { for (const el of document.querySelectorAll("*")) if (getComputedStyle(el).position === "fixed") { el.style.position = "absolute"; } });
      await page.screenshot({ path: f + "-full.png", fullPage: true, timeout: 120000, animations: "disabled" });
      console.log(f, await page.evaluate(() => document.documentElement.scrollHeight));
      await page.close();
    }
    await ctx.close();
  }
} finally { await browser.close(); await stop(); }
