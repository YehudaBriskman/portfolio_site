#!/usr/bin/env node
/*
 * Before/after screenshots for the admin nav v2 (#886): the phone's menu circle and back pill, the
 * sidebar expanded (guide lines, icon weight) and collapsed. Final states only, motion reduced.
 *
 *   npm run build && OUT=../docs/design/admin-nav-v2 TAG=after node scripts/shoot-admin-nav-v2.mjs
 * Run it the same way in a build of origin/main with TAG=before. Polls on timers, never rAF.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { NOW, answer as baseAnswer, tint } from "./a11y/admin-fixtures.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const OUT = resolve(process.env.OUT ?? resolve(WEB, "../docs/design/admin-nav-v2"));
const TAG = process.env.TAG ?? "after";
mkdirSync(OUT, { recursive: true });

const answer = (path, method, search) =>
  path.replace(/^\/api/, "") === "/admin/me" ? { body: { ok: true, login: "owner", email: null } } : baseAnswer(path, method, search);

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });

async function ready(page, sel) {
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate((s) => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? "") && !!document.querySelector(s); }, sel)) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

for (const lang of ["en", "he"]) for (const theme of ["light", "dark"]) {
  for (const w of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 800 }, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US", hasTouch: w === 390, isMobile: w === 390 });
    await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, theme);
    await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
    await ctx.route("**/api/**", (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith("/api/images/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: tint });
      const a = answer(u.pathname, route.request().method(), u.search);
      return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
    });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(NOW));
    const prefix = lang === "he" ? "/he" : "";
    const name = (s) => `${OUT}/${TAG}-${w}-${s}-${lang}-${theme}.png`;
    if (w === 390) {
      await page.goto(`${base}${prefix}/admin/posts/admin-redesign`, { waitUntil: "load" });
      await ready(page, ".a-crumbs");
      await page.screenshot({ path: name("editor-back"), timeout: 120000 });
      await page.goto(`${base}${prefix}/admin/posts`, { waitUntil: "load" });
      await ready(page, ".a-crumbs");
      await page.screenshot({ path: name("closed"), timeout: 120000 });
      await page.locator("header button[aria-controls]").first().click({ force: true });
      await page.waitForTimeout(800);
      await page.screenshot({ path: name("menu-open"), timeout: 120000 });
    } else {
      await page.goto(`${base}${prefix}/admin/marketing?tab=audience`, { waitUntil: "load" });
      await ready(page, ".a-side-nav a");
      await page.screenshot({ path: name("expanded"), timeout: 120000 });
      await page.getByRole("button", { name: /^(Collapse sidebar|כווץ סרגל צד)/ }).last().click({ force: true });
      await page.waitForFunction(() => document.querySelector(".a-app")?.getAttribute("data-side") === "rail", null, { polling: 500, timeout: 20000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: name("collapsed"), timeout: 120000 });
    }
    await ctx.close();
  }
}
await browser.close();
stop();
console.log(`wrote ${TAG} shots to ${OUT}`);
