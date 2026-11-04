#!/usr/bin/env node
/*
 * The hero plate in its column, and the Hebrew search placeholder, at 390px
 * in both themes, into docs/hero-fit-shots/:
 *
 *   <label>-home-en-*     /       the plate, English
 *   <label>-home-he-*     /he     the plate, Hebrew (the fact line was clipped)
 *   <label>-blog-he-*     /he/blog  the notes search, empty
 *
 *   npm run build && LABEL=after xvfb-run -a node scripts/shoot-hero-fit.mjs
 *
 * LABEL names the set (`before` was shot from a build of v1.2.0's main).
 * Reduced motion, so the arrival is not caught mid-flight; every wait polls
 * on a timer, never on rAF, which this box's headless Chromium barely runs.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./a11y/site-stub.mjs";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/hero-fit-shots");
mkdirSync(OUT, { recursive: true });
const LABEL = process.env.LABEL ?? "after";

/* [name, path, selector to wait for, selector to bring into view] */
const SHOTS = [
  ["home-en", "/", "#hero h1", null],
  ["home-he", "/he", "#hero h1", null],
  ["blog-he", "/he/blog", "main textarea[placeholder]", "main textarea[placeholder]"],
];

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: !process.env.DISPLAY, args: ["--no-sandbox"] });
try {
  for (const [name, path, ready, into] of SHOTS) {
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: theme });
      await ctx.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
      await ctx.route("**/api/**", (route) => {
        const { status, body } = answer(route.request().url(), false);
        return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      });
      const page = await ctx.newPage();
      await page.goto(base + path, { waitUntil: "load" });
      await page.waitForFunction((s) => document.querySelector(s), ready, { polling: 500, timeout: 20_000 });
      await page.evaluate(() => document.fonts.ready);
      if (into) await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "center" }), into);
      await page.waitForTimeout(1200);
      for (let i = 0; ; i++) {
        try {
          await page.screenshot({ path: `${OUT}/${LABEL}-${name}-${theme}-390.png`, timeout: 45_000 });
          break;
        } catch (e) {
          if (i >= 3) throw e;
        }
      }
      console.log("shot", LABEL, name, theme);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  stop();
}
