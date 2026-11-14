#!/usr/bin/env node
/*
 * Before/after sheet for the phone nav merge (#780): px from the top of the
 * window to the first h1, and a screenshot, for ten pages at 390x844, he and
 * en, light and dark. Against the built site (`npm run build` first).
 *
 *   node scripts/a11y/public-nav-shots.mjs <outDir> <tag>   e.g. before | after
 *
 * Screenshots go through CDP Page.captureScreenshot: Playwright's own
 * screenshot waits for a frame, and headless Chromium here has no frame clock.
 * Writes <outDir>/<tag>-<lang>-<theme>-<page>.png and <outDir>/<tag>.json.
 * WIDTH=1280 HEIGHT=800 shoots the desktop pages instead (the pixel-identity
 * check compares two such runs byte for byte).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./site-stub.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(resolve(WEB, "package.json"))("playwright-core");
const [outDir = "shots", tag = "after"] = process.argv.slice(2);
const W = Number(process.env.WIDTH || 390);
const H = Number(process.env.HEIGHT || 844);
const phone = W < 640;
mkdirSync(outDir, { recursive: true });

const PAGES = [
  ["blog", "/blog"],
  ["area", "/blog/area/bothy"],
  ["projects", "/projects"],
  ["project", "/projects/bothy"],
  ["post", "/blog/fixture-post"],
  ["story", "/story"],
  ["follow", "/follow"],
  ["help", "/help"],
  ["accessibility", "/accessibility"],
  ["mcp", "/developers/mcp"],
];
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const table = {};
const jobs = [];
const langs = phone ? [false, true] : [false];
const themes = phone ? [false, true] : [false];
for (const he of langs) for (const dark of themes) for (const [name, route] of PAGES) jobs.push({ he, dark, name, route });
const queue = [...jobs];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      const ctx = await browser.newContext({
        viewport: { width: W, height: H },
        hasTouch: phone,
        isMobile: phone,
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        colorScheme: j.dark ? "dark" : "light",
      });
      await ctx.addInitScript((t) => {
        try { localStorage.setItem("yb-theme", t); } catch {}
      }, j.dark ? "dark" : "light");
      await ctx.route(/\/api\//, async (r) => {
        const a = answer(r.request().url());
        await r.fulfill({ status: a.status ?? 200, contentType: "application/json", body: typeof a.body === "string" ? a.body : JSON.stringify(a.body ?? a) });
      });
      const page = await ctx.newPage();
      await page.goto(base + (j.he ? `/he${j.route}` : j.route), { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("h1") !== null, null, { polling: 500, timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
      await page.waitForTimeout(1500);
      const top = await page.evaluate(() => {
        const h = [...document.querySelectorAll("h1")].find((e) => e.getBoundingClientRect().height > 0 && !e.closest("[aria-hidden='true']"));
        return h ? Math.round(h.getBoundingClientRect().top * 10) / 10 : null;
      });
      table[`${j.he ? "he" : "en"} ${j.dark ? "dark" : "light"} ${j.name}`] = top;
      const cdp = await ctx.newCDPSession(page);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(resolve(outDir, `${tag}-${j.he ? "he" : "en"}-${j.dark ? "dark" : "light"}-${j.name}.png`), Buffer.from(data, "base64"));
      await ctx.close();
    }
  }),
);
writeFileSync(resolve(outDir, `${tag}.json`), JSON.stringify(table, null, 1));
console.log(JSON.stringify(table));
await browser.close();
stop();
