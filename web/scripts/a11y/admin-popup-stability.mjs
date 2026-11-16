#!/usr/bin/env node
/*
 * Opening a popup must not move the admin shell.
 *
 * The bug: a modal menu (Radix dropdown, via react-remove-scroll) sets
 * `overflow: hidden` on <body>. <html> already sets `overflow-x: clip`, so the
 * body's value is NOT handed to the viewport: body becomes a scroll container of
 * its own that never scrolls, the sticky top bar and sidebar re-anchor to it and
 * ride up by exactly the page's scrollY, and a classic scrollbar's width is
 * handed back to the page (everything shifts sideways). That is the owner's
 * "the whole site gets up some pixels" on the Overview Quick links menu.
 *
 * For every menu / dialog trigger on a handful of admin screens, with the page
 * scrolled and not, at 1280 and 390, English and Hebrew, light and dark, this
 * exits 1 when opening the popup changes the top bar, sidebar, main or app
 * rectangle (top, left, width), or window.scrollY, or the body/html scrollTop.
 * It also fails if the viewport scrollbar's gutter changes (client width).
 *
 *   npm run build && npm run a11y:admin-popup-stability
 *   WIDTHS=1280  LANGS=he  THEMES=dark  ROUTES=/admin  (narrow it down)
 * Waits poll on a timer, never rAF or animationend (headless Chromium here has ~1 rAF / 40 s).
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { answer, tint } from "./admin-fixtures.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const env = (n) => (process.env[n] ?? "").split(",").filter(Boolean);
const WIDTHS = (env("WIDTHS").length ? env("WIDTHS") : ["1280", "390"]).map(Number);
const LANGS = env("LANGS").length ? env("LANGS") : ["en", "he"];
const THEMES = env("THEMES").length ? env("THEMES") : ["light", "dark"];
const ROUTES = env("ROUTES").length ? env("ROUTES") : ["/admin", "/admin/posts"];
const TRIGGER = 'button[aria-haspopup="menu"], button[aria-haspopup="dialog"]';

/* ------------------------------------------------------ in-page measurement */
function shell() {
  const round = (n) => Math.round(n * 10) / 10;
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { top: round(r.top), left: round(r.left), width: round(r.width) };
  };
  const de = document.documentElement;
  return {
    scrollY: Math.round(scrollY),
    htmlTop: Math.round(de.scrollTop),
    bodyTop: Math.round(document.body.scrollTop),
    gutter: de.clientWidth,
    top: box("header.a-top"),
    side: box(".a-side"),
    main: box(".a-main"),
    app: box(".a-app"),
  };
}

const same = (a, b) => (a === null || b === null ? a === b : ["top", "left", "width"].every((k) => Math.abs(a[k] - b[k]) <= 0.6));

function diff(before, after) {
  const out = [];
  for (const k of ["scrollY", "htmlTop", "bodyTop", "gutter"]) if (before[k] !== after[k]) out.push(`${k} ${before[k]} -> ${after[k]}`);
  for (const k of ["top", "side", "main", "app"]) if (!same(before[k], after[k])) out.push(`${k} ${JSON.stringify(before[k])} -> ${JSON.stringify(after[k])}`);
  return out;
}

/* --------------------------------------------------------------------- run */
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });
const fails = [];
let checked = 0;

// Four contexts that cover every width, language and theme between them (FULL=1 runs all eight).
const combos = [];
for (const w of WIDTHS) for (const lang of LANGS) for (const theme of THEMES) combos.push([w, lang, theme]);
const picked = process.env.FULL ? combos : combos.filter(([w, lang, theme]) => (WIDTHS.indexOf(w) + LANGS.indexOf(lang) + THEMES.indexOf(theme)) % 2 === 0);
for (const [w, lang, theme] of picked) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 600 ? 640 : 700 }, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, theme);
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/api/images/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: tint });
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  const prefix = lang === "he" ? "/he" : "";
  for (const route of ROUTES) {
    await page.goto(`${base}${prefix}${route}`, { waitUntil: "load" });
    await page.waitForSelector(".a-main", { timeout: 20000 });
    await page.waitForTimeout(1200);
    const count = await page.locator(TRIGGER).count();
    for (const scrolled of [true, false]) {
      // the tall viewport case: a page that does not scroll at all
      await page.setViewportSize({ width: w, height: scrolled ? (w > 600 ? 640 : 700) : 3000 });
      for (let i = 0; i < count; i++) {
        const at = `${w}px ${lang} ${theme} ${route} ${scrolled ? "scrolled" : "short"} trigger#${i}`;
        const t = page.locator(TRIGGER).nth(i);
        if (!(await t.isVisible().catch(() => false))) continue;
        await page.evaluate((s) => scrollTo(0, s ? 400 : 0), scrolled);
        await page.waitForTimeout(500);
        // a real pointer click at the trigger's centre, never Playwright's scroll-into-view (that would move the page itself)
        const bb = await t.boundingBox();
        const vh = page.viewportSize().height;
        if (!bb || bb.y < 0 || bb.y + bb.height > vh || bb.x < 0) continue;
        const before = await page.evaluate(shell);
        await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
        await page.waitForTimeout(350);
        const open = await page.evaluate(() => !!document.querySelector('[role="menu"], [role="dialog"]:not([hidden])'));
        const after = await page.evaluate(shell);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
        if (!open) continue;
        checked++;
        const d = diff(before, after);
        if (d.length) fails.push(`${at}: ${d.join("; ")}`);
      }
    }
  }
  // the command palette
  await page.setViewportSize({ width: w, height: 640 });
  await page.goto(`${base}${prefix}/admin/posts`, { waitUntil: "load" });
  await page.waitForSelector(".a-main", { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => scrollTo(0, 400));
  await page.waitForTimeout(250);
  const before = await page.evaluate(shell);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(600);
  if (await page.evaluate(() => !!document.querySelector('[role="dialog"][open], [role="dialog"]'))) {
    checked++;
    const d = diff(before, await page.evaluate(shell));
    if (d.length) fails.push(`${w}px ${lang} ${theme} command palette: ${d.join("; ")}`);
  }
  await ctx.close();
}

await browser.close();
stop();
if (fails.length) {
  console.error(`admin popup stability: ${fails.length} failure(s) in ${checked} popups\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log(`admin popup stability: ${checked} popups, shell unmoved in every one`);
