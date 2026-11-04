#!/usr/bin/env node
/*
 * The Translations page and the Hebrew pill (#302), in both themes at 1440
 * and 390, into docs/i18n/build/:
 *
 *   302-translations-*        the page, on the Missing tab
 *   302-translations-done-*   the Done tab with private items shown
 *   302-posts-*               the posts list with a pill per row
 *   302-project-field-*       a row's link: the project opened, its field focused
 *
 *   npm run build && xvfb-run -a node scripts/shoot-translations.mjs
 *
 * Under xvfb the browser is headed, which is what gives it a frame clock on
 * this box. Every wait polls on a timer (`{ polling: 500 }`), never on rAF,
 * and a capture is retried, since one sometimes waits on a frame that never
 * comes. The API is the a11y stub; the projects document is the backend seed.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./a11y/site-stub.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../docs/i18n/build");
mkdirSync(OUT, { recursive: true });

function seed() {
  const src = readFileSync(resolve(HERE, "../../backend/src/content/seed.ts"), "utf8");
  return JSON.parse(src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1));
}

const SHOTS = [
  ["302-translations", "/admin/translations", "table"],
  ["302-translations-done", "/admin/translations?status=done&visibility=all", "table"],
  ["302-posts", "/admin/posts", "table"],
  ["302-project-field", "/admin/projects?project=windom#field=fact", "#project-fact-he"],
];
const SIZES = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };
const ONLY = process.env.ONLY?.split(",");

const s = seed();
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: !process.env.DISPLAY, args: ["--no-sandbox"] });
const problems = [];

try {
  for (const [name, path, wait] of SHOTS.filter(([n]) => !ONLY || ONLY.includes(n))) {
    for (const theme of ["light", "dark"]) {
      for (const [w, viewport] of Object.entries(SIZES)) {
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
        await ctx.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
        await ctx.route("**/api/**", (route) => {
          const url = new URL(route.request().url());
          const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
          if (url.pathname === "/api/admin/content/projects") {
            return json({ ok: true, key: "projects", exists: true, _rev: "1-seed", published: s.projects, draft: null });
          }
          const { status, body } = answer(url.href, false);
          return json(body, status);
        });
        const page = await ctx.newPage();
        page.on("pageerror", (e) => problems.push(`${name}: ${e.message}`));
        await page.goto(base + path, { waitUntil: "load" });
        await page.waitForFunction((sel) => document.querySelector(sel) !== null, wait, { polling: 500, timeout: 20_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1500);
        if (wait.startsWith("#")) {
          const focused = await page.evaluate((sel) => document.activeElement === document.querySelector(sel), wait);
          if (!focused) problems.push(`${name}: ${wait} was not focused`);
        }
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
