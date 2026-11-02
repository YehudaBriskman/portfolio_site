/*
 * The catalogue's gallery wall (#175), a laptop and a phone, both directions.
 *
 * What it shoots, into `docs/projects-gallery/`:
 *
 *   <set>-<lang>-<w>x<h>-0N.png        scrolled down: 01 the panel coming up
 *                                      and drawing, 02 the wall's first band
 *                                      arriving, 03 deep in the wall
 *   <set>-<lang>-<w>x<h>-settled.png   offset 02 with Pause pressed: the plain
 *                                      wall and the drawn chart
 *   many-<lang>-<w>x<h>-filtered.png   ?state=Archive&stack=Python
 *   many-<lang>-<w>x<h>-empty.png      three filters that match nothing
 *
 * `<set>` is `seed` (the six real projects, the API answering with nothing)
 * or `many` (the six plus twenty mocked through `page.route`, never written
 * to the data). `he` is the document set to `dir="rtl" lang="he"`.
 *
 * It prints what is not a picture: page height, horizontal overflow, and
 * whether each offset paints the same pixels reached scrolling up as it did
 * scrolling down — the arrival and the chart are scrubbed, so they must. The
 * top 80px (the bar, which tucks and returns) are cropped off that
 * comparison.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4399 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-projects-gallery.mjs`. Headless Chromium on
 * this box has almost no frame clock: frames are driven by throwaway
 * screenshots, and waits poll on a timer (`{ polling: 500 }`), never on rAF.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/projects-gallery");
const BASE = process.env.BASE ?? "http://localhost:4399";
mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  [1440, 900],
  [390, 844],
];

const STATES = ["Live", "In use", "Archive", "v2.1.0", "Live", "Archive"];
const STACKS = ["TypeScript", "Go", "Python", "Rust", "React", "Postgres"];

/* Twenty made-up collections. Some with a release (whose tag becomes the
   state), all with a push date (whose year becomes the year) and a language
   (which becomes the stack), none with a screenshot, so every one exercises
   the swatch. Three are ordered into the featured band. */
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
        "A long tagline that keeps going to check that the tile clamps cleanly rather than pushing the caption out of its box",
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

/* Frames until two reads of every tile's and bar's transform agree, so a
   picture is never of a timeline that has not caught up with the scroll. */
async function settle(page) {
  let prev = "";
  for (let k = 0; k < 12; k += 1) {
    const now = await page.evaluate(() =>
      [...document.querySelectorAll("main article, main li span span")]
        .map((e) => getComputedStyle(e).transform)
        .join()
    );
    if (now === prev) return;
    prev = now;
    await frames(page, 2);
  }
}

async function open(set, lang, [width, height], query = "") {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.route("**/api/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    const ok = path === "/api/blog/collections";
    return r.fulfill({
      status: ok ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(ok ? { items: set === "many" ? many() : [] } : {}),
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
       loading once something is painted in them. */
    await frames(page, 2);
  }
  await page.waitForFunction(
    (n) => document.querySelectorAll("main a[href^='/projects/']").length >= n,
    query ? 0 : set === "many" ? 26 : 6,
    { polling: 500, timeout: 30000 }
  );
  /* The mocked set lands after the seeds; wait for its last tile. */
  if (set === "many") {
    await page.waitForFunction(() => document.querySelector("a[href='/projects/fixture-20']") || location.search, null, {
      polling: 500,
      timeout: 30000,
    });
  }
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(
      () =>
        [...document.images]
          .filter((im) => im.getBoundingClientRect().top < window.innerHeight * 3)
          .every((im) => im.complete),
      null,
      { polling: 500, timeout: 10000 }
    )
    .catch(() => {});
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
  }
  /* The header's own arrival is on a clock; let it finish before the first
     picture, or offset 01 is compared against a page still arriving. */
  await frames(page, 10);
  return { page, context };
}

async function scrollTo(page, y) {
  await page.evaluate((to) => window.scrollTo(0, to), y);
  await frames(page, 3);
  await settle(page);
}

const report = [];

for (const set of ["seed", "many"]) {
  for (const lang of ["en", "he"]) {
    for (const win of WINDOWS) {
      const tag = `${set}-${lang}-${win[0]}x${win[1]}`;
      const { page, context } = await open(set, lang, win);
      const geo = await page.evaluate(() => {
        const top = (sel) => document.querySelector(sel).getBoundingClientRect().top + window.scrollY;
        return {
          max: document.documentElement.scrollHeight - window.innerHeight,
          panel: top("[data-chrome='dark']"),
          wall: top("main ol[aria-label]"),
        };
      });
      const stops = [
        Math.max(0, Math.round(geo.panel - win[1] * 0.7)),
        Math.min(geo.max, Math.round(geo.wall - win[1] * 0.6)),
        Math.round(geo.max * 0.8),
      ];
      const clip = { x: 0, y: 80, width: win[0], height: win[1] - 80 };
      /* One pass to the foot and back first, so every clock-driven arrival on
         the page (the header's, the bar's) has finished and the comparison is
         of scroll position alone. Offset 01 is then still reached going down. */
      await scrollTo(page, geo.max);
      await scrollTo(page, 0);
      const down = [];
      for (const [i, y] of stops.entries()) {
        await scrollTo(page, y);
        await page.screenshot({ path: `${OUT}/${tag}-${String(i + 1).padStart(2, "0")}.png` });
        down[i] = await page.screenshot({ clip });
      }
      let same = 0;
      const differ = [];
      for (let i = stops.length - 1; i >= 0; i -= 1) {
        await scrollTo(page, stops[i] + 400);
        await scrollTo(page, stops[i]);
        if (Buffer.compare(down[i], await page.screenshot({ clip })) === 0) same += 1;
        else differ.push(i + 1);
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      await scrollTo(page, stops[1]);
      await page.evaluate(() => document.body.classList.add("motion-paused"));
      await frames(page, 2);
      await page.screenshot({ path: `${OUT}/${tag}-settled.png` });
      await context.close();
      report.push({ tag, pageHeight: geo.max + win[1], overflow, reverseIdentical: `${same}/${stops.length}`, differ: differ.join() });
    }
  }
}

const QUERIES = {
  filtered: "?state=Archive&stack=Python",
  empty: "?state=In%20use&year=2019&stack=Rust",
};
for (const lang of ["en", "he"]) {
  for (const win of WINDOWS) {
    for (const [name, q] of Object.entries(QUERIES)) {
      const { page, context } = await open("many", lang, win, q);
      const y = await page.evaluate(
        () =>
          document.querySelector("nav[aria-label='Filter projects']").getBoundingClientRect().top +
          window.scrollY -
          90
      );
      await scrollTo(page, y);
      const tiles = await page.evaluate(() => document.querySelectorAll("main a[href^='/projects/']").length);
      await page.screenshot({ path: `${OUT}/many-${lang}-${win[0]}x${win[1]}-${name}.png` });
      await context.close();
      report.push({ tag: `many-${lang}-${win[0]}x${win[1]}-${name}`, tiles });
    }
  }
}

await browser.close();
console.table(report);
