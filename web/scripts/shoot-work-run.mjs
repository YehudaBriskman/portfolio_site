/*
 * The work run (#57), a laptop and a phone.
 *
 * What it shoots, into `docs/work-run/`:
 *
 *   run-<w>x<h>-<nn>-<t>.png    the held frame at point t (0..1) of the
 *                               stage's contain range, then one frame after
 *                               the hold, on the way out
 *   run-<w>x<h>-back-<t>.png    the same point reached by scrolling UP from
 *                               the end — must match its forward frame
 *   run-<w>x<h>-focus.png       Tab to the third card from above the run
 *   run-<w>x<h>-reduced.png     prefers-reduced-motion: the plain list
 *   run-<w>x<h>-paused.png      body.motion-paused: the same plain list
 *
 * and prints the checks that are not pictures: the document's horizontal
 * overflow, whether the reverse frames are byte-identical to the forward
 * ones, and where the focused card landed.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4398 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-work-run.mjs`. Headless Chromium on this
 * box has almost no frame clock, so frames are driven by throwaway
 * screenshots and any wait polls on a timer (`{ polling: 500 }`), never on
 * rAF.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/work-run");
const BASE = process.env.BASE ?? "http://localhost:4398";
mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  [1440, 900],
  [390, 844],
];
const POINTS = [0, 0.12, 0.3, 0.5, 0.7, 0.88, 1];

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

async function frames(page, n = 3) {
  for (let i = 0; i < n; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(120);
  }
}

async function open(width, height, { reduced = false } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("[data-run-stage] a"), null, {
    polling: 500,
    timeout: 20000,
  });
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    const gone = await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'));
    if (gone) break;
  }
  return page;
}

async function toPoint(page, t) {
  const y = await page.evaluate((at) => {
    const stage = document.querySelector("[data-run-stage]");
    const top = stage.getBoundingClientRect().top + window.scrollY;
    return Math.round(top + (stage.offsetHeight - window.innerHeight) * at);
  }, t);
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await frames(page, 4);
  await page.waitForTimeout(600);
  await frames(page, 1);
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

for (const [w, h] of WINDOWS) {
  const tag = `${w}x${h}`;
  const page = await open(w, h);
  /* One pass through first, so every screenshot has loaded and faded in and
     a reverse frame differs from its forward frame only if the run does. */
  for (const t of POINTS) await toPoint(page, t);
  const forward = {};
  let n = 0;
  for (const t of POINTS) {
    await toPoint(page, t);
    const buf = await page.screenshot({ path: `${OUT}/run-${tag}-${String(n).padStart(2, "0")}-${t}.png` });
    forward[t] = buf;
    console.log(tag, "t", t, "x-overflow", await overflow(page));
    n += 1;
  }
  await toPoint(page, 1.25);
  await page.screenshot({ path: `${OUT}/run-${tag}-${String(n).padStart(2, "0")}-exit.png` });

  /* Back up: every point must reproduce its forward frame. */
  for (const t of [0.7, 0.3]) {
    await toPoint(page, t);
    const buf = await page.screenshot({ path: `${OUT}/run-${tag}-back-${t}.png` });
    console.log(tag, "reverse", t, buf.equals(forward[t]) ? "identical" : "DIFFERS");
  }

  /* Keyboard: from above the stage, Tab into the run and on to card 3. */
  await toPoint(page, -0.05);
  await page.focus('[data-run-stage] [data-run-i="0"] a');
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await frames(page, 4);
  const landed = await page.evaluate(() => {
    const a = document.activeElement;
    const r = a.getBoundingClientRect();
    return {
      name: a.querySelector("h3")?.textContent,
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      vw: window.innerWidth,
    };
  });
  console.log(tag, "focus", JSON.stringify(landed));
  await page.screenshot({ path: `${OUT}/run-${tag}-focus.png` });

  /* Pause, mid-hold: lands on the finished list, scrolled to the stage. */
  await page.evaluate(() => document.body.classList.add("motion-paused"));
  await page.evaluate(() =>
    document.querySelector("#work").scrollIntoView({ behavior: "instant", block: "start" })
  );
  await frames(page, 4);
  await page.screenshot({ path: `${OUT}/run-${tag}-paused.png` });
  console.log(tag, "paused x-overflow", await overflow(page));
  await page.close();

  const quiet = await open(w, h, { reduced: true });
  await quiet.evaluate(() =>
    document.querySelector("#work").scrollIntoView({ behavior: "instant", block: "start" })
  );
  await frames(quiet, 4);
  await quiet.screenshot({ path: `${OUT}/run-${tag}-reduced.png` });
  console.log(tag, "reduced x-overflow", await overflow(quiet));
  await quiet.close();
}

await browser.close();
