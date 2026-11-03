#!/usr/bin/env node
/*
 * Issue #127: how many device pixels of the hero portrait reach the screen.
 *
 * For each window and device pixel ratio, reports the file the browser chose
 * (`currentSrc`), its natural width, the CSS width it is painted at, and the
 * ratio natural / (painted CSS width x DPR). 1.0 is one file pixel per device
 * pixel; below 1 the browser is upscaling and the figure goes soft.
 *
 *   npm run build && node scripts/measure-portrait-density.mjs
 *
 * Reduced motion, so the arrival is finished and the box has its resting size.
 */
import { chromium } from "playwright-core";
import { startPreview } from "./a11y/site-stub.mjs";

const CASES = [
  { w: 390, h: 844, dpr: 1 },
  { w: 390, h: 844, dpr: 2 },
  { w: 390, h: 844, dpr: 3 },
  { w: 1440, h: 900, dpr: 1 },
  { w: 1440, h: 900, dpr: 2 },
  { w: 1440, h: 900, dpr: 3 },
];

const { base, stop } = await startPreview();
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
try {
  for (const c of CASES) {
    const ctx = await browser.newContext({
      viewport: { width: c.w, height: c.h },
      deviceScaleFactor: c.dpr,
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(base + "/", { waitUntil: "networkidle" });
    // `polling` by hand: headless Chromium here barely runs rAF.
    await page.waitForFunction(
      () => {
        const i = document.querySelector("[data-portrait] img");
        return i && i.complete && i.naturalWidth > 0;
      },
      null,
      { polling: 500, timeout: 20000 },
    );
    const r = await page.evaluate(async () => {
      const i = document.querySelector("[data-portrait] img");
      const b = i.getBoundingClientRect();
      // object-fit: contain, so the painted width is the smaller of the box
      // and the box height times the file's aspect.
      const painted = Math.min(b.width, b.height * (i.naturalWidth / i.naturalHeight));
      // With `w` descriptors `naturalWidth` is divided by the density the
      // browser picked the file for, so read the file's own width from a
      // bare Image of the same URL.
      const file = new Image();
      file.src = i.currentSrc;
      await file.decode();
      return { src: i.currentSrc.replace(location.origin, ""), natural: file.naturalWidth, css: painted };
    });
    const ratio = r.natural / (r.css * c.dpr);
    // `--shots <dir>`: the first screen at each case, to check the cut-out's
    // alpha and the ribbon over it survive whichever file was chosen.
    const shots = process.argv.indexOf("--shots");
    if (shots > -1 && c.dpr > 1) {
      await page.screenshot({ path: `${process.argv[shots + 1]}/density-${c.w}-at-${c.dpr}x.png` });
    }
    console.log(
      `${c.w}x${c.h} @${c.dpr}x  ${r.src.padEnd(26)} natural ${r.natural}px  painted ${r.css.toFixed(0)} CSS px  ` +
        `needs ${(r.css * c.dpr).toFixed(0)}  ratio ${ratio.toFixed(2)}`,
    );
    await ctx.close();
  }
} finally {
  await browser.close();
  stop();
}
