#!/usr/bin/env node
/*
 * Admin on a phone: the four layout faults the mobile audit found that axe
 * cannot see, held as a check. Run against a build (`npm run build` first):
 *
 *   npm run a11y:admin-phones
 *
 *  - /admin/projects: the "Order on the site" list (rows on a phone) never overflows the viewport
 *    (the row's controls stay on screen) at 320, 360, 375 and 390, in both
 *    reading directions;
 *  - the draft banner keeps its sentence at least 60% of the banner's width
 *    (the buttons drop under it instead of squeezing it);
 *  - links that are targets in their own right are 44px high and 24px wide:
 *    Overview "View all", the project preview link, the breadcrumb trail.
 *
 * Fixtures come from site-stub.mjs plus the one extra document this needs (the
 * projects content, with a draft). Polls on a timer, never rAF: headless
 * Chromium here emits about one frame per 40 s. CHROME overrides the binary.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { createServer } = require("vite");
const { answer: baseAnswer, startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const vite = await createServer({ root: WEB, logLevel: "error", resolve: { preserveSymlinks: true }, server: { middlewareMode: true }, appType: "custom" });
const { seedBundle } = await vite.ssrLoadModule("/src/content/convert.ts");
const SEED = seedBundle();
await vite.close();

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const ago = (h) => new Date(NOW - h * 3_600_000).toISOString();
/* A draft and a published copy: the banner is at its longest sentence. */
const PROJECTS = { ok: true, key: "projects", exists: true, _rev: "3-m", published: SEED.projects, draft: SEED.projects, updatedAt: ago(5), publishedAt: ago(30), source: "admin" };

function answer(path, method, search) {
  const p = path.replace(/^\/api/, "");
  if (method !== "GET") return { status: 503, body: { error: "This check does not save." } };
  if (p === "/admin/content/projects") return { body: PROJECTS };
  if (p === "/content") return { body: { ok: true, ...SEED } };
  const b = baseAnswer(`http://x${path}${search}`, false);
  return { status: b.status, body: b.body };
}

const PHONES = [320, 360, 375, 390];
const LANGS = ["en", "he"];
const fails = [];
const fail = (msg) => fails.push(msg);

/* Everything is measured in the page, in one pass per screen. */
function measureProjects() {
  const vw = window.innerWidth;
  const out = { scroll: document.documentElement.scrollWidth, vw, offscreen: [], banner: null, preview: null };
  /* The phone list is a section of rows; the desktop one a fieldset. */
  const list = document.getElementById("projects-list") ?? document.getElementById("projects-list-title")?.closest("section");
  if (list) {
    for (const el of list.querySelectorAll("li, li button, li a")) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.left < -1 || r.right > vw + 1)) out.offscreen.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24)}" ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
  }
  const p = [...document.querySelectorAll("main p")].find((x) => /A draft is waiting|טיוטה/.test(x.textContent ?? ""));
  const box = p?.closest(".a-box");
  if (p && box) out.banner = { p: p.getBoundingClientRect().width, box: box.getBoundingClientRect().width, h: p.getBoundingClientRect().height };
  const pv = [...document.querySelectorAll("main a")].find((a) => /\/projects\/[^/]+\?preview=1$/.test(a.getAttribute("href") ?? ""));
  if (pv) { const r = pv.getBoundingClientRect(); out.preview = { w: r.width, h: r.height }; }
  return out;
}
const sizeOf = ([sel, text]) => {
  const a = [...document.querySelectorAll(sel)].find((x) => !text || new RegExp(text).test((x.textContent ?? "").trim()));
  if (!a) return null;
  const r = a.getBoundingClientRect();
  return { w: r.width, h: r.height };
};

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });

async function open(w, h, lang, path, theme = "light") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, theme);
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.goto(`${base}${lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? ""); })) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
  return { page, close: () => ctx.close() };
}

const target = (tag, m) => {
  if (!m) return fail(`${tag}: not found`);
  if (m.h < 44 - 0.5 || m.w < 24) fail(`${tag}: ${Math.round(m.w)}x${Math.round(m.h)}, needs >= 24 wide and 44 high`);
};

try {
  for (const lang of LANGS) {
    for (const w of PHONES) {
      const { page, close } = await open(w, 800, lang, "/admin/projects");
      /* The preview link lives in the Details group, closed on a phone: open every group first. */
      await page.evaluate(() => document.querySelectorAll("[data-group] > h2 button[aria-expanded='false']").forEach((b) => b.click()));
      await page.waitForTimeout(200);
      const m = await page.evaluate(measureProjects);
      const tag = `projects ${w} ${lang}`;
      if (m.scroll > m.vw + 1) fail(`${tag}: page scrolls sideways (${m.scroll} > ${m.vw})`);
      if (m.offscreen.length) fail(`${tag}: off screen: ${m.offscreen.slice(0, 4).join(" | ")}`);
      if (!m.banner) fail(`${tag}: no draft banner`);
      else if (m.banner.p / m.banner.box < 0.6) fail(`${tag}: banner text is ${Math.round((100 * m.banner.p) / m.banner.box)}% of the banner (${Math.round(m.banner.p)}px, ${Math.round(m.banner.h)}px tall), needs >= 60%`);
      target(`${tag}: preview link`, m.preview);
      await close();
    }
    const o = await open(390, 844, lang, "/admin");
    target(`overview 390 ${lang}: View all`, await o.page.evaluate(sizeOf, ["main a.a-link", "View all|הכול"]));
    await o.close();
    /* The trail only shows its earlier crumbs from 768 up. */
    for (const w of [768, 1024]) {
      const c = await open(w, 900, lang, "/admin/posts/fixture-post");
      const links = await c.page.evaluate(() => [...document.querySelectorAll(".a-crumbs a")].map((a) => { const r = a.getBoundingClientRect(); return { w: r.width, h: r.height }; }));
      if (!links.length) fail(`crumbs ${w} ${lang}: no breadcrumb links`);
      links.forEach((m, i) => target(`crumb ${i} ${w} ${lang}`, m));
      await c.close();
    }
    const n = await open(390, 844, lang, "/admin/does-not-exist");
    target(`not-found 390 ${lang}: Home`, await n.page.evaluate(sizeOf, ["main a", "^(Home|דף הבית|בית)$"]));
    await n.close();
  }
} finally {
  await browser.close();
  stop();
}

if (fails.length) {
  console.log(`FAIL: ${fails.length}`);
  for (const f of fails) console.log(`  ${f}`);
  process.exit(1);
}
console.log("PASS: admin phones wrap, keep the banner readable and hold 44px link targets.");
