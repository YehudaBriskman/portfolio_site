#!/usr/bin/env node
/*
 * Admin at desktop widths: no squeezed control, no page-wide overflow. Companion
 * of admin-matrix.mjs, which holds the phone widths. The failure it exists for:
 * the Edit button of a table row stacking its label one letter per line when a
 * long value in the same row left the action column no room.
 *
 * It exits 1 when, on any screen at 1024 / 1280 / 1440 wide:
 *   - the page scrolls sideways;
 *   - a button or link has a label wrapped past two lines, or a one-word label
 *     (3+ letters) on more than one line (a word broken per letter);
 *   - a button or link is narrower than 2ch inside its own padding.
 * The fixtures are deliberately awkward: very long and Hebrew titles, an
 * unbreakable key, many fields per row. No network; same harness as the matrix.
 *
 *   npm run build
 *   npm run a11y:admin-desktop
 *   WIDTHS=1024,1440  LANGS=en  THEMES=dark  ONLY=translations,posts  SHOTS=dir
 * Waits poll on a timer, never rAF (headless Chromium here has ~1 rAF / 40 s).
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { NOW, answer as baseAnswer, tint } from "./admin-fixtures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const env = (n) => (process.env[n] ?? "").split(",").filter(Boolean);
const WIDTHS = (env("WIDTHS").length ? env("WIDTHS") : ["1024", "1280", "1440"]).map(Number);
const LANGS = env("LANGS").length ? env("LANGS") : ["en", "he"];
const THEMES = env("THEMES").length ? env("THEMES") : ["light"];
const ONLY = env("ONLY");

/* ---------------------------------------------------------------- fixtures */
const LONG_EN = "A title that goes on and on about the way a very long heading behaves inside a narrow table cell on a desktop screen";
const LONG_HE = "כותרת ארוכה מאוד שממשיכה ועוד ממשיכה כדי לבדוק איך עמודת הפעולות מתנהגת כשהתוכן ארוך במיוחד";
const KEY = "decisionsAndTradeoffsWithAnUnbreakableIdentifierThatNeverEndsAndNeverBreaks";
const unit = (path, status) => ({ path, status, primary: true, en: LONG_EN, he: status === "missing" ? null : LONG_HE, draftHe: null });
const TITLES = [LONG_EN, LONG_HE, "Home · hero", KEY, `${KEY} ${LONG_HE}`, "Nav", "Footer"];
const STATUSES = ["missing", "stale", "draft", "translated", "unverified"];
const ITEMS = Array.from({ length: 21 }, (_, i) => ({
  type: ["site-copy", "project", "post", "area", "story", "media"][i % 6],
  id: `item-${i}`,
  title: TITLES[i % TITLES.length],
  route: i % 3 === 0 ? `/blog/${KEY}-${KEY}` : i % 3 === 1 ? "/" : `/projects/windom-${i}`,
  rank: i,
  visibility: i % 5 === 4 ? "private" : "public",
  status: STATUSES[i % 5],
  units: [unit(`${KEY}.0`, STATUSES[i % 5]), unit("phrases.1", STATUSES[i % 5]), unit("decisions.2.body", STATUSES[i % 5]), unit("lines.3", STATUSES[(i + 1) % 5])],
}));
const TRANSLATIONS = { ok: true, counts: { missing: 5, draft: 4, stale: 4, unverified: 4, translated: 4 }, coverage: 42, items: ITEMS };
function answer(path, method, search) {
  if (path.replace(/^\/api/, "") === "/admin/translations") return { body: TRANSLATIONS };
  return baseAnswer(path, method, search);
}

/* ------------------------------------------------------------------ screens */
const SCREENS = [
  ["overview", "/admin"],
  ["posts", "/admin/posts"],
  ["areas", "/admin/areas"],
  ["projects", "/admin/projects"],
  ["media", "/admin/media"],
  ["settings", "/admin/settings"],
  ["connections", "/admin/connections"],
  ["translations", "/admin/translations"],
  ["translations-stale", "/admin/translations?status=stale&visibility=all"],
  ["translations-done", "/admin/translations?status=done&visibility=all"],
  ["marketing-inbox", "/admin/marketing"],
  ["marketing-campaigns", "/admin/marketing?tab=campaigns"],
  ["marketing-audience", "/admin/marketing?tab=audience"],
  ["marketing-library", "/admin/marketing?tab=library"],
  ["marketing-settings", "/admin/marketing?tab=settings"],
];

/* ------------------------------------------------------ in-page measurement */
function measure() {
  const out = { overflow: null, squeezed: [] };
  const vw = window.innerWidth;
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1) out.overflow = { scrollWidth: Math.max(de.scrollWidth, document.body.scrollWidth), vw };
  const sel = (el) => {
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter((c) => c && !/^(min-|w-|h-|px|py|mt|mb)/.test(c)).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}`;
  };
  const T = "a[href], button, summary, [role=button], [role=tab], [role=link]";
  for (const el of document.querySelectorAll(T)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.display === "inline" || el.closest(".sr-only, [aria-hidden='true']")) continue;
    if (cs.clipPath === "inset(50%)") continue;
    const text = [...el.childNodes].filter((n) => !(n.nodeType === 1 && n.matches(".sr-only"))).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim();
    if (text.length < 3) continue;
    const fs = parseFloat(cs.fontSize);
    const px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    /* Lines are counted from the text itself (a min-height is not a wrapped label). */
    const tops = new Set();
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.parentElement.closest(".sr-only") ? NodeFilter.FILTER_REJECT : t.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const q of range.getClientRects()) if (q.width > 0 && q.height > 0) tops.add(Math.round(q.top / (fs * 0.6)));
    }
    const lines = tops.size;
    const oneWord = !/\s/.test(text);
    const why = r.width - px < 2 * fs * 0.5 ? "narrower than 2ch" : lines > 2 ? `${lines} lines` : oneWord && lines > 1 ? "a word broken across lines" : "";
    if (why) out.squeezed.push({ el: sel(el), text: text.slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), why });
  }
  return out;
}

/* --------------------------------------------------------------------- run */
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });
const fails = [];
let n = 0;
for (const w of WIDTHS) for (const lang of LANGS) for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
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
    if (ONLY.length && !ONLY.includes(name)) continue;
    const tag = `${name} ${w} ${theme} ${lang}`;
    try {
      await page.goto(`${base}${lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
      for (let i = 0; i < 40; i++) { const ok = await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? ""); }); if (ok) break; await page.waitForTimeout(250); }
      await page.evaluate(() => document.fonts.ready);
      const rec = await page.evaluate(measure);
      if (process.env.SHOTS) await page.screenshot({ path: resolve(process.env.SHOTS, `${name}-${w}-${theme}-${lang}.png`), timeout: 120000 });
      n++;
      if (rec.overflow) fails.push(`${tag}: page scrolls sideways (${rec.overflow.scrollWidth} > ${rec.overflow.vw})`);
      for (const s of rec.squeezed.slice(0, 3)) fails.push(`${tag}: ${s.el} "${s.text}" is ${s.w}x${s.h}, ${s.why}`);
    } catch (e) { fails.push(`${tag}: ERROR ${e.message.split("\n")[0]}`); }
  }
  await ctx.close();
}
await browser.close();
stop();
/* One fault is one line: the same message at another width or language is dropped. */
const seen = new Set();
const uniq = fails.filter((f) => { const key = `${f.split(" ")[0]}|${f.replace(/^[^:]+: /, "").replace(/\d+x\d+/, "")}`; return seen.has(key) ? false : (seen.add(key), true); });
if (uniq.length) { console.log(`FAIL: ${fails.length} finding(s), ${uniq.length} distinct`); for (const f of uniq.slice(0, 60)) console.log(" ", f); process.exit(1); }
console.log(`PASS: ${n} desktop screens, no squeezed control, no sideways scroll.`);
