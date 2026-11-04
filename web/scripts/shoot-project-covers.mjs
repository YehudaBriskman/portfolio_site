#!/usr/bin/env node
/*
 * The covers of the two projects added on 2026-11-04, as 1600x1000 masters
 * in public/projects/ (16:10, the shape every card and the project page's
 * figure frame them in; 1600 wide, the width scripts/build-shots.mjs and
 * lib/projectImage.ts assume of a master):
 *
 *   portfolio_site.jpg  this site, as it is live: a real screenshot of
 *                       https://yehudabriskman.com, 1280x800 CSS px at a
 *                       device scale of 1.25.
 *   oci_free.jpg        oci-free has no interface, so a diagram of it:
 *                       scripts/covers/oci-free.svg, drawn from the
 *                       repository's public README with generic names only,
 *                       rendered here in Chromium with the site's own fonts.
 *
 *   xvfb-run -a node scripts/shoot-project-covers.mjs
 *   ONLY=oci_free xvfb-run -a node scripts/shoot-project-covers.mjs
 *
 * PNG out of the browser, then JPEG (q 86, 4:2:0, progressive) through sharp
 * from the backend's dependencies, with the -400/-800/-1200 and -1600
 * AVIF/WebP rungs build-shots.mjs would cut, so the seed's static path offers
 * the same ladder as the other covers. Under xvfb, motion reduced, every wait
 * on a timer; a capture is retried.
 */
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, "../public");
const OUT = resolve(PUBLIC, "projects");
const sharp = createRequire(resolve(HERE, "../../backend/package.json"))("sharp");
const ONLY = process.env.ONLY?.split(",");

const viewport = { width: 1280, height: 800 };
const SCALE = 1.25;

async function capture(page, file) {
  for (let i = 0; ; i++) {
    try {
      return await page.screenshot({ type: "png", timeout: 120_000 });
    } catch (e) {
      if (i >= 3) throw e;
      console.log(`retrying ${file}: ${e.message.split("\n")[0]}`);
    }
  }
}

async function write(name, png) {
  const img = sharp(png).resize(1600, 1000, { fit: "cover" });
  await img.clone().jpeg({ quality: 86, progressive: true, mozjpeg: true }).toFile(`${OUT}/${name}.jpg`);
  for (const w of [400, 800, 1200, 1600]) {
    const rung = sharp(png).resize(w, Math.round((w * 10) / 16), { fit: "cover", kernel: "lanczos3" });
    if (w !== 1600) await rung.clone().jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(`${OUT}/${name}-${w}.jpg`);
    await rung.clone().webp({ quality: 80 }).toFile(`${OUT}/${name}-${w}.webp`);
    await rung.clone().avif({ quality: 55 }).toFile(`${OUT}/${name}-${w}.avif`);
  }
  console.log("wrote", name);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: !process.env.DISPLAY, args: ["--no-sandbox"] });
try {
  if (!ONLY || ONLY.includes("portfolio_site")) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: SCALE, reducedMotion: "reduce" });
    await ctx.addInitScript(() => localStorage.setItem("yb-theme", "light"));
    const page = await ctx.newPage();
    await page.goto(process.env.SHOT_URL ?? "https://yehudabriskman.com/", { waitUntil: "load", timeout: 120_000 });
    await page.waitForFunction(() => document.querySelector("h1") !== null, null, { polling: 500, timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    /* The page's own scrollbar is the browser's, not the site's. */
    await page.addStyleTag({ content: "html { scrollbar-width: none; }" });
    await page.waitForTimeout(4000);
    await write("portfolio_site", await capture(page, "portfolio_site"));
    await ctx.close();
  }
  if (!ONLY || ONLY.includes("oci_free")) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: SCALE, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const font = (f) => `data:font/woff2;base64,${readFileSync(`${PUBLIC}/fonts/${f}`).toString("base64")}`;
    const svg = readFileSync(resolve(HERE, "covers/oci-free.svg"), "utf8");
    await page.setContent(
      `<!doctype html><html><head><style>
        @font-face { font-family: "Audiowide"; src: url(${font("audiowide-400.woff2")}) format("woff2"); }
        @font-face { font-family: "Atkinson Hyperlegible Next"; font-weight: 400 700; src: url(${font("atkinson-hyperlegible-next-400-700.woff2")}) format("woff2"); }
        html, body { margin: 0; width: 1280px; height: 800px; overflow: hidden; }
        svg { display: block; width: 1280px; height: 800px; }
      </style></head><body>${svg}</body></html>`,
      { waitUntil: "load" },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);
    await write("oci_free", await capture(page, "oci_free"));
    await ctx.close();
  }
} finally {
  await browser.close();
}
