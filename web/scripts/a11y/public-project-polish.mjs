#!/usr/bin/env node
/*
 * The project page on a phone, second polish pass: facts, and shots.
 *
 *   npm run build && npm run a11y:public-project-polish
 *   SHOTS=../docs/design/project-polish/raw npm run a11y:public-project-polish
 *
 * 360 / 390 / 430, English and Hebrew, light and dark; with a busy cover and
 * without, and a long title. On /projects/windom (a live project with a
 * repository, a licence and no release) and /projects/bothy:
 *   - the title and the tile start BELOW the cover's box, and the title's ink
 *     on the card's surface is >= 4.5:1;
 *   - at most two rows of stat chips, and none of them is Forks;
 *   - the cover is drawn once (the Overview repeats no picture);
 *   - the Overview paragraph is fully opaque ink and dir=auto;
 *   - no Elsewhere row joins its parts with a dot;
 *   - About: rows in a <dl>, label at the inline start and value at the
 *     inline end of one line, licence and counts left-to-right, no row for
 *     data the header or Details holds, one small "as of" line, and the
 *     repository / feed are 44+ tall list rows;
 *   - no sideways overflow.
 * Waits are fixed and polling is by hand: this headless Chromium emits about
 * one frame per 40 s, so nothing here waits on rAF. CHROME overrides the binary.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startPreview } from "./site-stub.mjs";
import { handler } from "./projects-fixture.mjs";

const WIDTHS = (process.env.WIDTHS ?? "360,390,430").split(",").map(Number);
const LANGS = (process.env.LANGS ?? "en,he").split(",");
const THEMES = (process.env.THEMES ?? "light,dark").split(",");
const SHOTS = process.env.SHOTS ?? "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const base = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const fails = [];
const fail = (tag, msg) => fails.push(`${tag}  ${msg}`);

const settle = async (page) => {
  await page.locator("footer").first().waitFor({ state: "attached" });
  for (let i = 0; i < 20; i++) {
    if ((await page.locator('[aria-busy="true"]').count()) === 0) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
};

const probe = () => {
  const num = (s) => s.match(/-?[\d.]+(?:e-?\d+)?/g).map(Number);
  /* rgb(), rgba() or color(srgb r g b [/ a]) -> [r,g,b,a] in 0..255 */
  const rgba = (c) => {
    const n = num(c);
    if (c.startsWith("color(")) return [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1];
    return [n[0], n[1], n[2], n[3] ?? 1];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const vis = (s, root = document) => [...root.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().width > 0);
  const out = { overflow: innerWidth < document.documentElement.scrollWidth - 1 };
  const head = vis('[data-phone-card="header"]')[0];
  if (!head) return { ...out, noHead: true };
  const h1 = head.querySelector("h1");
  const cover = head.querySelector('[data-phone="head-cover"]');
  const top = head.querySelector("h1").closest("div").parentElement;
  const cb = cover.getBoundingClientRect();
  out.hasImage = !!cover.querySelector("img");
  out.coverBottom = Math.round(cb.bottom);
  out.topTop = Math.round(top.getBoundingClientRect().top);
  out.fallback = cover.hasAttribute("data-fallback");
  const surface = rgba(getComputedStyle(head).backgroundColor);
  out.contrast = +ratio(rgba(getComputedStyle(h1).color), surface).toFixed(2);
  out.alpha = rgba(getComputedStyle(h1).color)[3];
  /* chip rows */
  const tiles = vis('[data-phone="stat-tile"]', head);
  out.tileTexts = tiles.map((t) => t.textContent.replace(/\s+/g, " ").trim());
  out.tileRows = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top))).size;
  /* the cover is drawn once */
  out.imgs = vis("main img, [data-phone-card] img").filter((i) => /icaros/.test(i.currentSrc || i.src)).length;
  /* overview paragraph */
  const p = vis("section[aria-label] p[dir]")[0];
  if (p) {
    const c = rgba(getComputedStyle(p).color);
    out.pAlpha = c[3];
    out.pContrast = +ratio(c, rgba(getComputedStyle(p.closest("section")).backgroundColor)).toFixed(2);
    out.pDir = p.getAttribute("dir");
  }
  out.words = vis("[data-word]").filter((w) => getComputedStyle(w).color !== getComputedStyle(h1).color).length;
  /* Elsewhere separators */
  out.dots = vis("[data-stack] > *").filter((e) => getComputedStyle(e, "::before").content !== "none").length;
  out.elsewhere = vis("#elsewhere-heading").length;
  /* About */
  const about = vis('[data-phone="about"]')[0];
  if (about) {
    out.about = {
      labels: vis("dt", about).map((d) => d.textContent.trim()),
      rows: vis("dl > div", about).map((d) => {
        const dt = d.querySelector("dt").getBoundingClientRect();
        const dd = d.querySelector("dd").getBoundingClientRect();
        const r = d.getBoundingClientRect();
        const rtl = getComputedStyle(d).direction === "rtl";
        return { startOk: rtl ? Math.abs(r.right - dt.right) < 20 : Math.abs(dt.left - r.left) < 20, endOk: rtl ? Math.abs(dd.left - r.left) < 20 : Math.abs(r.right - dd.right) < 20, h: Math.round(r.height) };
      }),
      ltr: vis("dd [dir=ltr]", about).map((e) => e.textContent.trim()),
      stamp: vis('[data-phone="about-stamp"]', about).map((e) => e.textContent.trim()),
      stampSize: vis('[data-phone="about-stamp"]', about).map((e) => parseFloat(getComputedStyle(e).fontSize)),
      rowsH: vis("[data-phone-row]", about).map((e) => Math.round(e.getBoundingClientRect().height)),
      overlap: vis("[data-phone-row]", about).filter((row) => {
        const kids = [...row.children].filter((k) => !k.hasAttribute("data-phone-circle") && !k.hasAttribute("data-phone-chevron")).map((k) => k.getBoundingClientRect());
        return kids.some((a, i) => kids.some((b, j) => j > i && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1));
      }).length,
      loose: vis("a", about).filter((a) => !a.hasAttribute("data-phone-row")).length,
    };
  }
  return out;
};

const combos = [];
for (const width of WIDTHS) for (const lang of LANGS) for (const theme of THEMES) combos.push({ width, lang, theme });
/* one context per combination keeps a run well under a minute */
await Promise.all(
  combos.map(async ({ width, lang, theme }) => {
    for (const variant of ["cover", "nocover", "long"]) {
      const ctx = await browser.newContext({ viewport: { width, height: 780 }, hasTouch: true, isMobile: true, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
      await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch { /* blocked */ } }, theme);
      await ctx.route("**/api/**", handler({ cover: variant !== "nocover", longTitle: variant === "long", windom: true }));
      for (const slug of variant === "cover" ? ["windom", "bothy"] : ["bothy"]) {
        const tag = `${lang} ${theme} ${width} ${variant} ${slug}`;
        const page = await ctx.newPage();
        await page.goto(base.base + (lang === "he" ? "/he" : "") + `/projects/${slug}`, { waitUntil: "load" });
        await settle(page);
        const r = await page.evaluate(probe);
        if (r.noHead) { fail(tag, "no header card"); await page.close(); continue; }
        if (r.overflow) fail(tag, "horizontal overflow");
        if (r.topTop < r.coverBottom - 1 && !r.fallback) fail(tag, `the name starts at ${r.topTop}, above the cover's bottom ${r.coverBottom}`);
        if (r.contrast < 4.5 || r.alpha !== 1) fail(tag, `title contrast ${r.contrast} alpha ${r.alpha} (need 4.5 and opaque)`);
        if (r.tileRows > 2) fail(tag, `${r.tileRows} rows of stat chips`);
        if (r.tileTexts.some((t) => /Forks|פיצולים/.test(t))) fail(tag, "Forks is a header chip");
        if (variant !== "nocover" && r.imgs !== 1) fail(tag, `the cover is drawn ${r.imgs} times`);
        if (r.pAlpha !== undefined && (r.pAlpha !== 1 || r.pContrast < 4.5 || r.pDir !== "auto")) fail(tag, `Overview paragraph alpha ${r.pAlpha} contrast ${r.pContrast} dir ${r.pDir}`);
        if (r.words) fail(tag, `${r.words} pen words are not in plain ink`);
        if (r.dots) fail(tag, `${r.dots} Elsewhere parts carry a separator`);
        if (r.about) {
          const a = r.about;
          if (a.rows.length < 2) fail(tag, `About has ${a.rows.length} label/value rows`);
          for (const row of a.rows) {
            if (!row.startOk || !row.endOk) fail(tag, `About row not label-start / value-end ${JSON.stringify(row)}`);
            if (row.h < 40) fail(tag, `About row ${row.h} tall`);
          }
          if (a.labels.some((l) => /Language|Stars|שפה|כוכבים|Forks|פיצולים/.test(l))) fail(tag, `About repeats the header: ${a.labels}`);
          if (!a.ltr.includes("MIT")) fail(tag, "the licence is not dir=ltr");
          if (a.stamp.length !== 1 || a.stamp[0].length > 40 || a.stampSize[0] > 14) fail(tag, `the as-of line ${JSON.stringify(a.stamp)} ${a.stampSize}`);
          if (a.rowsH.some((h) => h < 44) || a.loose) fail(tag, `About links: rows ${a.rowsH}, loose ${a.loose}`);
          if (a.overlap) fail(tag, `${a.overlap} About rows have overlapping text`);
        }
        if (SHOTS && (slug === "windom" || variant !== "cover")) {
          await page.screenshot({ path: `${SHOTS}/${slug}.${variant}.${lang}.${theme}.${width}.png`, fullPage: true, timeout: 120000 });
        }
        if (SHOTS && (slug === "windom" || variant !== "cover")) {
          /* the three regions this pass changed, for the montages */
          for (const [key, sel] of [["head", '[data-phone-card="header"]'], ["about", '[data-phone="about"]'], ["elsewhere", "#elsewhere-heading"]]) {
            const loc = key === "elsewhere" ? page.locator(sel).locator("xpath=ancestor::section[1]") : page.locator(sel).first();
            if (await loc.count()) await loc.screenshot({ path: `${SHOTS}/${slug}.${variant}.${lang}.${theme}.${width}.${key}.png`, timeout: 120000 });
          }
        }
        await page.close();
      }
      await ctx.close();
    }
  }),
);

await browser.close();
base.stop();
if (fails.length) {
  const seen = new Set();
  for (const f of fails) if (!seen.has(f)) { seen.add(f); console.log("FAIL  " + f); }
  console.log(`\n${seen.size} problem(s).`);
  process.exit(1);
}
console.log("Public project page, second polish pass: clean.");
