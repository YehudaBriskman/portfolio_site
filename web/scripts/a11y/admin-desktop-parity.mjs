#!/usr/bin/env node
/*
 * The admin at 768 and 1280 is untouched by the phone shell (#896).
 *
 * At 1280 and 768, en + he, light + dark, on overview, posts and settings it fails when
 *   - the top bar (header.a-top) or its breadcrumb is missing, or the PageHeader's h1 is not visible,
 *   - a pull title is in the DOM, or any touchstart / touchmove / scroll listener was added to window by the shell.
 * It also writes <OUT>/parity.json (bounding rects of the top bar, the h1, the first PageHeader and main, and a
 * hash of the header's markup) and, with SHOTS=1, a screenshot per case. Run it on a build of origin/main and on
 * this branch with the same OUT layout and compare the two folders: the rects and the hashes must be identical.
 *
 *   npm run build && npm run a11y:admin-desktop-parity
 *   OUT=/tmp/after SHOTS=1 node scripts/a11y/admin-desktop-parity.mjs
 * Waits poll on timers, never rAF.
 */
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { NOW, answer as baseAnswer, tint } from "./admin-fixtures.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const OUT = process.env.OUT ? resolve(process.env.OUT) : "";
const SHOTS = process.env.SHOTS === "1" && OUT;
if (OUT) mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const SCREENS = [["overview", "/admin"], ["posts", "/admin/posts"], ["settings", "/admin/settings"]].filter(([n]) => !ONLY || ONLY.includes(n));
const answer = (path, method, search) =>
  path.replace(/^\/api/, "") === "/admin/me" ? { body: { ok: true, login: "owner", email: null } } : baseAnswer(path, method, search);

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });
const fails = [];
const record = {};

async function ready(page) {
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? "") && m.querySelector("h1"); })) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

for (const lang of ["en", "he"]) for (const theme of ["light", "dark"]) for (const w of [1280, 768]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ }
    const add = window.addEventListener.bind(window);
    window.__pullListeners = [];
    window.addEventListener = (type, ...rest) => { if (["touchstart", "touchmove", "touchend", "touchcancel"].includes(type)) window.__pullListeners.push(type); return add(type, ...rest); };
  }, theme);
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
    const tag = `${name} ${w} ${lang} ${theme}`;
    if (process.env.DEBUG) console.error(`> ${tag}`);
    await page.goto(`${base}${lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
    await ready(page);
    if (process.env.DEBUG) console.error(`  ready ${tag}`);
    const m = await page.evaluate(() => {
      const rect = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((n) => Math.round(n * 100) / 100); };
      const top = document.querySelector("header.a-top");
      const h1 = document.querySelector("main h1");
      const head = document.querySelector("main header");
      const vis = h1 ? getComputedStyle(h1) : null;
      return {
        top: rect(top), crumbs: !!document.querySelector(".a-crumbs"), h1: rect(h1), h1Visible: !!h1 && h1.getBoundingClientRect().width > 8 && vis.clip === "auto" && vis.clipPath === "none",
        head: rect(head), main: rect(document.querySelector("main")), pullNode: !!document.querySelector("[data-pull-title]"), listeners: window.__pullListeners.length,
        markup: top ? top.outerHTML : "", scrollW: document.documentElement.scrollWidth,
      };
    });
    if (!m.top || !m.crumbs) fails.push(`${tag}: the top bar is gone`);
    if (!m.h1Visible) fails.push(`${tag}: the page h1 is hidden`);
    if (m.pullNode) fails.push(`${tag}: a pull title is in the DOM`);
    if (m.listeners) fails.push(`${tag}: ${m.listeners} touch listener(s) on window`);
    record[tag] = { top: m.top, h1: m.h1, head: m.head, main: m.main, scrollW: m.scrollW, topMarkup: createHash("sha256").update(m.markup).digest("hex").slice(0, 16) };
    if (SHOTS && name === "overview") await page.screenshot({ path: `${OUT}/${name}-${w}-${lang}-${theme}.png`, timeout: 120000 });
  }
  /* A window resized across 600px switches cleanly, with no leftover node (checked once, at 768). */
  if (w === 768 && lang === "en" && theme === "light") {
    const state = () => page.evaluate(() => ({ bar: !!document.querySelector("header.a-top"), pull: !!document.querySelector("[data-pull-title]") }));
    /* Poll by hand: the media-query change reaches React on a task, and this browser has almost no frames. */
    const until = async (want) => { let s = await state(); for (let i = 0; i < 60 && (s.bar !== want.bar || s.pull !== want.pull); i++) { await page.waitForTimeout(500); s = await state(); } return s; };
    await page.setViewportSize({ width: 390, height: 844 });
    const phone = await until({ bar: false, pull: true });
    if (phone.bar || !phone.pull) fails.push(`resize 768 -> 390: ${JSON.stringify(phone)}`);
    await page.setViewportSize({ width: 768, height: 900 });
    const back = await until({ bar: true, pull: false });
    if (!back.bar || back.pull) fails.push(`resize 390 -> 768: ${JSON.stringify(back)}`);
  }
  await ctx.close();
}
await browser.close();
stop();
if (OUT) writeFileSync(`${OUT}/parity.json`, JSON.stringify(record, null, 1));
if (fails.length) {
  console.error(`FAIL ${fails.length}\n${fails.join("\n")}`);
  process.exit(1);
}
console.log("PASS: at 768 and 1280 the top bar, the PageHeader h1 and the layout are as before; no pull title, no touch listeners.");
