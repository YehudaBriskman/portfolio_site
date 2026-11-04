#!/usr/bin/env node
/*
 * /projects, /he/projects and /he/story at 390 and 1440, before and after the
 * two new projects and the Hebrew (load-projects-story.mjs), into
 * docs/projects-hebrew/:
 *
 *   MODE=before xvfb-run -a node scripts/shoot-projects-hebrew.mjs
 *       the live site, as it is
 *   npm run build && MODE=after xvfb-run -a node scripts/shoot-projects-hebrew.mjs
 *       this build under `vite preview`, its /api/content bundle answered with
 *       what the loader would publish: the live bundle with the loader's merge
 *       applied to each document (the same function, not a copy). Every other
 *       /api call is passed through to the live site, read-only.
 *
 * Under xvfb the browser is headed, which is what gives it a frame clock on
 * this box. Every wait polls on a timer, motion is reduced, and a capture is
 * retried with a long timeout.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../docs/projects-hebrew");
const LIVE = "https://yehudabriskman.com";
const MODE = process.env.MODE === "after" ? "after" : "before";
mkdirSync(OUT, { recursive: true });

const SIZES = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };
const PAGES = [
  ["projects", "/projects"],
  ["he-projects", "/he/projects"],
  ["he-story", "/he/story"],
];

let base = LIVE;
let stop = () => {};
let content = null;
if (MODE === "after") {
  const { startPreview } = await import("./a11y/site-stub.mjs");
  ({ base, stop } = await startPreview());
  const loader = await import("../../backend/scripts/load-projects-story.mjs");
  const payload = loader.readPayload();
  const FIELD = { projects: "projects", story: "story", "site-copy": "siteCopy" };
  content = (live) => {
    const next = { ...live };
    for (const key of loader.KEYS) {
      next[FIELD[key]] = loader.mergeKey(key, live[FIELD[key]], payload, loader.libraryFromPayload(payload)).next;
    }
    return next;
  };
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: !process.env.DISPLAY, args: ["--no-sandbox"] });
const problems = [];
try {
  for (const [name, path] of PAGES) {
    for (const [w, viewport] of Object.entries(SIZES)) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
      await ctx.addInitScript(() => localStorage.setItem("yb-theme", "light"));
      if (content) {
        await ctx.route(`${base}/api/**`, async (route) => {
          const url = new URL(route.request().url());
          if (route.request().method() !== "GET") return route.abort();
          if (url.pathname === "/api/content") {
            const live = await route.fetch({ url: `${LIVE}/api/content` });
            return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(content(await live.json())) });
          }
          return route.fulfill({ response: await route.fetch({ url: `${LIVE}${url.pathname}${url.search}` }) });
        });
      }
      const page = await ctx.newPage();
      page.on("pageerror", (e) => problems.push(`${name} ${w}: ${e.message}`));
      await page.goto(`${base}${path}`, { waitUntil: "load", timeout: 120_000 });
      await page.waitForFunction(() => document.querySelector("h1") !== null, null, { polling: 500, timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready);
      /* Lazy pictures: walk the page once so each one is asked for. */
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(3000);
      for (let i = 0; ; i++) {
        try {
          await page.screenshot({ path: `${OUT}/${MODE}-${name}-${w}.png`, fullPage: true, timeout: 120_000 });
          break;
        } catch (e) {
          if (i >= 3) throw e;
        }
      }
      console.log("shot", MODE, name, w);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  stop();
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
}
