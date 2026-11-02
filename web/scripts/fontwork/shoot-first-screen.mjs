/*
 * The first screen as it ships, both languages, three windows.
 *
 * WHY THIS EXISTS
 * ---------------
 * Issues #100 and #101 asked for options, and this script used to shoot every
 * candidate so the owner could pick from renders rather than from prose. He
 * picked — PORTFOLIO in the `h1`, the ask in the start corner — and asked for
 * the end corner to become a light (issue #112's pull request). So it now
 * shoots the one design there is, and the renders under
 * `docs/hero-first-screen/` are the record of what the first screen looks
 * like, regenerated whenever its composition changes.
 *
 * WHAT IS SHOT
 * ------------
 * `first-screen-<lang>-<window>.png` — the settled screen, after the arrival,
 * with the light on its first phrase. That is also exactly what a reader with
 * motion off sees, because every off-switch lands on that same frame.
 *
 * `light-turning-<lang>-desktop.png` — the same window seven and a half
 * seconds later, partway through the rotation, so the second and third
 * phrases are on record and a render can show the lamp is not a static dot.
 *
 * HEBREW
 * ------
 * The locale switch is gated on `available`, which is false until the strings
 * exist, so the two attributes are written directly. That is exactly what
 * `applyLocale` does once the flag flips, reached a release early, and it has
 * to happen after mount because `useLocale`'s effect writes the default on the
 * first commit. There is no translation layer yet: what changes is the
 * direction and the three faces — which is what turned `5 LIVE` into
 * `LIVE 5` before issue #112, and what swaps the two corners.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, serve `dist` (`npx vite preview --port 4390`), then
 * `xvfb-run -a node scripts/fontwork/shoot-first-screen.mjs`. `BASE` points
 * it at another port. The `xvfb-run` is not optional on a box without a
 * display: headless Chromium there has no frame clock, so `page.screenshot`
 * waits for a frame that never comes and times out.
 *
 * At device pixel ratio 1 and not 2, which is the opposite of what
 * `build-shots.mjs` in this directory does and is deliberate: every question
 * these are asked — where a line breaks, where the corner blocks land, what
 * happens when the direction flips — is answered at 1x, and at 2x the set is
 * several megabytes of history for no answer it adds.
 *
 * WHERE PLAYWRIGHT COMES FROM
 * ---------------------------
 * From this project: `playwright-core` is a devDependency, pinned exactly.
 * This script used to import it from an absolute path into one machine's npx
 * cache — a path that exists on exactly one machine, and stops existing there
 * the day that cache is pruned (issue #112). `-core` and not `playwright`,
 * because the core package downloads no browser on install, so `npm ci` in
 * the Docker build and in CI does the same work it did before.
 *
 * The pin is also the browser contract. 1.64.1 drives Chromium build 1248
 * and looks for that build in the standard cache by itself; a different
 * version would look for a different build and refuse to launch rather than
 * quietly shoot with whatever is there. If it is missing,
 * `npx playwright-core install chromium-headless-shell` fetches the one this
 * pin wants — or set `CHROME` to any Chromium binary to use that instead.
 *
 * The other scripts in this directory still import from absolute paths. They
 * are one-off probes from the type work and are left as found; this is the
 * one a pull request asks the owner to be able to re-run.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../../docs/hero-first-screen");
const BASE = process.env.BASE ?? "http://127.0.0.1:4390";

mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  /* Where the owner was looking when he asked for something in the corners. */
  ["desktop", 1440, 900],
  /* The common phone, and the width the field line used to hold one row at
     by 6px. */
  ["phone", 390, 844],
  /* The narrowest window the layout is held to, added for issue #112: it is
     where the field line and the corners first run out of room, and a set
     shot only at 390 could not show either. 320x568 is the iPhone SE (1st
     generation), the smallest viewport still in circulation. */
  ["narrow", 320, 568],
];

const browser = await chromium.launch({
  /* `undefined` lets the pinned version find its own build. */
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

async function open(lang, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  if (lang === "he") {
    await page.evaluate(() => {
      document.documentElement.lang = "he";
      document.documentElement.dir = "rtl";
    });
  }
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  /* The corners' own rise is 180ms + 460ms after the last token. Still well
     inside the light's first 3.6s slot, so the phrase on screen is the one
     motion-off shows. */
  await page.waitForTimeout(1200);
  return page;
}

/*
 * Wait for the entry shutter to leave and the arrival to publish its last
 * token — by driving frames, not by waiting for them.
 *
 * Measured on the dev box, under `xvfb-run` as well as without it: no
 * `requestAnimationFrame` callback fires at all until something asks the
 * compositor for a frame, and the first screenshot a browser takes stalls
 * for about ten seconds before it gets one. The shutter leaves on a rAF, so
 * a fixed wait shot the first window of every run as a black frame. A
 * screenshot is the one request that reliably produces a frame, so this
 * takes throwaway ones until the page has moved on, and every frame it asks
 * for is a frame the page's own clocks would have had on a real screen.
 *
 * The shutter's class is a CSS module's, so it is matched by the name Vite
 * keeps inside the hash.
 */
async function settle(page) {
  for (let i = 0; i < 40; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    const done = await page.evaluate(
      () =>
        !document.querySelector('[class*="_shutter_"]') &&
        (document.body.dataset.heroArrived ?? "").split(" ").includes("text"),
    );
    if (done) return;
    await page.waitForTimeout(250);
  }
  throw new Error("the first screen never settled");
}

for (const lang of ["en", "he"]) {
  for (const [win, width, height] of WINDOWS) {
    const page = await open(lang, width, height);
    await page.screenshot({ path: `${OUT}/first-screen-${lang}-${win}.png` });
    if (win === "desktop") {
      /* 2.6s + 7.5s lands inside the third slot, clear of a cross-fade. */
      await page.waitForTimeout(7500);
      await page.screenshot({ path: `${OUT}/light-turning-${lang}-desktop.png` });
    }
    await page.close();
    console.log(`${lang}-${win}`);
  }
}

await browser.close();
