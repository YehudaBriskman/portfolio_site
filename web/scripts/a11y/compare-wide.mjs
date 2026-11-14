#!/usr/bin/env node
/*
 * "Tablet and desktop unchanged": the same pages from two builds, screenshot
 * for screenshot, at 1280 and 768 (above the phone breakpoint).
 *
 *   BASE_A=http://127.0.0.1:4999 BASE_B=http://127.0.0.1:4998 node scripts/a11y/compare-wide.mjs
 *
 * Prints the pages whose bytes differ (and writes both images under OUT).
 * ROUTES (comma list) picks the pages. Used by hand, once per direction-A PR; the build of `main` is any
 * `vite preview` of a checkout of it.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { handler } from "./projects-fixture.mjs";

const A = process.env.BASE_A;
const B = process.env.BASE_B;
const OUT = process.env.OUT ?? "wide";
const ROUTES = (process.env.ROUTES ?? "/projects,/projects/bothy,/projects/bothy?tab=releases,/projects/windom").split(",");
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
let diff = 0;
for (const width of [1280, 768]) {
  for (const lang of ["en", "he"]) {
    for (const route of ROUTES) {
      const sums = [];
      for (const [i, base] of [A, B].entries()) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", colorScheme: "light" });
        await ctx.addInitScript(() => localStorage.setItem("theme", "light"));
        await ctx.route("**/api/**", handler());
        const page = await ctx.newPage();
        await page.goto(base + (lang === "he" ? `/he${route}` : route), { waitUntil: "load" });
        await page.locator("footer").first().waitFor({ state: "attached" });
        await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
        await page.waitForTimeout(1500);
        const buf = await page.screenshot({ fullPage: true, timeout: 120000 });
        writeFileSync(`${OUT}/${width}-${lang}-${route.replace(/[/?=]/g, "_")}.${i ? "b" : "a"}.png`, buf);
        sums.push(createHash("sha1").update(buf).digest("hex"));
        await ctx.close();
      }
      const same = sums[0] === sums[1];
      if (!same) diff++;
      console.log(same ? "same  " : "DIFF  ", width, lang, route);
    }
  }
}
await browser.close();
process.exit(diff ? 1 : 0);
