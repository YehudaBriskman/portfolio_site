#!/usr/bin/env node
/*
 * The final contact sheet of the admin design programme (#878): every admin
 * screen at 1280 in English, light, and at 390 in Hebrew, dark. Same harness as
 * admin-desktop.mjs (built preview, fixtures, no network).
 *
 *   npm run build
 *   SHOTS=../docs/design/admin-final node scripts/a11y/shoot-admin-final.mjs
 *   ONLY=areas,posts
 *
 * Waits poll on a timer, never rAF (headless Chromium here has ~1 rAF / 40 s).
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { NOW, answer, tint } from "./admin-fixtures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const ONLY = (process.env.ONLY ?? "").split(",").filter(Boolean);
const OUT = resolve(process.env.SHOTS ?? "../docs/design/admin-final");
mkdirSync(OUT, { recursive: true });

/* [name, path] */
const SCREENS = [
  ["overview", "/admin"],
  ["posts", "/admin/posts"],
  ["post-editor", "/admin/posts/admin-redesign"],
  ["areas", "/admin/areas"],
  ["area-editor", "/admin/areas/bothy"],
  ["projects", "/admin/projects"],
  ["story", "/admin/story"],
  ["site-copy", "/admin/site-copy"],
  ["media", "/admin/media"],
  ["translations", "/admin/translations"],
  ["connections", "/admin/connections"],
  ["settings", "/admin/settings"],
  ["marketing-inbox", "/admin/marketing?tab=inbox"],
  ["marketing-audience", "/admin/marketing?tab=audience"],
  ["marketing-campaigns", "/admin/marketing?tab=campaigns"],
  ["marketing-library", "/admin/marketing?tab=library"],
  ["marketing-settings", "/admin/marketing?tab=settings"],
];

const SETS = [
  { w: 1280, h: 900, lang: "en", theme: "light", phone: false },
  { w: 390, h: 844, lang: "he", theme: "dark", phone: true },
];

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });
const fails = [];
let n = 0;
for (const s of SETS) {
  const ctx = await browser.newContext({
    viewport: { width: s.w, height: s.h },
    ...(s.phone ? { hasTouch: true, isMobile: true } : {}),
    reducedMotion: "reduce",
    colorScheme: s.theme,
    locale: s.lang === "he" ? "he-IL" : "en-US",
  });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, s.theme);
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
    const tag = `${name} ${s.w} ${s.theme} ${s.lang}`;
    try {
      await page.goto(`${base}${s.lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
      for (let i = 0; i < 40; i++) {
        const ok = await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? ""); });
        if (ok) break;
        await page.waitForTimeout(250);
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: resolve(OUT, `${name}-${s.w}-${s.theme}-${s.lang}.png`), timeout: 120000 });
      n++;
    } catch (e) { fails.push(`${tag}: ERROR ${e.message.split("\n")[0]}`); }
  }
  await ctx.close();
}
await browser.close();
stop();
if (fails.length) { console.log(`FAIL: ${fails.length}`); for (const f of fails) console.log(" ", f); process.exit(1); }
console.log(`PASS: ${n} shots in ${OUT}.`);
