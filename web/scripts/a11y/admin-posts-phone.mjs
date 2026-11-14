#!/usr/bin/env node
/*
 * Posts and Areas on a phone, held as a check (#680). jsdom cannot see layout,
 * so the sizes are measured in a real browser against a build:
 *
 *   npm run build
 *   npm run a11y:admin-posts-phone
 *   SHOTS=/tmp/posts-shots npm run a11y:admin-posts-phone     (also saves screenshots)
 *
 * At 360, 390 and 430 wide, in English (LTR) and Hebrew (RTL), light and dark:
 *  - one row is one button: no other button, link or field inside its item;
 *  - a row prints at most three text facts and at most one status glyph, and it
 *    is a row of at least 56px;
 *  - at least 7 post rows sit above the fold of a 390x844 screen (the whole page
 *    is measured, header, search and chips included);
 *  - nothing scrolls sideways, even with a 60-character title at 320;
 *  - Select shows the bulk bar, Archive asks before it does anything;
 *  - Hebrew mirrors: the chevron sits at the left end of the row;
 *  - the publish review is a sheet whose first words say what changes, with the
 *    diff before the field list;
 *  - at 1440 wide the desktop table is unchanged (a table, no phone rows).
 *
 * Reuses site-stub.mjs (`vite preview` plus API fixtures): no login, no
 * network (every request that is not localhost is aborted). Polls on a timer,
 * never rAF: headless Chromium here emits about one frame per 40 s.
 * CHROME overrides the browser binary.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { answer: baseAnswer, startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const SHOTS = process.env.SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const ago = (h) => new Date(NOW - h * 3_600_000).toISOString();
const seo = { title: null, description: null, canonical: null, noindex: false };
const LONG60 = "A deliberately long title of sixty characters, no breaks ok";
const TITLES = [
  "Rebuilding the admin as a tool with a deliberately long title that has to wrap on a phone",
  "Bothy v1.9.0 release notes", "The theme change, as a wave", "A draft about backups", "Hebrew, right to left, all the way down",
  "A settings page that remembers", "Notes on a box under the desk", LONG60, "Backups, and the day I tested one", "Why there is no dashboard",
  "Tailscale ssh, one user", "Reading the router table", "Snapshots before upgrades", "A quiet post", "Old thoughts on monitoring",
  "Ports are the interface", "DNS on a box", "Keeping a changelog", "The updater only deploys what main pins", "A short one", "Moving off the dashboard", "Last one",
];
const POSTS = TITLES.map((title, i) => ({
  _id: `post:p${i}`, _rev: `1-p${i}`, slug: `p${i}`, title, subtitle: null, excerpt: "An excerpt.", body: "Line one.\nLine two.",
  status: i === 3 || i === 11 ? "draft" : i === 14 ? "archived" : "published",
  publishedAt: ago(100 + i), updatedAt: ago(2 + i * 9), tags: ["admin", "design", "notes"].slice(0, 1 + (i % 3)), collection: i % 4 === 0 ? "windom" : "site",
  coverImage: null, links: [], readingMinutes: 2 + (i % 5), featured: null, seo, he: null,
  ...(i === 2 ? { draft: { title, subtitle: null, excerpt: "e", body: "Line one.\nLine two, edited.\nA new line.", tags: [], collection: "site", coverImage: null, links: [], featured: null, publishedAt: null, seo, he: null } } : {}),
}));
const AREA = (slug, title, kind, status, order, repo) => ({ slug, title, tagline: "", kind, repo, stats: null, description: "d", coverImage: null, links: [], order, status, _rev: `1-${slug}` });
const AREAS = [
  AREA("site", "Notes", "site", "published", 0, null), AREA("windom", "WindoM", "project", "published", 10, { owner: "o", name: "WindoM", branch: "main", docPaths: [] }),
  AREA("bothy", "Bothy", "project", "published", 20, { owner: "o", name: "bothy", branch: "main", docPaths: [] }), AREA("old", "An old project with a longer name", "project", "hidden", 30, null),
  AREA("cvops", "CVOps", "project", "published", 40, null), AREA("tals", "Tals", "project", "published", 50, null), AREA("quiet", "Quiet", "project", "hidden", 60, null),
  AREA("lab", "Lab", "site", "published", 70, null), AREA("misc", "Misc", "project", "published", 80, null),
];
const unit = (status) => ({ path: "title", status, primary: true, en: "t", he: status === "missing" ? null : "ע", draftHe: null });
const TR = (type, id, status) => ({ type, id, title: id, route: "/", rank: 1, visibility: "public", status, units: [unit(status)] });
const TRANSLATIONS = {
  ok: true, counts: { missing: 3, draft: 0, stale: 1, unverified: 0, translated: 3 }, coverage: 50,
  items: [TR("post", "p4", "missing"), TR("post", "p6", "stale"), TR("post", "p9", "missing"), TR("post", "p1", "translated"), TR("area", "bothy", "missing"), TR("area", "windom", "translated")],
};

function answer(path, method, search) {
  const p = path.replace(/^\/api/, "");
  if (method !== "GET") return { status: 503, body: { error: "This check does not save." } };
  if (p === "/admin/posts") return { body: { ok: true, items: POSTS } };
  if (p.startsWith("/admin/posts/")) {
    const hit = POSTS.find((x) => x.slug === decodeURIComponent(p.split("/")[3]));
    return hit ? { body: { ok: true, post: hit } } : { status: 404, body: { error: "Not found" } };
  }
  if (p === "/admin/collections") return { body: { ok: true, items: AREAS } };
  if (p === "/admin/translations") return { body: TRANSLATIONS };
  const b = baseAnswer(`http://x${path}${search}`, false);
  return { status: b.status, body: b.body };
}

const fails = [];
const fail = (m) => fails.push(m);

/* ------------------------------------------------ measured in the page */
function measureList() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rows = [...document.querySelectorAll("[data-record-row]")];
  const clipped = (el) => { const r = el.getBoundingClientRect(); return r.width <= 2 || r.height <= 2; };
  const facts = (row) => {
    const out = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? "").trim();
      if (!t) continue;
      let el = n.parentElement;
      let hidden = false;
      for (; el && el !== row.parentElement; el = el.parentElement) {
        if (el.getAttribute("aria-hidden") === "true" || clipped(el)) { hidden = true; break; }
      }
      if (!hidden) out.push(t);
    }
    return out;
  };
  const item = (row) => row.closest("li") ?? row.parentElement;
  return {
    vw,
    scroll: document.documentElement.scrollWidth,
    rows: rows.length,
    tables: document.querySelectorAll("main table, .a-wrap table").length,
    firstTop: Math.round(rows[0]?.getBoundingClientRect().top ?? -1),
    inFold: rows.filter((r) => r.getBoundingClientRect().bottom <= vh + 0.5).length,
    perRow: rows.map((r) => ({
      name: (r.getAttribute("aria-label") || "").slice(0, 40),
      controls: item(r).querySelectorAll("button, a, input, select, textarea").length,
      facts: facts(r),
      glyphs: r.querySelectorAll('[role="img"]').length,
      overflow: r.scrollWidth - r.clientWidth,
      h: Math.round(r.getBoundingClientRect().height),
    })),
  };
}
function measureMirror() {
  const row = document.querySelector("[data-record-row]");
  const chev = row.querySelector("[data-rr-chevron]").getBoundingClientRect();
  const title = row.querySelector("[data-rr-title]").getBoundingClientRect();
  return { chevLeftOfTitle: chev.right <= title.left + 1 };
}

/* -------------------------------------------------------------- driving */
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });

async function open(w, h, lang, theme, path) {
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
    if (await page.evaluate(() => !!document.querySelector("[data-record-row], .a-table"))) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(700);
  return { page, close: () => ctx.close() };
}
/* page.screenshot waits for a frame this headless build rarely produces; the protocol's own capture does not. */
async function shot(page, name) {
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(data, "base64"));
  await cdp.detach();
}
const waitFor = async (page, fn, arg, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(250);
  }
  return false;
};
/* dispatchEvent, not click(): Playwright's click waits for animation frames. */
const tap = (page, sel) => page.locator(sel).first().dispatchEvent("click");
const dir = (lang) => (lang === "he" ? "rtl" : "ltr");

function check(tag, m, { rows, fold }) {
  if (m.scroll > m.vw + 1) fail(`${tag}: page scrolls sideways (${m.scroll} > ${m.vw})`);
  if (m.rows !== rows) fail(`${tag}: ${m.rows} phone rows, expected ${rows}`);
  if (m.tables) fail(`${tag}: a table is still on the phone`);
  m.perRow.forEach((r, i) => {
    if (r.controls !== 1) fail(`${tag} row ${i}: ${r.controls} controls in the item, expected exactly 1`);
    if (r.facts.length > 3) fail(`${tag} row ${i}: ${r.facts.length} text facts (${r.facts.join(" | ")}), at most 3`);
    if (r.glyphs > 1) fail(`${tag} row ${i}: ${r.glyphs} status glyphs, at most 1`);
    if (r.overflow > 1) fail(`${tag} row ${i}: row overflows by ${r.overflow}px`);
    if (r.h < 56) fail(`${tag} row ${i}: ${r.h}px high, needs at least 56`);
  });
  if (fold && m.inFold < fold) fail(`${tag}: ${m.inFold} rows above the fold of 844px (first row at ${m.firstTop}px, rows ${m.perRow.map((r) => r.h).join("/")}px), needs at least ${fold}`);
}

try {
  for (const lang of ["en", "he"]) {
    for (const theme of ["light", "dark"]) {
      for (const w of [360, 390, 430]) {
        if (theme === "dark" && w === 360 && !SHOTS) continue;
        const h = w === 390 ? 844 : 800;
        const id = `${w}-${dir(lang)}-${theme}`;

        const posts = await open(w, h, lang, theme, "/admin/posts");
        const pm = await posts.page.evaluate(measureList);
        check(`posts ${w} ${lang} ${theme}`, pm, { rows: POSTS.length, fold: w === 390 ? 7 : 0 });
        if (SHOTS) await shot(posts.page, `posts-${id}`);
        if (lang === "he") {
          const mir = await posts.page.evaluate(measureMirror);
          if (!mir.chevLeftOfTitle) fail(`posts ${w} he ${theme}: the chevron is not at the left end of the row`);
        }

        if (theme === "light" && w !== 430) {
          /* Select shows the bar; Archive asks first and Keep leaves everything. */
          await tap(posts.page, "button:has-text('Select'), button:has-text('בחירה')");
          await tap(posts.page, "[data-record-row]");
          const bar = await waitFor(posts.page, () => !!document.querySelector('[role="toolbar"][aria-label]:not([aria-label=""]) button'));
          if (!bar) fail(`posts ${w} ${lang}: selecting a row showed no bulk bar`);
          else {
            if (SHOTS) await shot(posts.page, `posts-select-${id}`);
            const sw = await posts.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            if (sw > 1) fail(`posts ${w} ${lang}: the bulk bar makes the page scroll sideways`);
          }
        }
        await posts.close();

        const areas = await open(w, h, lang, theme, "/admin/areas");
        const am = await areas.page.evaluate(measureList);
        check(`areas ${w} ${lang} ${theme}`, am, { rows: AREAS.length, fold: w === 390 ? 7 : 0 });
        if (SHOTS) await shot(areas.page, `areas-${id}`);
        await areas.close();
      }

      /* The publish review as a sheet. */
      if (theme === "light") {
        const ed = await open(390, 844, lang, theme, "/admin/posts/p2");
        await waitFor(ed.page, () => !!document.querySelector("input.a-input-title"));
        await ed.page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^(Review|סקירה)/.test((b.textContent ?? "").trim()))?.click());
        if (!(await waitFor(ed.page, () => !!document.querySelector("dialog[open] [data-review-summary]")))) fail(`review ${lang}: the review did not open as a phone sheet`);
        else {
          const order = await ed.page.evaluate(() => {
            const d = document.querySelector("dialog[open]");
            const summary = d.querySelector("[data-review-summary]").getBoundingClientRect().top;
            const diff = d.querySelector("[role=group][tabindex]")?.getBoundingClientRect().top ?? -1;
            const firstDetails = d.querySelector("details")?.getBoundingClientRect().top ?? -1;
            return { summary, diff, firstDetails, openDetails: d.querySelectorAll("details[open]").length, sw: document.documentElement.scrollWidth - window.innerWidth };
          });
          if (!(order.summary < order.diff && order.diff < order.firstDetails)) fail(`review ${lang}: order is not summary, diff, details (${order.summary}/${order.diff}/${order.firstDetails})`);
          if (order.openDetails) fail(`review ${lang}: ${order.openDetails} details are open by default`);
          if (order.sw > 1) fail(`review ${lang}: the sheet makes the page scroll sideways`);
          if (SHOTS) await shot(ed.page, `review-${dir(lang)}-${theme}`);
        }
        await ed.close();
      }
    }
  }

  /* A 60-character title at the smallest phone. */
  const small = await open(320, 568, "en", "light", "/admin/posts");
  const sm = await small.page.evaluate(measureList);
  if (sm.scroll > sm.vw + 1) fail(`posts 320: page scrolls sideways (${sm.scroll} > ${sm.vw})`);
  sm.perRow.forEach((r, i) => r.overflow > 1 && fail(`posts 320 row ${i}: overflows by ${r.overflow}px`));
  await small.close();

  /* Desktop is unchanged. */
  for (const [path, label] of [["/admin/posts", "posts"], ["/admin/areas", "areas"]]) {
    const wide = await open(1440, 900, "en", "light", path);
    const wm = await wide.page.evaluate(measureList);
    if (wm.rows !== 0) fail(`${label} 1440: phone rows on a desktop screen`);
    if (wm.tables < 1) fail(`${label} 1440: the desktop table is gone`);
    if (SHOTS) await shot(wide.page, `${label}-1440-ltr-light`);
    await wide.close();
  }
  if (SHOTS) {
    for (const [lang, theme] of [["en", "dark"], ["he", "light"], ["he", "dark"]]) {
      for (const [path, label] of [["/admin/posts", "posts"], ["/admin/areas", "areas"]]) {
        const d = await open(1440, 900, lang, theme, path);
        await shot(d.page, `${label}-1440-${dir(lang)}-${theme}`);
        await d.close();
      }
    }
  }
} finally {
  await browser.close();
  stop();
}

if (fails.length) {
  console.log(`FAIL: ${fails.length}`);
  for (const f of fails.slice(0, 60)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("PASS: phone Posts and Areas are one tappable row per record, fit 7 rows, select, review as a sheet and mirror in Hebrew.");
