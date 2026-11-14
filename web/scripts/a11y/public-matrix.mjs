#!/usr/bin/env node
/*
 * Public viewport matrix (#764). The admin has one (admin-matrix.mjs); this is
 * the public side: every public page at the phone widths, in Hebrew (RTL) and
 * English, measured for the things that break a phone layout silently.
 *
 * Pages: home, blog list, a post, projects list, a project, contact (the
 * home page's contact section), help. Widths: 360 / 390 / 430 / 768, plus 320
 * (the WCAG reflow width) in a full run. Every width is a touch device
 * (`hasTouch`, coarse pointer): a tablet is one too.
 *
 * Per page and width it records, and compares to public-matrix-baseline.json:
 *   overflow   the page scrolls sideways, or something sits past an edge
 *   tiny       an interactive target under 24x24 CSS px (WCAG 2.2 AA 2.5.8)
 *   coarse     an interactive target 24..43 px on a coarse pointer (house: 44)
 *   text       readable text under 12px
 *   input      a text field under 16px (iOS zooms the page on focus)
 *   squeeze    a sentence wrapped into a sliver (under 140px, 4+ lines)
 *   overlap    fixed/sticky boxes that cover each other (checked at the top
 *              and after a scroll)
 *   gap        home only: the room between the first-screen call to action and
 *              the bottom edge of the screen (may only grow)
 * A count may only go DOWN against the baseline. A baseline entry is a debt,
 * written down so a later change can pay it off: the file holds today's
 * numbers, defects included (blog search in Hebrew at 360, the small targets,
 * the 11.5px unit). A count above its baseline fails; one below it is reported
 * so the baseline can be lowered (a notice, never a failure: parallel fixes must not
 * conflict on one JSON file). A page that
 * does not load fails, so a broken fixture cannot pass as an empty report.
 * Never gated: timing, CLS, Lighthouse (variance on shared runners).
 *
 *   npm run build
 *   npm run a11y:public-matrix
 *   SHARD=1/2            every 2nd measurement (CI runs two legs)
 *   FULL=1               320 wide too, dark as well as light, and every
 *                        language/width/theme combination
 *   ONLY=home,help  WIDTHS=360,390  THEMES=light  LANGS=he
 *   --shots dir          a screenshot of every measurement (never in CI)
 *   --update-baseline    record today's numbers (light, every width) as known
 *   --json file          the raw measurements
 *   --self-test          prove the measurement on a deliberately broken page
 *
 * Waits poll on a timer, never rAF or animationend: this box's headless
 * Chromium emits about one rAF per 40 s. Clicks are dispatched, not
 * actionability-checked, for the same reason.
 */
import { createRequire } from "node:module";
import { createServer as createHttp } from "node:http";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const BASELINE = resolve(HERE, "public-matrix-baseline.json");
const require = createRequire(resolve(WEB, "package.json"));

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(n);
const env = (n) => (process.env[n] ?? "").split(",").filter(Boolean);
const FULL = process.env.FULL === "1";

/* ------------------------------------------------------------- the matrix */
const WIDTHS = [
  { id: "320x568", w: 320, h: 568, full: true },
  { id: "360x740", w: 360, h: 740 },
  { id: "390x844", w: 390, h: 844 },
  { id: "430x932", w: 430, h: 932 },
  { id: "768x1024", w: 768, h: 1024 },
  /* A short phone: the first screen is where the call to action is tightest. Home only. */
  { id: "390x640", w: 390, h: 640, only: ["home"] },
];
const PAGES = [
  { id: "home", path: "/" },
  { id: "blog", path: "/blog" },
  { id: "post", path: "/blog/fixture-post" },
  { id: "projects", path: "/projects" },
  { id: "project", path: "/projects/bothy" },
  /* The contact form is a dialog on the home page, not a route: press the button that opens it and measure the dialog. */
  { id: "contact", path: "/", scope: "dialog[open]", open: "#contact button[type=button]" },
  { id: "help", path: "/help" },
];

/* ---------------------------------------------------- in-page measurement */
/* The thresholds are arguments so the self-test and the run share one function. */
export function measure({ scope, cta, vw, vh }) {
  /* The size the device was given, not window.innerWidth: a mobile emulation widens the layout viewport to fit an overflowing page, and the overflow would then measure as none. */
  const root = (scope && document.querySelector(scope)) || document.body;
  const out = { overflow: [], tiny: [], coarse: [], text: [], input: [], squeeze: [], overlap: [], gap: null };
  const sel = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter((c) => c && !/^_/.test(c)).slice(0, 2).join(".") : "";
    const label = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${el.tagName.toLowerCase()}${id}${cls ? "." + cls : ""}${label ? ` "${label}"` : ""}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return false;
    if (cs.clipPath === "inset(50%)") return false;
    return true;
  };
  const hiddenFromUsers = (el) => !!el.closest("[aria-hidden='true'], .sr-only, [inert]");
  const inScroller = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      if (o === "auto" || o === "scroll") { if (a.scrollWidth > a.clientWidth) return a; }
      else if ((o === "hidden" || o === "clip") && a.getBoundingClientRect().width < vw - 1 && a.scrollWidth > a.clientWidth) return a;
    }
    return null;
  };
  const underFixed = (el) => { for (let a = el; a && a !== document.body && a !== root; a = a.parentElement) if (getComputedStyle(a).position === "fixed") return true; return false; };

  /* overflow: the document scrolls sideways, or a box sits past an edge a parent clips (a clipped control is as lost as a scrolled one) */
  {
    const de = document.documentElement;
    const offenders = [];
    for (const el of root.querySelectorAll("*")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (!(r.right > vw + 1 || r.left < -1)) continue;
      if (inScroller(el) || underFixed(el) || hiddenFromUsers(el)) continue;
      offenders.push({ el: sel(el), right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) });
    }
    const docWide = !scope && (de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1);
    if (offenders.length || docWide) out.overflow.push({ scrollWidth: de.scrollWidth, vw, offenders: offenders.slice(0, 6), count: Math.max(offenders.length, 1) });
  }

  /* text under 12px, one entry per element that directly holds text */
  const seen = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || seen.has(el) || ["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(el.tagName)) continue;
    seen.add(el);
    /* aria-hidden text is still on the screen (the counter's unit is one), so only the visually hidden are skipped. */
    if (!visible(el) || el.closest(".sr-only")) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) out.text.push({ el: sel(el), px: +fs.toFixed(2) });
    /* squeezed copy: a sentence wrapped into a sliver (the blog search's helper line in Hebrew at 360 is seven short lines) */
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || fs * 1.3;
    if ((el.textContent ?? "").trim().length >= 20 && r.width < 140 && r.height / lh >= 4 && cs.display !== "inline") out.squeeze.push({ el: sel(el), w: Math.round(r.width), lines: Math.round(r.height / lh) });
  }

  /* interactive targets: the control's own box, not its label's. Inline links in running text are exempt (2.5.8). */
  const T = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=switch], [role=menuitem]';
  const isInline = (el) => el.tagName === "A" && getComputedStyle(el).display === "inline" && !!el.closest("p, li, dd, td, label, small") && (el.parentElement?.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 3;
  for (const el of root.querySelectorAll(T)) {
    if (!visible(el) || el.disabled || hiddenFromUsers(el) || el.closest(".skip, [class*='skip']")) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 && r.height <= 1) continue;
    if (isInline(el)) continue;
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 24 || h < 24) out.tiny.push({ el: sel(el), w, h });
    else if (w < 44 || h < 44) out.coarse.push({ el: sel(el), w, h });
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/checkbox|radio|range|file|submit|button|image|color/.test(el.type ?? "")) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) out.input.push({ el: sel(el), px: +fs.toFixed(2) });
    }
  }

  /* first-screen call to action: where it ends, against the bottom edge of the screen (home) */
  if (cta) {
    const el = [...document.querySelectorAll(cta)].find(visible);
    if (el) { const r = el.getBoundingClientRect(); out.gap = { gap: Math.round(vh - r.bottom), top: Math.round(r.top), bottom: Math.round(r.bottom), vh }; }
    else out.gap = { gap: null };
  }
  /* behind a modal dialog the page is inert: only the page itself is checked */
  out.overlap = scope ? [] : overlapNow();
  return out;

  /* fixed/sticky boxes that cover each other. A full-screen backdrop is not a control; a box inside another is not "covering" it. */
  function overlapNow() {
    const boxes = [];
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;
      if (!visible(el) || cs.pointerEvents === "none" || hiddenFromUsers(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height > 0.6 * vw * vh) continue;
      if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      boxes.push({ el, r });
    }
    const pairs = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 2 && h > 2) pairs.push({ a: sel(a.el), b: sel(b.el), w: Math.round(w), h: Math.round(h) });
    }
    return pairs;
  }
}

/* The fixed/sticky overlap again, after a scroll: a bar that tucks in or out is only there then. */
export const overlapAfterScroll = ({ vh }) => window.scrollTo(0, Math.min(600, document.documentElement.scrollHeight - vh));

/* --------------------------------------------------------------- verdict */
export const KINDS = ["overflow", "tiny", "coarse", "text", "input", "squeeze", "overlap"];
export const keyOf = (r) => `${r.page}|${r.lang}|${r.w}`;

/* Today's numbers -> the baseline file's shape. Zeros are left out. */
export function toBaseline(results) {
  const counts = {}, gap = {};
  for (const r of results) {
    if (r.error || r.broken) continue;
    for (const k of KINDS) {
      const n = r[k]?.length ?? 0;
      if (n) (counts[k] ??= {})[keyOf(r)] = n;
    }
    if (r.gap && r.gap.gap != null) gap[keyOf(r) + "|" + r.h] = r.gap.gap;
  }
  const sort = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  return { counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sort(v)])), gap: sort(gap) };
}

/* A result above its budget fails; one under it is stale. A page that did not load always fails. */
export function judge(results, baseline, { gapSlack = 6 } = {}) {
  const fails = [], stale = [];
  for (const r of results) {
    const tag = `${r.page} ${r.w}x${r.h} ${r.theme} ${r.lang}`;
    if (r.error) { fails.push(`${tag}: ERROR ${r.error}`); continue; }
    if (r.broken) { fails.push(`${tag}: page did not load (${r.broken})`); continue; }
    for (const k of KINDS) {
      const n = r[k]?.length ?? 0;
      const budget = baseline.counts?.[k]?.[keyOf(r)] ?? 0;
      const detail = (r[k] ?? []).slice(0, 4).map((x) => x.el ?? `${x.a} x ${x.b}`).join(" | ");
      if (n > budget) fails.push(`${tag}: ${k} ${n} > budget ${budget}  ${detail}`);
      else if (n < budget) stale.push(`${tag}: ${k} ${n} < budget ${budget}`);
    }
    if (r.gap) {
      const want = baseline.gap?.[keyOf(r) + "|" + r.h];
      if (r.gap.gap == null) fails.push(`${tag}: the first-screen call to action is not on the page`);
      else if (want != null && r.gap.gap < want - gapSlack) fails.push(`${tag}: call-to-action gap ${r.gap.gap}px < baseline ${want}px`);
      else if (want != null && r.gap.gap > want + gapSlack) stale.push(`${tag}: call-to-action gap ${r.gap.gap}px > baseline ${want}px`);
    }
  }
  return { fails, stale };
}

/* ------------------------------------------------------------ self-test */
const BROKEN = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font:16px sans-serif}
.wide{width:900px;height:20px;background:#ccc}
.tiny{display:block;width:18px;height:18px;background:#36a}
.mid{display:block;width:30px;height:30px;background:#36a}
.small{font-size:10px}.sq{width:70px;font-size:16px}
input.bad{font-size:12px;width:200px;height:40px}
.f1,.f2{position:fixed;left:0;width:120px;height:60px;background:#a33}
.f1{top:0}.f2{top:30px;left:60px;background:#3a3}
.cta{display:block;width:120px;height:50px;margin-top:560px;background:#36a}
</style></head><body><main>
<div class="wide">too wide</div>
<a class="tiny" href="#a" aria-label="tiny"></a><a class="mid" href="#b" aria-label="mid"></a>
<p class="small">tiny words</p><p class="sq">a sentence long enough to be wrapped into a sliver of a column</p><input class="bad" aria-label="bad">
<a class="cta" href="#contact">Go</a>
<div class="f1">a</div><div class="f2">b</div></main></body></html>`;
const CLEAN = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font:16px sans-serif}a{display:block;width:60px;height:48px}input{font-size:16px;height:48px;width:200px}
</style></head><body><main><p>Fine words here.</p><a href="#a">One</a><input aria-label="ok"></main></body></html>`;

async function selfTest() {
  const { chromium } = require("playwright-core");
  const html = { "/broken": BROKEN, "/clean": CLEAN };
  const srv = createHttp((q, s) => { s.setHeader("content-type", "text/html"); s.end(html[q.url.split("?")[0]] ?? ""); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });
  const run = async (path, cta) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForTimeout(200);
    const m = await page.evaluate(measure, { scope: null, cta, vw: 360, vh: 740 });
    await ctx.close();
    return m;
  };
  const problems = [];
  const expect = (cond, msg) => { if (!cond) problems.push(msg); };
  const bad = await run("/broken", 'a[href="#contact"]');
  expect(bad.overflow.length === 1, `broken: overflow not seen (${bad.overflow.length})`);
  expect(bad.tiny.length === 1, `broken: tiny target not seen (${bad.tiny.length})`);
  expect(bad.coarse.length >= 1, `broken: coarse target not seen (${bad.coarse.length})`);
  expect(bad.text.length === 1, `broken: small text not seen (${bad.text.length})`);
  expect(bad.input.length === 1, `broken: small input not seen (${bad.input.length})`);
  expect(bad.squeeze.length === 1, `broken: squeezed copy not seen (${bad.squeeze.length})`);
  expect(bad.overlap.length === 1, `broken: fixed overlap not seen (${bad.overlap.length})`);
  expect(bad.gap?.gap != null && bad.gap.gap < 140, `broken: call-to-action gap not measured (${JSON.stringify(bad.gap)})`);
  const good = await run("/clean", null);
  for (const k of KINDS) expect(good[k].length === 0, `clean: ${k} reported ${JSON.stringify(good[k])}`);
  await browser.close();
  srv.close();
  /* the verdict: a count over its budget fails, under it is stale, a page that did not load fails */
  const rec = (o) => ({ page: "home", lang: "en", w: 360, h: 740, theme: "light", overflow: [], tiny: [], coarse: [], text: [], input: [], squeeze: [], overlap: [], gap: null, ...o });
  const x = (n) => Array.from({ length: n }, () => ({ el: "a" }));
  const base0 = toBaseline([rec({ coarse: x(3), gap: { gap: 80 } })]);
  expect(base0.counts.coarse["home|en|360"] === 3 && base0.gap["home|en|360|740"] === 80, "baseline shape");
  expect(judge([rec({ coarse: x(3), gap: { gap: 80 } })], base0).fails.length === 0, "verdict: equal to the budget must pass");
  expect(judge([rec({ coarse: x(4), gap: { gap: 80 } })], base0).fails.length === 1, "verdict: a new coarse target must fail");
  expect(judge([rec({ tiny: x(1), gap: { gap: 80 } })], base0).fails.length === 1, "verdict: a new tiny target must fail");
  expect(judge([rec({ overflow: x(1), coarse: x(3), gap: { gap: 80 } })], base0).fails.length === 1, "verdict: overflow with no budget must fail");
  expect(judge([rec({ coarse: x(3), gap: { gap: 40 } })], base0).fails.length === 1, "verdict: a shrinking call-to-action gap must fail");
  expect(judge([rec({ coarse: x(1), gap: { gap: 80 } })], base0).stale.length === 1, "verdict: a lower count is reported as stale");
  expect(judge([rec({ coarse: x(1), gap: { gap: 80 } })], base0).fails.length === 0, "verdict: a lower count never fails");
  expect(judge([rec({ broken: "blank main" })], base0).fails.length === 1, "verdict: a page that did not load must fail");
  expect(judge([rec({ error: "boom" })], base0).fails.length === 1, "verdict: an errored page must fail");
  if (problems.length) { console.log("SELF-TEST FAIL"); for (const p of problems) console.log(" ", p); process.exit(1); }
  console.log("SELF-TEST PASS: the broken page is caught on every measure, the clean page is not, and the verdict holds.");
}

/* ------------------------------------------------------------------- run */
async function main() {
  const { chromium } = require("playwright-core");
  const { answer, startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);
  const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
  const WRITE = flag("--update-baseline") || flag("--write-baseline");
  const SHOTS = arg("--shots", null);
  const JSON_OUT = arg("--json", null);
  const [shardK, shardN] = (process.env.SHARD ?? "1/1").split("/").map(Number);
  if (!(shardK >= 1 && shardN >= 1 && shardK <= shardN)) throw new Error(`SHARD=${process.env.SHARD} is not k/n`);

  /* Default (CI): light, four widths, he and en. FULL adds 320 and dark. The baseline is always written from light, every width. */
  const themes = env("THEMES").length ? env("THEMES") : FULL ? ["light", "dark"] : ["light"];
  const langs = env("LANGS").length ? env("LANGS") : ["he", "en"];
  const widths = WIDTHS.filter((v) => (WRITE || FULL ? true : !v.full) && (!env("WIDTHS").length || env("WIDTHS").includes(String(v.w)) || env("WIDTHS").includes(v.id)));
  const only = env("ONLY");
  const tasks = [];
  for (const v of widths) for (const lang of langs) for (const theme of WRITE ? ["light"] : themes) for (const p of PAGES) {
    if (v.only && !v.only.includes(p.id)) continue;
    if (only.length && !only.includes(p.id)) continue;
    tasks.push({ v, lang, theme, p });
  }
  const mine = tasks.filter((_, i) => i % shardN === shardK - 1);

  const tint = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#3a6f8f"/></svg>';
  const { base, stop } = await startPreview();
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });
  const pages = new Map();
  const pageFor = async (t) => {
    const key = `${t.v.id}|${t.lang}|${t.theme}`;
    if (pages.has(key)) return pages.get(key);
    const ctx = await browser.newContext({ viewport: { width: t.v.w, height: t.v.h }, isMobile: true, hasTouch: true, reducedMotion: "reduce", colorScheme: t.theme, locale: t.lang === "he" ? "he-IL" : "en-US" });
    await ctx.addInitScript((th) => { try { localStorage.setItem("yb-theme", th); } catch { /* colorScheme carries it */ } }, t.theme);
    /* Never touch a live host: anything not on the preview server is dropped. */
    await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
    await ctx.route("**/api/**", (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith("/api/images/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: tint });
      const a = answer(u.toString(), false);
      return route.fulfill({ status: a.status, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
    });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(NOW));
    page.on("pageerror", (e) => console.log("pageerror", e.message.split("\n")[0]));
    pages.set(key, page);
    return page;
  };

  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const results = [];
  const wall = Date.now();
  for (const t of mine) {
    const t0 = Date.now();
    const rec = { page: t.p.id, w: t.v.w, h: t.v.h, theme: t.theme, lang: t.lang, path: (t.lang === "he" ? "/he" : "") + t.p.path };
    try {
      const page = await pageFor(t);
      await page.goto(`${base}${rec.path}`, { waitUntil: "load" });
      for (let i = 0; i < 40; i++) {
        const ok = await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? "") && [...document.images].every((im) => im.complete || !im.getAttribute("src")); });
        if (ok) break;
        await page.waitForTimeout(250);
      }
      await page.evaluate(() => document.fonts.ready);
      if (t.p.open) {
        await page.locator(t.p.open).first().dispatchEvent("click", {}, { timeout: 20000 });
        await page.waitForSelector(t.p.scope, { timeout: 8000, state: "attached" });
      }
      await page.waitForTimeout(400);
      Object.assign(rec, await page.evaluate(measure, { scope: t.p.scope ?? null, cta: t.p.id === "home" ? 'a[href="#contact"]' : null, vw: t.v.w, vh: t.v.h }));
      /* After a scroll: the bar that tucks in or out. A window scroll event is not a frame, so a timer is enough. */
      if (!t.p.scope) {
        await page.evaluate(overlapAfterScroll, { vh: t.v.h });
        await page.waitForTimeout(700);
        const again = await page.evaluate(measure, { scope: null, cta: null, vw: t.v.w, vh: t.v.h });
        const known = new Set(rec.overlap.map((o) => `${o.a}|${o.b}`));
        for (const o of again.overlap) if (!known.has(`${o.a}|${o.b}`)) rec.overlap.push(o);
        if (SHOTS) await page.screenshot({ path: resolve(SHOTS, `${t.p.id}-${t.v.w}-${t.theme}-${t.lang}-scrolled.png`), timeout: 120000 });
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      /* A fixture that does not load is a failure, not an empty report. */
      rec.broken = await page.evaluate((scope) => {
        const m = document.querySelector("main");
        const t = ((scope && document.querySelector(scope)) || m)?.textContent?.trim() ?? "";
        return !m ? "no main" : t.length < 20 ? "blank main" : document.querySelector('[role="alert"] > h1') ? "error boundary" : "";
      }, t.p.scope ?? null);
      rec.dir = await page.evaluate(() => `${document.documentElement.lang}/${document.documentElement.dir}`);
      if (SHOTS) {
        await page.screenshot({ path: resolve(SHOTS, `${t.p.id}-${t.v.w}-${t.theme}-${t.lang}.png`), timeout: 120000 });
      }
    } catch (e) { rec.error = e.message.split("\n")[0]; }
    rec.ms = Date.now() - t0;
    results.push(rec);
    const n = (k) => rec[k]?.length ?? "?";
    console.log(`${rec.ms}ms ${rec.page} ${rec.w}x${rec.h} ${rec.theme} ${rec.lang}: overflow ${n("overflow")} tiny ${n("tiny")} coarse ${n("coarse")} text ${n("text")} input ${n("input")} squeeze ${n("squeeze")} overlap ${n("overlap")}${rec.gap ? ` gap ${rec.gap.gap}` : ""}${rec.broken ? " BROKEN " + rec.broken : ""}${rec.error ? " ERR " + rec.error : ""}`);
  }
  await browser.close();
  stop();
  console.log(`measured ${results.length} of ${tasks.length} in ${Math.round((Date.now() - wall) / 1000)}s`);
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ results }, null, 1));

  if (WRITE) {
    const b = toBaseline(results);
    const bad = results.filter((r) => r.error || r.broken);
    if (bad.length) { console.log(`baseline NOT written: ${bad.length} page(s) did not load`); process.exit(1); }
    writeFileSync(BASELINE, JSON.stringify({ about: "Known findings of the public phone matrix (#764): counts per kind, page|lang|width. A count may only go down; lower it here in the PR that fixes it. Regenerate: npm run a11y:public-matrix -- --update-baseline", ...b }, null, 1) + "\n");
    const total = Object.values(b.counts).reduce((s, o) => s + Object.values(o).reduce((a, c) => a + c, 0), 0);
    console.log(`baseline: ${total} known finding(s) over ${Object.keys(b.counts).length} kinds`);
    return;
  }
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const v = judge(results, baseline, {});
  if (v.stale.length) { console.log(`\nbaseline can be lowered: run npm run a11y:public-matrix -- --update-baseline (${v.stale.length} below it)`); for (const s of v.stale.slice(0, 30)) console.log(" ", s); }
  const fails = v.fails;
  if (fails.length) { console.log(`\nFAIL: ${fails.length}`); for (const f of fails.slice(0, 80)) console.log(" ", f); process.exit(1); }
  console.log(`\nPASS: ${results.length} page measurements within the baseline.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (flag("--self-test")) await selfTest();
  else await main();
}
