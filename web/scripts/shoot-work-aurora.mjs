/*
 * The aurora along the work run (#181, #192), a laptop and a phone, English
 * and Hebrew.
 *
 * What it shoots, into `docs/work-run/`:
 *
 *   aurora-<w>x<h>[-he]-<t>.png   the held frame at point t of the stage's
 *                                 contain range
 *   aurora-<w>x<h>[-he]-sweep-<t> the ribbon sweeping in from the reading
 *                                 end as the stage comes up (t < 0: before
 *                                 the frame pins), and the same depth again
 *                                 reached by scrolling back up (`-back`)
 *   aurora-<w>x<h>-reduced.png    prefers-reduced-motion: the still ribbon
 *                                 down the plain list
 *   aurora-<w>x<h>-paused.png     body.motion-paused: the same
 *
 * and prints the checks that are not pictures: how far each card on screen
 * stands from the drawn line (its slot's centre against the curve the
 * stylesheet boxes, read off the live layout), whether the frame reached by
 * scrolling back is byte-identical to the one reached going forward, and
 * the document's horizontal overflow.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4398 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-work-aurora.mjs`. Headless Chromium on
 * this box has almost no frame clock, so frames are driven by throwaway
 * screenshots and waits poll on a timer, never on rAF.
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
const POINTS = [0.15, 0.5, 0.85];
/* Before the pin: the ribbon is sweeping in (#192). */
const SWEEP = [-0.22, -0.12, -0.04];

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

async function open(width, height, { rtl = false, reduced = false } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  if (rtl) {
    await page.evaluate(() => {
      document.documentElement.dir = "rtl";
      document.documentElement.lang = "he";
    });
  }
  await page.waitForFunction(
    () => document.querySelector("[data-run-stage] a"),
    null,
    {
      polling: 500,
      timeout: 20000,
    },
  );
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    const gone = await page.evaluate(
      () => !document.querySelector('[class*="_shutter_"]'),
    );
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
  await page.evaluate(
    (top) => window.scrollTo({ top, behavior: "instant" }),
    y,
  );
  await frames(page, 4);
  await page.waitForTimeout(500);
  await frames(page, 1);
}

/* The worst distance, in px, from a card's centre on screen to the line as
   drawn: the curve's box is read from the live SVG, the height from the
   same sine the path is. */
async function offLine(page) {
  return page.evaluate(() => {
    const svg = document
      .querySelector("[data-run-aurora] svg[viewBox]")
      .getBoundingClientRect();
    const rtl = document.documentElement.dir === "rtl";
    let worst = 0;
    for (const li of document.querySelectorAll("li[data-run-i]")) {
      const r = li.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 0 || cx > window.innerWidth) continue;
      let u = (cx - svg.left) / svg.width;
      if (rtl) u = 1 - u;
      const y = svg.top + svg.height * (0.5 - 0.5 * Math.sin(2 * Math.PI * u));
      worst = Math.max(worst, Math.abs(y - cy));
    }
    return worst.toFixed(2);
  });
}

function below(w, h) {
  return { x: 0, y: 56, width: w, height: h - 56 };
}

for (const rtl of [false, true]) {
  for (const [w, h] of WINDOWS) {
    const tag = `${w}x${h}${rtl ? "-he" : ""}`;
    const page = await open(w, h, { rtl });
    for (const t of SWEEP) {
      await toPoint(page, t);
      await page.screenshot({ path: `${OUT}/aurora-${tag}-sweep-${t}.png` });
      console.log(tag, "sweep", t, await page.evaluate(sweepAt));
    }
    await toPoint(page, 0.3);
    await toPoint(page, -0.12);
    await page.screenshot({ path: `${OUT}/aurora-${tag}-sweep--0.12-back.png` });
    console.log(tag, "sweep back -0.12", await page.evaluate(sweepAt));
    for (const t of POINTS) await toPoint(page, t);
    const forward = {};
    for (const t of POINTS) {
      await toPoint(page, t);
      await page.screenshot({ path: `${OUT}/aurora-${tag}-${t}.png` });
      forward[t] = await page.screenshot({ clip: below(w, h) });
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      console.log(
        tag,
        "t",
        t,
        "card off the line (px)",
        await offLine(page),
        "x-overflow",
        over,
      );
    }
    await toPoint(page, 0.85);
    await toPoint(page, 0.5);
    const back = await page.screenshot({ clip: below(w, h) });
    console.log(
      tag,
      "reverse 0.5",
      back.equals(forward[0.5]) ? "identical" : "DIFFERS",
    );
    await page.close();
  }
}

for (const [w, h] of WINDOWS) {
  const reduced = await open(w, h, { reduced: true });
  await toPoint(reduced, 0.1);
  await reduced.screenshot({ path: `${OUT}/aurora-${w}x${h}-reduced.png` });
  console.log(`${w}x${h}`, "reduced", await reduced.evaluate(stillState));
  await reduced.close();

  const paused = await open(w, h);
  await paused.evaluate(() => document.body.classList.add("motion-paused"));
  await toPoint(paused, 0.1);
  await paused.screenshot({ path: `${OUT}/aurora-${w}x${h}-paused.png` });
  console.log(`${w}x${h}`, "paused", await paused.evaluate(stillState));
  await paused.close();
}

/* How far in the ribbon's window is: 0 off the frame, 1 home. */
function sweepAt() {
  const s = document.querySelector("[data-run-sweep]");
  const m = new DOMMatrix(getComputedStyle(s).transform);
  const w = s.parentElement.getBoundingClientRect().width;
  return (1 - Math.abs(m.m41) / (1.3 * w)).toFixed(3);
}

function stillState() {
  const a = document.querySelector("[data-run-aurora]");
  const ribbon = getComputedStyle(a, "::before");
  const sweep = a.querySelector("[data-run-sweep]");
  return {
    ribbon: ribbon.content !== "none" && ribbon.content !== "normal",
    ribbonHeight: Math.round(a.getBoundingClientRect().height),
    sweep: getComputedStyle(sweep).display,
  };
}

await browser.close();
