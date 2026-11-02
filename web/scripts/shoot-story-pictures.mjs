/*
 * The story's pictures arriving (#195), both directions, a laptop and a phone.
 *
 * What it shoots, into `docs/story-pictures/`:
 *
 *   pictures-<lang>-<window>-<n>-<where>.png
 *
 * one beat's plate at the start, the middle and the end of its arrival — the
 * plate's top at 9.5%, 27.5% and 50% of the window above its foot, which is
 * its `animation-range` of `cover 5vh cover 50vh` at progress 0.1, ½ and 1 — then
 * the middle again with a real photograph put in the empty card (the same
 * box, so the same arrival), and on the laptop the middle under reduced
 * motion and under Pause, which must both show the whole plate.
 *
 * It also prints, for each frame, the plate's computed `clip-path`, so the
 * side the plate opens from can be read without the picture: in English a
 * start-side plate closes its right inset, in Hebrew its left.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4397 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-story-pictures.mjs`. `BASE` points it
 * elsewhere. Headless Chromium here has almost no frame clock, so frames are
 * driven by throwaway screenshots, and any wait polls by hand.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/story-pictures");
const BASE = process.env.BASE ?? "http://127.0.0.1:4397";
/* A picture that ships with the site, standing in for a beat's photograph. */
const PHOTO = "/og.png";

mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

async function frames(page, n = 4) {
  for (let i = 0; i < n; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function open(lang, width, height, { reduced = false, paused = false } = {}) {
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
  if (paused) await page.evaluate(() => document.body.classList.add("motion-paused"));
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
  }
  await frames(page, 2);
  return page;
}

/* The third beat: far enough down that nothing above it is still arriving. */
const PICK = 2;

/* Put the plate's top at `p` of the way through its arrival range. */
async function toProgress(page, p) {
  const y = await page.evaluate(
    ([i, prog]) => {
      const beat = document.querySelectorAll("ol[aria-label='Timeline'] > li[data-side]")[i];
      const plate = beat.lastElementChild;
      const top = plate.getBoundingClientRect().top + window.scrollY;
      const fromFoot = innerHeight * (0.05 + 0.45 * prog);
      return top - (innerHeight - fromFoot);
    },
    [PICK, p],
  );
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await frames(page, 4);
}

async function shoot(page, name) {
  const info = await page.evaluate((i) => {
    const beat = document.querySelectorAll("ol[aria-label='Timeline'] > li[data-side]")[i];
    return `${beat.dataset.side} ${getComputedStyle(beat.lastElementChild).clipPath}`;
  }, PICK);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name.padEnd(42), info);
}

async function givePhoto(page) {
  await page.evaluate(
    ([i, src]) => {
      const plate = document.querySelectorAll("ol[aria-label='Timeline'] > li[data-side]")[i].lastElementChild;
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.style.cssText = "display:block;width:100%;height:100%;object-fit:cover";
      plate.append(img);
    },
    [PICK, PHOTO],
  );
  await page.waitForFunction(() => [...document.images].every((im) => im.complete), null, { polling: 500, timeout: 20000 });
  await frames(page, 2);
}

for (const lang of ["en", "he"]) {
  for (const [win, width, height] of WINDOWS) {
    const at = (n, where) => `pictures-${lang}-${win}-${n}-${where}`;
    const page = await open(lang, width, height);
    await toProgress(page, 0.1);
    await shoot(page, at(1, "start"));
    await toProgress(page, 0.5);
    await shoot(page, at(2, "mid"));
    await toProgress(page, 1);
    await shoot(page, at(3, "end"));
    await givePhoto(page);
    await toProgress(page, 0.5);
    await shoot(page, at(4, "mid-photo"));
    /* Back up past the start: the arrival runs backwards to the strip. */
    await toProgress(page, 0);
    await shoot(page, at(5, "start-again"));
    await page.close();

    if (win === "desktop") {
      for (const [where, opts] of [
        ["off-reduced", { reduced: true }],
        ["off-paused", { paused: true }],
      ]) {
        const p = await open(lang, width, height, opts);
        await toProgress(p, 0.5);
        await shoot(p, at(6, where));
        await p.close();
      }
    }
  }
}

await browser.close();
