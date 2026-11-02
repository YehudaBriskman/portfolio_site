/*
 * The story page (#46, #158), both directions, a laptop and a phone.
 *
 * What it shoots, into `docs/story/`:
 *
 *   story-<lang>-<window>-<n>-<where>.png
 *
 * the opening, then the timeline at several depths — each with a beat's
 * lines part-way through being written, so the frame shows the pen mid-line —
 * and the close; plus reduced motion and Pause at the same depth, which must
 * both show the finished state (spine drawn, knots filled, plates uncovered,
 * every word at ink). The third switch, a browser without scroll-driven
 * animation, cannot be faked in Chromium — CSS `@supports` answers for the
 * engine — so it is held by the stylesheet tests instead.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4397 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-story.mjs`. `BASE` points it elsewhere.
 * `playwright-core` from this project's own pin, `xvfb-run` because headless
 * Chromium on a box with no display has almost no frame clock, and frames
 * driven by throwaway screenshots rather than waited for.
 *
 * HEBREW
 * ------
 * The locale is listed and disabled until the strings exist, so `lang` and
 * `dir` are written directly. The copy stays English; what is under test is
 * the direction (the spine moves to the right-hand edge) and the faces.
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
  await frames(page, 4);
}

/* Beat `id`'s lines with their top at `at` (0..1) of the window's height:
   about 0.7 puts the pen part-way through a two-line beat. */
async function toBeat(page, id, at = 0.7) {
  const y = await page.evaluate(
    ([sel, f]) => {
      const el = document.querySelector(`#${sel} [data-written]`);
      return el.getBoundingClientRect().top + window.scrollY - window.innerHeight * f;
    },
    [id, at],
  );
  await scrollTo(page, y);
}

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name);
}

const ids = await (async () => {
  const page = await open("en", 1440, 900);
  const list = await page.evaluate(() => [...document.querySelectorAll("ol[aria-label='Timeline'] > li")].map((l) => l.id));
  await page.close();
  return list;
})();
const picks = [ids[0], ids[2], ids[Math.floor(ids.length / 2) + 1], ids.at(-1)];

for (const lang of ["en", "he"]) {
  for (const [win, width, height] of WINDOWS) {
    const at = (n, where) => `story-${lang}-${win}-${n}-${where}`;
    const page = await open(lang, width, height);
    await shoot(page, at(0, "opening"));
    for (const [i, id] of picks.entries()) {
      await toBeat(page, id);
      await shoot(page, at(i + 1, id));
    }
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await frames(page, 4);
    await shoot(page, at(picks.length + 1, "close"));
    await page.close();
  }
}

/* The off-switches, at a depth where the pen is mid-line with motion on. */
const DEPTH = picks[1];
for (const [name, opts, before] of [
  ["reduced", { reduced: true }, null],
  ["paused", {}, () => document.body.classList.add("motion-paused")],
]) {
  const page = await open("en", 1440, 900, opts);
  if (before) await page.evaluate(before);
  await toBeat(page, DEPTH);
  await shoot(page, `story-en-desktop-off-${name}`);
  await page.close();
}

await browser.close();
