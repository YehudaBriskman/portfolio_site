/*
 * Issue #97: the reading face on the real page, before and after, both
 * languages, both reference windows — and the measurements that depend on
 * the face, taken off the same loads rather than estimated.
 *
 *   BEFORE=http://127.0.0.1:4392 AFTER=http://127.0.0.1:4393 \
 *     node web/scripts/fontwork/shoot-reading-face.mjs docs/type-specimen/reading-face
 *
 * Each base is a production build (`vite build` then `vite preview`); BEFORE
 * is main as it was, AFTER is this branch. Per load it records:
 *
 *   fonts    every /fonts/ file the browser fetched, with its byte length
 *   lcp      the largest-contentful-paint element and its time
 *   cls      the sum of layout-shift entries without recent input
 *   field    the hero's field line: its width against its own box — the
 *            line the phone root of 106.25% was sized to keep inside the
 *            gutter — and whether it overflows
 *
 * Hebrew is reached the way shoot-first-screen.mjs reaches it: writing `lang`
 * and `dir` after mount, which is what `applyLocale` does once the strings
 * exist. Polls by hand; this box's headless Chromium has no frame clock.
 */
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core");
import { mkdirSync } from "node:fs";

const OUT = process.argv[2];
const BASES = { before: process.env.BEFORE, after: process.env.AFTER };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

for (const [which, base] of Object.entries(BASES)) {
  for (const lang of ["en", "he"]) {
    for (const [win, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const fonts = new Map();
      page.on("response", async (r) => {
        if (!r.url().includes("/fonts/")) return;
        try { fonts.set(r.url().split("/").pop(), (await r.body()).length); } catch { /* aborted */ }
      });
      await page.addInitScript(() => {
        window.__cls = 0; window.__lcp = null;
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
          .observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((l) => { const e = l.getEntries().at(-1);
          window.__lcp = { t: Math.round(e.startTime), el: e.element ? `${e.element.tagName.toLowerCase()}.${String(e.element.className).split(" ")[0]}` : "?" }; })
          .observe({ type: "largest-contentful-paint", buffered: true });
      });
      await page.goto(`${base}/`, { waitUntil: "load" });
      if (lang === "he") {
        await page.evaluate(() => { document.documentElement.lang = "he"; document.documentElement.dir = "rtl"; });
      }
      await page.evaluate(() => document.fonts.ready);
      await pause(2800);
      await page.screenshot({ path: `${OUT}/${which}-home-${lang}-${win}.png` });
      const m = await page.evaluate(() => {
        /* The list box is the full column, so measure the union of its items:
           that is the ink a reader sees, and the count of distinct item tops
           is how many lines it broke onto. */
        const field = document.querySelector("#hero .text-field");
        const items = field ? [...field.children].map((c) => c.getBoundingClientRect()) : [];
        const f = items.length ? {
          w: Math.round(Math.max(...items.map((x) => x.right)) - Math.min(...items.map((x) => x.left))),
          lines: new Set(items.map((x) => Math.round(x.top))).size,
          right: Math.round(Math.max(...items.map((x) => x.right))), vw: innerWidth,
          family: getComputedStyle(field).fontFamily.split(",")[0] } : null;
        return { cls: Number(window.__cls.toFixed(4)), lcp: window.__lcp, field: f };
      });
      results.push({ which, lang, win, ...m, fonts: [...fonts].sort(), total: [...fonts.values()].reduce((a, b) => a + b, 0) });
      /* /projects in English only: the first card's name is the text face at
         700, and its counts are the `font-medium` that now renders a real 500. */
      if (lang === "en") {
        await page.goto(`${base}/projects`, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await pause(2800);
        await page.screenshot({ path: `${OUT}/${which}-projects-en-${win}.png` });
      }
      await page.close();
    }
  }
}
await browser.close();

for (const r of results) {
  console.log(`\n${r.which} ${r.lang} ${r.win}  CLS ${r.cls}  LCP ${r.lcp?.t}ms ${r.lcp?.el}  ` +
    `field ${r.field ? `${r.field.w}px on ${r.field.lines} line(s), right edge ${r.field.right}/${r.field.vw} ${r.field.family}` : "-"}`);
  for (const [f, n] of r.fonts) console.log(`  ${String(n).padStart(7)}  ${f}`);
  console.log(`  ${String(r.total).padStart(7)}  TOTAL`);
}
