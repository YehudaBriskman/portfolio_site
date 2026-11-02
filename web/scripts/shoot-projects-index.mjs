/*
 * The catalogue's register (#169), a laptop and a phone, both directions.
 *
 * What it shoots, into `docs/projects-index/`:
 *
 *   <set>-<lang>-<w>x<h>-down-<nn>.png   scrolled down, at 0%, 40% and 80%
 *   <set>-<lang>-<w>x<h>-up-02.png       the 40% offset reached scrolling UP
 *   <set>-<lang>-<w>x<h>-reduced.png     prefers-reduced-motion: the plain list
 *   <set>-<lang>-<w>x<h>-paused.png      body.motion-paused: the same list
 *   many-en-<w>x<h>-filtered.png         ?state=… with the filter showing
 *
 * `<set>` is `seed` (the real table, the API answering with no collections)
 * or `many` (twenty collections mocked in the browser through `page.route`,
 * never written to the data). `<lang>` `he` is the document set to
 * `dir="rtl" lang="he"`, which is all the site's Hebrew does today.
 *
 * And prints the checks that are not pictures: horizontal overflow, and
 * whether each up-frame is byte-identical to its down-frame — the riffle is
 * scrubbed, so the same offset must paint the same picture from either side.
 * The bar tucks on the way down and returns on the way up, so the comparison
 * crops the top 80px off.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4399 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-projects-index.mjs`. Headless Chromium on
 * this box has almost no frame clock: frames are driven by throwaway
 * screenshots and waits poll on a timer (`{ polling: 500 }`), never on rAF.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/projects-index");
const BASE = process.env.BASE ?? "http://localhost:4399";
mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  [1440, 900],
  [390, 844],
];

/* Six offsets are compared both ways; three are kept going down and one
   coming back up, which is the proof — the rest would be 12MB of repeats. */
const SAVE_DOWN = new Set([0, 2, 4]);
const SAVE_UP = new Set([2]);

const STATES = ["Live", "In use", "Archive", "v2.1.0", "Live", "Archive"];
const STACKS = ["TypeScript", "Go", "Python", "Rust", "React", "Postgres"];

/* Twenty made-up collections. Some with a release (whose tag becomes the
   state), some with a push date (whose year becomes the year), none with a
   screenshot, so every row exercises the swatch. */
function many() {
  return Array.from({ length: 20 }, (_, i) => {
    const release = STATES[i % STATES.length].startsWith("v");
    return {
      slug: `fixture-${i + 1}`,
      title: `${["Harbor", "Lantern", "Quarry", "Meridian", "Tidewater"][i % 5]} ${i + 1}`,
      tagline: [
        "A small tool that does one thing",
        "Scheduling for a team that never agreed on a calendar",
        "An index of every log line, searchable in under a second",
        "A long tagline that keeps going to check that the row wraps cleanly rather than pushing the state column out of its track",
      ][i % 4],
      description: "Fixture.",
      coverImage: null,
      links: [],
      order: i < 3 ? 12 + i : 60 + i,
      kind: "project",
      repoUrl: null,
      stats: {
        stars: null,
        language: STACKS[i % STACKS.length],
        license: null,
        pushedAt: `${2019 + (i % 7)}-0${1 + (i % 9)}-15T00:00:00Z`,
        latestRelease: release ? { tag: "v2.1.0", url: "https://example.com", publishedAt: null } : null,
      },
    };
  });
}

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

async function open(set, lang, [width, height], { reduced = false, query = "" } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await context.route("**/api/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    const body =
      path === "/api/blog/collections" ? { items: set === "many" ? many() : [] } : {};
    return r.fulfill({
      status: path === "/api/blog/collections" ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(`${BASE}/projects${query}`, { waitUntil: "load" });
  if (lang === "he") {
    await page.evaluate(() => {
      document.documentElement.lang = "he";
      document.documentElement.dir = "rtl";
    });
    /* `lang="he"` swaps the type to the Hebrew faces, which only start
       loading once something is painted in them; `fonts.ready` below is only
       worth awaiting after that paint. */
    await frames(page, 2);
  }
  await page.waitForFunction(
    (n) => document.querySelectorAll("main ol > li").length >= n,
    query ? 1 : set === "many" ? 20 : 6,
    { polling: 500, timeout: 20000 }
  );
  await page.evaluate(() => document.fonts.ready);
  /* A screenshot still decoding on the first frame is not the riffle, and
     would fail the reverse comparison for a reason that has nothing to do
     with scroll. */
  await page
    .waitForFunction(
      () =>
        [...document.images]
          .filter((im) => im.getBoundingClientRect().top < window.innerHeight)
          .every((im) => im.complete),
      null,
      { polling: 500, timeout: 10000 }
    )
    .catch(() => {});
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    const gone = await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'));
    if (gone) break;
  }
  return { page, context };
}

async function scrollTo(page, y) {
  await page.evaluate((to) => window.scrollTo(0, to), y);
  await frames(page, 3);
}

const report = [];

for (const set of ["seed", "many"]) {
  for (const lang of ["en", "he"]) {
    for (const win of WINDOWS) {
      const tag = `${set}-${lang}-${win[0]}x${win[1]}`;
      const { page, context } = await open(set, lang, win);
      const max = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight
      );
      const stops = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => Math.round(max * t));
      const clip = { x: 0, y: 80, width: win[0], height: win[1] - 80 };
      const down = [];
      for (const [i, y] of stops.entries()) {
        await scrollTo(page, y);
        if (SAVE_DOWN.has(i)) {
          await page.screenshot({ path: `${OUT}/${tag}-down-${String(i).padStart(2, "0")}.png` });
        }
        down[i] = await page.screenshot({ clip });
      }
      let same = 0;
      for (let i = stops.length - 1; i >= 0; i -= 1) {
        await scrollTo(page, stops[i]);
        if (SAVE_UP.has(i)) {
          await page.screenshot({ path: `${OUT}/${tag}-up-${String(i).padStart(2, "0")}.png` });
        }
        if (Buffer.compare(down[i], await page.screenshot({ clip })) === 0) same += 1;
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );

      await scrollTo(page, stops[2]);
      await page.evaluate(() => document.body.classList.add("motion-paused"));
      await frames(page, 2);
      await page.screenshot({ path: `${OUT}/${tag}-paused.png` });
      await context.close();

      const r = await open(set, lang, win, { reduced: true });
      await scrollTo(r.page, stops[2]);
      await r.page.screenshot({ path: `${OUT}/${tag}-reduced.png` });
      await r.context.close();

      report.push({ tag, pageHeight: max + win[1], overflow, reverseIdentical: `${same}/${stops.length}` });
    }
  }
}

for (const win of WINDOWS) {
  const { page, context } = await open("many", "en", win, { query: "?state=Archive" });
  await scrollTo(page, 0);
  await page.screenshot({ path: `${OUT}/many-en-${win[0]}x${win[1]}-filtered.png` });
  await context.close();
}

await browser.close();
console.table(report);
