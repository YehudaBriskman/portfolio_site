#!/usr/bin/env node
/*
 * The content editors on a phone (#683): /admin/projects, /admin/story and
 * /admin/site-copy. jsdom cannot see layout, so it is measured in a real
 * browser against a build:
 *
 *   npm run build
 *   npm run a11y:admin-editors-phone
 *   SHOTS=/tmp/editors-shots npm run a11y:admin-editors-phone   (also saves screenshots)
 *   REPORT=1 ...                                                (prints the density numbers)
 *
 * At 360, 390 and 430 wide, in English (LTR) and Hebrew (RTL), light and dark:
 *  - the page never scrolls sideways, collapsed or with every group open;
 *  - projects: one tappable row per project, no other control in its item; the
 *    page is at most 4 viewport heights (390x844) with the groups collapsed;
 *    the first screen shows the project list AND the first group (Basics);
 *    Basics is open and the other groups are closed; the language switch has
 *    two radios; Reorder opens move and remove, 44px each;
 *  - the save bar is one row (60px, 64 at most) and clears the screen's end;
 *  - story and site copy collapse to at most 4 viewport heights;
 *  - at 1440 wide nothing changed: no language switch, no Reorder button, the
 *    four desktop sections and both language inputs side by side.
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
const { createServer } = require("vite");
const { answer: baseAnswer, startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const SHOTS = process.env.SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const vite = await createServer({ root: WEB, logLevel: "error", resolve: { preserveSymlinks: true }, server: { middlewareMode: true }, appType: "custom" });
const { seedBundle } = await vite.ssrLoadModule("/src/content/convert.ts");
const SEED = seedBundle();
await vite.close();

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const ago = (h) => new Date(NOW - h * 3_600_000).toISOString();
const view = (key, published, draft = null, h = 30) => ({ ok: true, key, exists: true, _rev: "3-m", published, draft, updatedAt: ago(h), publishedAt: ago(h + 20), source: "admin" });
const CONTENT = { projects: view("projects", SEED.projects, SEED.projects, 5), story: view("story", SEED.story, null, 70), "site-copy": view("site-copy", SEED.siteCopy, null, 140) };

function answer(path, method, search) {
  const p = path.replace(/^\/api/, "");
  if (method !== "GET") return { status: 503, body: { error: "This check does not save." } };
  if (p.startsWith("/admin/content/")) { const v = CONTENT[p.split("/")[3]]; return v ? { body: v } : { status: 404, body: {} }; }
  if (p === "/content") return { body: { ok: true, ...SEED } };
  const b = baseAnswer(`http://x${path}${search}`, false);
  return { status: b.status, body: b.body };
}

const fails = [];
const fail = (m) => fails.push(m);
const report = [];

function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const rows = [...document.querySelectorAll("[data-record-row]")];
  const groups = [...document.querySelectorAll("[data-group] > h2 button[aria-expanded]")];
  const bar = document.querySelector(".a-bottom .a-bar-row");
  const basics = groups[0];
  return {
    vw,
    vh,
    scroll: doc.scrollWidth,
    vhs: +(doc.scrollHeight / vh).toFixed(2),
    rows: rows.length,
    rowButtons: rows.map((r) => (r.closest("li") ?? r.parentElement).querySelectorAll("button, a, input, select, textarea").length),
    rowsInFold: rows.filter((r) => r.getBoundingClientRect().bottom <= vh + 0.5).length,
    groups: groups.map((g) => ({ name: g.textContent.trim(), open: g.getAttribute("aria-expanded") })),
    basicsTop: basics ? Math.round(basics.getBoundingClientRect().top) : -1,
    /* The group's header sits fully above the fixed save bar. */
    basicsInFold: basics ? basics.getBoundingClientRect().bottom <= vh - (bar ? bar.getBoundingClientRect().height + 1 : 0) : false,
    switchRadios: document.querySelectorAll('[role="radiogroup"] input[type="radio"]').length,
    reorderBtn: !!([...document.querySelectorAll("main button[aria-pressed]")].length),
    bar: bar ? Math.round(bar.getBoundingClientRect().height) : -1,
    sections: document.querySelectorAll("section.a-section").length,
    pairs: document.querySelectorAll("[lang='he']:is(input,textarea)").length,
    enInputs: document.querySelectorAll("[lang='en']:is(input,textarea)").length,
  };
}

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
    if (await page.evaluate(() => !!document.querySelector("form input, form textarea"))) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
  return { page, close: () => ctx.close() };
}
/* page.screenshot waits for a frame this headless build rarely produces; the protocol's own capture does not. */
async function shot(page, name, full = false) {
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
  writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(data, "base64"));
  await cdp.detach();
}
const openAll = (page) =>
  page.evaluate(() => {
    for (const b of document.querySelectorAll("[data-group] > h2 button[aria-expanded='false']")) b.click();
  });

const PAGES = [
  ["projects", "/admin/projects"],
  ["story", "/admin/story"],
  ["site-copy", "/admin/site-copy"],
];

try {
  for (const lang of ["en", "he"]) {
    for (const theme of ["light", "dark"]) {
      for (const w of [360, 390, 430]) {
        if (theme === "dark" && w !== 390 && !SHOTS) continue;
        const h = w === 390 ? 844 : 800;
        const dir = lang === "he" ? "rtl" : "ltr";
        for (const [name, path] of PAGES) {
          const tag = `${name} ${w} ${lang} ${theme}`;
          const { page, close } = await open(w, h, lang, theme, path);
          const m = await page.evaluate(measure);
          if (m.scroll > m.vw + 1) fail(`${tag}: page scrolls sideways (${m.scroll} > ${m.vw})`);
          if (m.vhs > 4) fail(`${tag}: ${m.vhs} viewport heights collapsed, at most 4`);
          if (m.groups.length < 3) fail(`${tag}: ${m.groups.length} groups, expected at least 3`);
          if (m.groups[0]?.open !== "true") fail(`${tag}: the first group is not open`);
          if (m.groups.slice(1).some((g) => g.open !== "false")) fail(`${tag}: a later group starts open`);
          if (m.switchRadios !== 2) fail(`${tag}: ${m.switchRadios} language radios, expected 2`);
          if (m.pairs !== 0) fail(`${tag}: both languages are mounted at once`);
          if (m.bar < 0 || m.bar > 64) fail(`${tag}: save bar is ${m.bar}px high, expected one row of at most 64`);
          if (name === "projects") {
            if (m.rows < 4) fail(`${tag}: ${m.rows} project rows`);
            if (m.rowButtons.some((n) => n !== 1)) fail(`${tag}: a project row holds ${m.rowButtons.join("/")} controls, expected exactly 1`);
            if (w === 390 && (m.rowsInFold < 4 || !m.basicsInFold)) fail(`${tag}: the first screen shows ${m.rowsInFold} rows and ${m.basicsInFold ? "the" : "NOT the"} first group (Basics header at ${m.basicsTop}px of ${m.vh})`);
          }
          if (w === 390 && theme === "light") report.push(`${name} ${lang}: ${m.vhs} viewport heights collapsed, ${m.rowsInFold} rows in the first screen, Basics at ${m.basicsTop}px`);
          if (SHOTS) await shot(page, `${name}-${w}-${dir}-${theme}-collapsed`);

          /* Every group open: still no sideways scroll, and the full page is shot. */
          await openAll(page);
          await page.waitForTimeout(150);
          const all = await page.evaluate(measure);
          if (all.scroll > all.vw + 1) fail(`${tag} (all open): page scrolls sideways (${all.scroll} > ${all.vw})`);
          if (SHOTS && w === 390) await shot(page, `${name}-${w}-${dir}-${theme}-open`, true);

          if (name === "projects" && theme === "light" && w !== 430) {
            /* Reorder mode: three 44px buttons per row, and nothing sideways. */
            await page.evaluate(() => document.querySelector("main button[aria-pressed]")?.click());
            await page.waitForTimeout(150);
            const r = await page.evaluate(() => {
              const btns = [...document.querySelectorAll("li[data-i] button")];
              return { n: btns.length, small: btns.filter((b) => { const x = b.getBoundingClientRect(); return x.width < 43.5 || x.height < 43.5; }).length, scroll: document.documentElement.scrollWidth - window.innerWidth };
            });
            if (r.n < 15) fail(`${tag}: Reorder shows ${r.n} buttons, expected 3 per project`);
            if (r.small) fail(`${tag}: ${r.small} Reorder buttons under 44px`);
            if (r.scroll > 1) fail(`${tag}: Reorder mode scrolls sideways`);
            if (SHOTS) await shot(page, `${name}-${w}-${dir}-${theme}-reorder`);
          }
          await close();
        }
      }
    }
  }

  /* A 320 phone: nothing clips. */
  for (const [name, path] of PAGES) {
    const s = await open(320, 568, "en", "light", path);
    await openAll(s.page);
    const m = await s.page.evaluate(measure);
    if (m.scroll > m.vw + 1) fail(`${name} 320: page scrolls sideways (${m.scroll} > ${m.vw})`);
    await s.close();
  }

  /* Desktop is unchanged. */
  for (const [name, path] of PAGES) {
    const d = await open(1440, 900, "en", "light", path);
    const m = await d.page.evaluate(measure);
    if (m.switchRadios !== 0) fail(`${name} 1440: a language switch on a desktop`);
    if (m.groups.length !== 0) fail(`${name} 1440: phone groups on a desktop`);
    if (m.rows !== 0) fail(`${name} 1440: phone rows on a desktop`);
    if (m.pairs === 0 || m.enInputs === 0) fail(`${name} 1440: the two language inputs are not both there`);
    if (name === "projects" && m.sections !== 4) fail(`projects 1440: ${m.sections} sections, expected 4`);
    if (SHOTS) await shot(d.page, `${name}-1440-ltr-light`);
    await d.close();
  }
  if (SHOTS) {
    for (const [lang, theme] of [["en", "dark"], ["he", "light"], ["he", "dark"]]) {
      const d = await open(1440, 900, lang, theme, "/admin/projects");
      await shot(d.page, `projects-1440-${lang === "he" ? "rtl" : "ltr"}-${theme}`);
      await d.close();
    }
  }
} finally {
  await browser.close();
  stop();
}

if (process.env.REPORT) for (const r of report) console.log(r);
if (fails.length) {
  console.log(`FAIL: ${fails.length}`);
  for (const f of fails.slice(0, 60)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("PASS: the phone editors are groups, one language and a Reorder mode, and the desktop is unchanged.");
