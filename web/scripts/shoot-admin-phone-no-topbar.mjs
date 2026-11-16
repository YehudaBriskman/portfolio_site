#!/usr/bin/env node
/*
 * The admin phone with no top bar (#896): screenshots plus the checks that hold it. For overview, a list,
 * an editor, settings and the marketing hub, at 360/390/430, en+he, light+dark, it fails when
 *   - a header.a-top or .a-crumbs is drawn,
 *   - the page has not exactly one h1, or the h1 is under the circle or the back pill,
 *   - any visible control or text in <main> overlaps the circle or the pill (clientRects),
 *   - the page scrolls sideways.
 * It also opens the circle's panel and fails unless search, notifications, view site, display and
 * sign out are in it.
 *
 *   npm run build && OUT=../docs/design/admin-phone-no-topbar node scripts/shoot-admin-phone-no-topbar.mjs
 * SHOTS_ON=0 skips the PNGs. WIDTHS=390 LANGS=en THEMES=light narrow the run. Polls on timers, never rAF.
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

const OUT = resolve(process.env.OUT ?? resolve(WEB, "../docs/design/admin-phone-no-topbar"));
const REDUCE = process.env.REDUCE === "1";
const SHOTS = process.env.SHOTS_ON !== "0";
if (SHOTS) mkdirSync(OUT, { recursive: true });
const list = (k, d) => (process.env[k] ? process.env[k].split(",") : d);
const WIDTHS = list("WIDTHS", ["360", "390", "430"]).map(Number);
const LANGS = list("LANGS", ["en", "he"]);
const THEMES = list("THEMES", ["light", "dark"]);
const SCREENS = [
  ["overview", "/admin"],
  ["posts", "/admin/posts"],
  ["editor", "/admin/posts/admin-redesign"],
  ["settings", "/admin/settings"],
  ["marketing", "/admin/marketing"],
];

const answer = (path, method, search) =>
  path.replace(/^\/api/, "") === "/admin/me" ? { body: { ok: true, login: "owner", email: null } } : baseAnswer(path, method, search);

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });
const fails = [];

async function ready(page) {
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? "") && m.querySelector("h1, button, a"); })) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

function measure() {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const floats = [...document.querySelectorAll("[data-floating-circle], [data-floating-pill]")].filter(vis).map((e) => ({ n: e.hasAttribute("data-floating-circle") ? "circle" : "pill", r: e.getBoundingClientRect() }));
  const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const over = [];
  const leaves = [...document.querySelectorAll("main a, main button, main input, main h1, main h2, main label, main p")].filter(vis);
  for (const e of leaves) {
    const r = e.getBoundingClientRect();
    if (r.top > 100) continue;
    for (const f of floats) if (hit(r, f.r)) over.push(`${f.n} x <${e.tagName.toLowerCase()}> ${(e.textContent ?? "").trim().slice(0, 24)}`);
  }
  /* The h1 is in the document (one), clipped to 1px, and named; the visible title is the aria-hidden pull title at rest-hidden. */
  const h1s = [...document.querySelectorAll("h1")];
  const pt = document.querySelector("[data-pull-title]");
  const circle = floats.find((f) => f.n === "circle");
  return {
    header: !!document.querySelector("header.a-top"), crumbs: !!document.querySelector(".a-crumbs"),
    h1: h1s.length, h1Name: (h1s[0]?.textContent ?? "").trim(), h1Size: h1s[0] ? Math.round(h1s[0].getBoundingClientRect().width) : null, docTitle: document.title,
    pull: pt ? { state: pt.dataset.state, opacity: getComputedStyle(pt).opacity, aria: pt.getAttribute("aria-hidden"), text: pt.textContent } : null,
    over, scroll: document.documentElement.scrollWidth - innerWidth, circle: circle ? { top: Math.round(circle.r.top), size: Math.round(circle.r.width), end: Math.round(innerWidth - circle.r.right), start: Math.round(circle.r.left) } : null,
  };
}

for (const lang of LANGS) for (const theme of THEMES) for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, reducedMotion: REDUCE ? "reduce" : "no-preference", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US", hasTouch: true, isMobile: true });
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
  for (const [name, path] of SCREENS) {
    const tag = `${name} ${w} ${lang} ${theme}`;
    await page.goto(`${base}${prefix}${path}`, { waitUntil: "load" });
    await ready(page);
    const m = await page.evaluate(measure);
    if (m.header || m.crumbs) fails.push(`${tag}: a top bar is drawn`);
    if (m.h1 !== 1) fails.push(`${tag}: ${m.h1} h1 in the document, wants 1`);
    else if (!m.h1Name || m.h1Size > 2) fails.push(`${tag}: h1 "${m.h1Name}" is ${m.h1Size}px wide (wants clipped to 1px, named)`);
    if (!m.docTitle) fails.push(`${tag}: empty document.title`);
    if (!m.pull || m.pull.state !== "rest" || Number(m.pull.opacity) !== 0 || m.pull.aria !== "true" || !m.pull.text) fails.push(`${tag}: pull title at rest is ${JSON.stringify(m.pull)}`);
    if (m.over.length) fails.push(`${tag}: overlaps ${m.over.join("; ")}`);
    if (m.scroll > 0) fails.push(`${tag}: scrolls sideways by ${m.scroll}px`);
    if (!m.circle || m.circle.size < 44) fails.push(`${tag}: circle missing or under 44px`);
    if (SHOTS && w !== 430) await page.screenshot({ path: `${OUT}/${name}-${w}-${lang}-${theme}.png`, timeout: 120000 });
    /* The pull: a real touch drag over CDP, polled on timers (no rAF, no animationend). */
    if (w !== 430 && ["overview", "posts", "settings"].includes(name)) {
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: Math.round(w / 2), y }] });
      const read = () => page.evaluate(() => { const e = document.querySelector("[data-pull-title]"); const c = document.querySelector("[data-floating-circle]").getBoundingClientRect(); const t = e.querySelector("span").getBoundingClientRect(); const first = document.querySelector("main").firstElementChild?.getBoundingClientRect(); return { pull: Number(e.style.getPropertyValue("--pull")), state: e.dataset.state, y: Math.round(e.getBoundingClientRect().bottom), tx: [Math.round(t.left), Math.round(t.right)], circle: [Math.round(c.left), Math.round(c.right)], vis: getComputedStyle(e).visibility, top: first ? Math.round(first.top) : null, sy: scrollY }; });
      const before = await read();
      await touch("touchStart", 300);
      const seen = [];
      for (const y of [310, 340, 400, 520, 700]) {
        await touch("touchMove", y);
        await page.waitForTimeout(120);
        const s = await read();
        seen.push(s);
        if (SHOTS && w === 390 && y === 340) await page.screenshot({ path: `${OUT}/pull-mid-${name}-${w}-${lang}-${theme}.png`, timeout: 120000 });
        if (SHOTS && w === 390 && y === 700) await page.screenshot({ path: `${OUT}/pull-full-${name}-${w}-${lang}-${theme}.png`, timeout: 120000 });
      }
      for (let i = 1; i < seen.length; i++) if (seen[i].pull < seen[i - 1].pull) fails.push(`${tag}: pull not monotonic ${seen.map((s) => s.pull)}`);
      const full = seen[seen.length - 1];
      /* Reduced motion: an opacity step, 0 or 1, no travel; otherwise proportional and damped. */
      if (REDUCE) { if (!seen.every((s) => s.pull === 0 || s.pull === 1) || full.pull !== 1) fails.push(`${tag}: reduced-motion pull is not a step ${seen.map((s) => s.pull)}`); }
      else if (!(seen[1].pull > 0 && seen[1].pull < full.pull && full.pull > 0.85 && full.pull <= 1)) fails.push(`${tag}: pull values ${seen.map((s) => s.pull)}`);
      if (full.state !== "pull" || full.vis !== "visible") fails.push(`${tag}: held title state ${full.state}/${full.vis}`);
      const overlapC = full.tx[0] < full.circle[1] && full.tx[1] > full.circle[0];
      if (overlapC) fails.push(`${tag}: pulled title ${full.tx} runs under the circle ${full.circle}`);
      if (full.top !== before.top) fails.push(`${tag}: content moved during the pull (${before.top} -> ${full.top})`);
      await touch("touchEnd");
      let after = await read();
      for (let i = 0; i < 40 && after.state !== "rest"; i++) { await page.waitForTimeout(500); after = await read(); }
      if (after.state !== "rest" || after.pull !== 0) fails.push(`${tag}: pull did not return to rest ${JSON.stringify(after)}`);
      if (after.top !== before.top || after.sy !== 0) fails.push(`${tag}: content jumped after release (${before.top} -> ${after.top}, scrollY ${after.sy})`);
      /* A drag that starts below the top is not ours. */
      await page.evaluate(() => scrollTo(0, 200));
      await page.waitForTimeout(300);
      const scrolled = await page.evaluate(() => scrollY);
      await touch("touchStart", 300); await touch("touchMove", 500); await page.waitForTimeout(150);
      const low = await read();
      await touch("touchEnd");
      if (scrolled > 0 && low.pull !== 0) fails.push(`${tag}: a drag below the top pulled the title (${low.pull})`);
      await page.evaluate(() => scrollTo(0, 0));
      await cdp.detach();
    }
  }
  if (w === 390) {
    const tag = `menu ${w} ${lang} ${theme}`;
    await page.goto(`${base}${prefix}/admin`, { waitUntil: "load" });
    await ready(page);
    await page.locator("button[data-floating-circle]").first().click({ force: true });
    await page.waitForTimeout(600);
    const panel = await page.evaluate(() => {
      const p = document.querySelector(".a-side[data-open]");
      const t = p?.innerText ?? "";
      return { nav: !!p?.querySelector("nav"), links: [...(p?.querySelectorAll("a[href^='http'], a[href='/oauth2/sign_out']") ?? [])].length, buttons: [...(p?.querySelectorAll("button") ?? [])].length, text: t.length };
    });
    if (!panel.nav || panel.links < 2 || panel.buttons < 4) fails.push(`${tag}: panel lacks nav/functions ${JSON.stringify(panel)}`);
    if (SHOTS) {
      await page.locator(".a-side[data-open]").evaluate((p) => { p.scrollTop = p.scrollHeight; });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/menu-foot-${w}-${lang}-${theme}.png`, timeout: 120000 });
    }
  }
  await ctx.close();
}
await browser.close();
stop();
if (fails.length) {
  console.error(`FAIL ${fails.length}\n${fails.join("\n")}`);
  process.exit(1);
}
console.log(`PASS: no top bar, one h1, nothing under the circle or pill, functions in the panel. Shots: ${SHOTS ? OUT : "off"}`);
