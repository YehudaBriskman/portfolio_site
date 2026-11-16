#!/usr/bin/env node
/*
 * Phone screenshots for the F3 polish batch (#864): the Overview, Areas and
 * Marketing Inbox at 390 (the New menu sheet is shoot-new-menu-sheet.mjs).
 * Same harness as admin-desktop.mjs (built preview, fixtures, no network).
 *
 *   npm run build
 *   SHOTS=../docs/design/admin-f3 node scripts/a11y/shoot-admin-f3.mjs
 *   LANGS=en THEMES=light  ONLY=areas
 *
 * Waits poll on a timer, never rAF (headless Chromium here has ~1 rAF / 40 s);
 * the same rule as the other a11y scripts.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { NOW, answer, tint } from "./admin-fixtures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const env = (n) => (process.env[n] ?? "").split(",").filter(Boolean);
const LANGS = env("LANGS").length ? env("LANGS") : ["en", "he"];
const THEMES = env("THEMES").length ? env("THEMES") : ["light", "dark"];
const ONLY = env("ONLY");
const OUT = process.env.SHOTS ? resolve(process.env.SHOTS) : null;

/* [name, path] */
const SCREENS = [
  ["overview", "/admin"],
  ["areas", "/admin/areas"],
  ["marketing-inbox", "/admin/marketing"],
];

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });
const fails = [];
let n = 0;
for (const lang of LANGS) for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
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
  for (const [name, path] of SCREENS) {
    if (ONLY.length && !ONLY.some((o) => name.startsWith(o))) continue;
    const tag = `${name} 390 ${theme} ${lang}`;
    try {
      await page.goto(`${base}${lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
      for (let i = 0; i < 40; i++) { const ok = await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? ""); }); if (ok) break; await page.waitForTimeout(250); }
      await page.evaluate(() => document.fonts.ready);
      if (OUT) await page.screenshot({ path: resolve(OUT, `${name}-390-${theme}-${lang}.png`), timeout: 120000 });
      n++;
    } catch (e) { fails.push(`${tag}: ERROR ${e.message.split("\n")[0]}`); }
  }
  await ctx.close();
}
await browser.close();
stop();
if (fails.length) { console.log(`FAIL: ${fails.length}`); for (const f of fails) console.log(" ", f); process.exit(1); }
console.log(`PASS: ${n} phone shots.`);
