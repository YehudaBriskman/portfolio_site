/*
 * The story page (#46), both languages, a laptop and a phone.
 *
 * What it shoots, into `docs/story/`:
 *
 *   story-<lang>-<window>-<n>-<beat>.png
 *
 * one frame per beat of the ledger at the head of `pages/Story.tsx` — the
 * opening, each chapter with its head near the top of the window, the peak
 * twice (part-way through its ink, and arrived while still held), and the
 * close — plus `paused` and `reduced` frames of the peak mid-run, which must
 * be identical to its arrived frame: every off-switch lands on arrived.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4397 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-story.mjs`. `BASE` points it elsewhere.
 * Same harness notes as `fontwork/shoot-first-screen.mjs`, which this
 * follows: `playwright-core` from this project's own pin, `xvfb-run`
 * because headless Chromium on a box with no display has almost no frame
 * clock, and frames driven by throwaway screenshots rather than waited for —
 * an IntersectionObserver reports on a frame, so a rail that is never given
 * one never moves.
 *
 * HEBREW
 * ------
 * As in that script: the locale is listed and disabled until the strings
 * exist, so `lang` and `dir` are written directly — what `applyLocale` will
 * do once it is enabled. The copy stays English; what is under test is the
 * direction (the rail moves to the right-hand edge, the peak's ink travels
 * right to left) and the Hebrew faces.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/story");
const BASE = process.env.BASE ?? "http://127.0.0.1:4397";

mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

/* Ask for frames until the page has had enough of them to settle. */
async function frames(page, n = 4) {
  for (let i = 0; i < n; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function open(lang, width, height, { reduced = false } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto(`${BASE}/story`, { waitUntil: "load" });
  if (lang === "he") {
    await page.evaluate(() => {
      document.documentElement.lang = "he";
      document.documentElement.dir = "rtl";
    });
  }
  await page.evaluate(() => document.fonts.ready);
  /* The entry shutter leaves on a frame; drive frames until it has gone. */
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    const gone = await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'));
    if (gone) break;
  }
  await frames(page, 4);
  return page;
}

async function scrollTo(page, y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  /* Flow's and Rise's arrivals are 620ms plus a stagger; the count is 1.2s. */
  await frames(page, 6);
  await page.waitForTimeout(900);
  await frames(page, 2);
}

/* A chapter with its head 96px under the top of the window, clear of the bar. */
async function toChapter(page, selector) {
  const y = await page.evaluate(
    (sel) => document.querySelector(sel).getBoundingClientRect().top + window.scrollY - 96,
    selector,
  );
  await scrollTo(page, y);
}

/* A point `t` (0..1) through the peak's `contain` range: the run's top at the
   window's top, to its bottom at the window's bottom. */
async function toPeak(page, t) {
  const y = await page.evaluate((at) => {
    const run = document.querySelector('[class*="_peakRun_"]');
    const top = run.getBoundingClientRect().top + window.scrollY;
    return top + (run.offsetHeight - window.innerHeight) * at;
  }, t);
  await scrollTo(page, y);
}

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name);
}

for (const lang of ["en", "he"]) {
  for (const [win, width, height] of WINDOWS) {
    const at = (n, beat) => `story-${lang}-${win}-${n}-${beat}`;
    const page = await open(lang, width, height);
    await shoot(page, at(0, "opening"));
    await toChapter(page, "#before");
    await shoot(page, at(1, "before"));
    await toChapter(page, "#y2024");
    await shoot(page, at(2, "y2024"));
    await toChapter(page, "#y2025");
    await shoot(page, at(3, "y2025"));
    await toChapter(page, "#y2026");
    await shoot(page, at(4, "peak-head"));
    await toPeak(page, 0.25);
    await shoot(page, at(4, "peak-inking"));
    await toPeak(page, 0.75);
    await shoot(page, at(4, "peak-arrived"));
    await toChapter(page, "#now");
    await shoot(page, at(5, "now"));
    await toChapter(page, "#close-title");
    await shoot(page, at(6, "close"));
    await page.close();
  }
}

/* The off-switches, on the one device that is this page's own and
   progress-driven. Mid-ink, where an exit that landed on the first frame
   rather than the last would show. */
{
  const page = await open("en", 1440, 900, { reduced: true });
  await toPeak(page, 0.25);
  await shoot(page, "story-en-desktop-off-reduced");
  await page.close();
}
{
  const page = await open("en", 1440, 900);
  await page.evaluate(() => document.body.classList.add("motion-paused"));
  await toPeak(page, 0.25);
  await shoot(page, "story-en-desktop-off-paused");
  await page.close();
}

await browser.close();
