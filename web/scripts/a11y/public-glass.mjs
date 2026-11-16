#!/usr/bin/env node
/*
 * The floating menu circle is colourless glass (#891): over ANY backdrop its
 * two bars must read at >= 4.5:1 against what sits immediately round them.
 * Light and dark theme, English and Hebrew, over a forced black section and a
 * forced white one, at 390px. The circle must also have no ground of its own
 * (background alpha <= 0.2). Screenshots go to OUT (default: os tmp dir) to be
 * LOOKED AT: a number does not tell you "ugly".
 *
 * How it measures: the glyph is two 2px bars, each ringed by a 1px --glass-halo
 * of the opposite tone. A screenshot gives the bar's centre pixel (glyph) and
 * the pixel 1px outside the bar's edge (halo); their WCAG contrast is the
 * legibility of the glyph on that backdrop. Fixed waits, never rAF (this box
 * has ~1 frame per 40 s). CHROME overrides the browser binary.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { answer, startPreview } from "./site-stub.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const OUT = process.env.OUT || resolve(tmpdir(), "public-glass");
mkdirSync(OUT, { recursive: true });

const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/* Minimal 8-bit PNG reader (no dependency): enough to read single pixels. */
function decode(buf) {
  let p = 8, w = 0, h = 0, bpp = 4;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8);
    if (type === "IHDR") { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); bpp = buf[p + 17] === 6 ? 4 : 3; }
    if (type === "IDAT") idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const st = w * bpp;
  const out = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)];
    for (let x = 0; x < st; x++) {
      const v = raw[y * (st + 1) + 1 + x];
      const a = x >= bpp ? out[y * st + x - bpp] : 0;
      const b = y ? out[(y - 1) * st + x] : 0;
      const c = x >= bpp && y ? out[(y - 1) * st + x - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const add = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      out[y * st + x] = (v + add) & 255;
    }
  }
  return { px: (x, y) => [out[y * st + x * bpp], out[y * st + x * bpp + 1], out[y * st + x * bpp + 2]] };
}

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const failures = [];
const rows = [];
for (const he of [false, true])
  for (const dark of [false, true])
    for (const back of ["black", "white"]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: dark ? "dark" : "light" });
      await ctx.route(/\/api\//, async (r) => {
        const a = answer(r.request().url());
        await r.fulfill({ status: a.status ?? 200, contentType: "application/json", body: typeof a.body === "string" ? a.body : JSON.stringify(a.body ?? a) });
      });
      await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, dark ? "dark" : "light");
      const page = await ctx.newPage();
      await page.goto(base + (he ? "/he" : "/"), { waitUntil: "load" });
      await page.waitForSelector('button[aria-controls="nav-menu"]', { state: "attached", timeout: 15000 });
      await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
      /* A forced section under the circle: below the floating layer (z 49), above the page. */
      await page.evaluate((c) => {
        const d = document.createElement("div");
        d.style.cssText = `position:fixed;inset:0 0 auto 0;height:120px;z-index:40;background:${c};`;
        document.body.appendChild(d);
      }, back);
      await page.waitForTimeout(800);
      const m = await page.locator('button[aria-controls="nav-menu"]').evaluate((b) => {
        const cs = getComputedStyle(b), r = b.getBoundingClientRect();
        const bg = cs.backgroundColor.match(/[\d.]+/g).map(Number);
        return { x: r.left, y: r.top, w: r.width, h: r.height, alpha: bg.length > 3 ? bg[3] : 1, bf: cs.backdropFilter };
      });
      const tag = `${he ? "he" : "en"}-${dark ? "dark" : "light"}-${back}`;
      const shot = await page.screenshot({ path: `${OUT}/${tag}.png`, clip: { x: 0, y: 0, width: 390, height: 120 }, timeout: 120000 });
      const img = decode(shot);
      const cx = Math.round(m.x + m.w / 2), cy = Math.round(m.y + m.h / 2);
      /* .bars is 18x14, centred; its bars sit at top 3-5 and 10-12. */
      const top = Math.round(cy - 7);
      const glyph = img.px(cx, top + 4), ring = img.px(cx, top + 6);
      const cr = ratio(glyph, ring);
      rows.push(`${tag}: circle ${Math.round(m.w)}x${Math.round(m.h)} bg-alpha ${m.alpha} glyph rgb(${glyph}) ring rgb(${ring}) contrast ${cr.toFixed(1)}`);
      if (m.alpha > 0.2) failures.push(`${tag}: the circle has a ground of its own (alpha ${m.alpha})`);
      if (m.bf === "none") failures.push(`${tag}: no backdrop blur`);
      if (cr < 4.5) failures.push(`${tag}: glyph contrast ${cr.toFixed(2)} < 4.5`);
      await ctx.close();
    }
await browser.close();
await stop?.();
console.log(rows.join("\n"));
if (failures.length) { console.log(`\nFAIL\n${failures.join("\n")}`); process.exit(1); }
console.log(`\nPASS: the menu circle is colourless glass and legible on black and white, light and dark, en and he (shots in ${OUT}).`);
