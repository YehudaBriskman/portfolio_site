/*
 * The living line (#176, #178, #191): /story and the home page's "How I
 * work", both directions, a laptop and a phone.
 *
 * What it shoots, into `docs/line/`:
 *
 *   story-<lang>-<window>-<n>-<where>.png
 *   approach-<lang>-<window>-<n>-<where>.png
 *
 * at several depths: the line's start (on /story the seed dot, on the
 * home page the work run's centre as the frame lets go, with the line
 * flowing out of the stage), a section-to-section turn, each page's first
 * loop with the window's middle — the line's tip — on the circle's centre,
 * so the loop is caught half drawn, and a turn reached again by scrolling
 * back up; then reduced motion and Pause at that same depth, which must
 * both show the whole line drawn. The third switch (no `animation-timeline`)
 * cannot be faked in Chromium and is held by the stylesheet tests.
 *
 * It also prints, per shot, how much of the line is drawn (1 − the computed
 * `stroke-dashoffset`), and checks the geometry rule the line exists under:
 * no point of any strand of the ribbon inside any text box on the page —
 * the section's own, and on the home page the work section's too, which the
 * line runs out of (the cards excepted: the line is behind them). A
 * crossing fails the run.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4561 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-line.mjs`. `BASE` points it elsewhere.
 * Frames are driven by throwaway screenshots (this box's headless Chromium
 * has almost no frame clock), and every wait polls at 500ms.
 *
 * HEBREW: the locale is listed and disabled until the strings exist, so
 * `lang` and `dir` are written directly. The interlude words have Hebrew of
 * their own; the rest of the copy stays English.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/line");
const BASE = process.env.BASE ?? "http://127.0.0.1:4561";
const ONLY = process.env.ONLY; // "story" | "approach"

mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--font-render-hinting=none"] });

async function frames(page, n = 4) {
  for (let i = 0; i < n; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function open(route, ready, lang, width, height, { reduced = false } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto(`${BASE}${route}`, { waitUntil: "load" });
  await page.waitForFunction((sel) => document.querySelector(sel), ready, { polling: 500, timeout: 30000 });
  if (lang === "he") {
    await page.evaluate(() => {
      document.documentElement.lang = "he";
      document.documentElement.dir = "rtl";
    });
  }
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
  }
  await frames(page, 4);
  return page;
}

async function scrollTo(page, y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await frames(page, 4);
}

/* Put the element's point at `f` of its height, plus `dy` px, on the window's middle line. */
async function centre(page, sel, f = 0.5, dy = 0) {
  const y = await page.evaluate(
    ([s, k, d]) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return r.top + window.scrollY + r.height * k + d - window.innerHeight / 2;
    },
    [sel, f, dy],
  );
  await scrollTo(page, y);
}

/* How much of the line is drawn, and whether any of it runs through text. */
async function probe(page, scope, also) {
  return page.evaluate(([sc, more]) => {
    const root = document.querySelector(`${sc} [data-living-line]`);
    const ink = root.querySelector("[data-strand]");
    const off = parseFloat(getComputedStyle(ink).strokeDashoffset);
    const base = root.getBoundingClientRect();
    const boxes = [];
    const texts = [...root.querySelectorAll("h1,h2,h3,p,dt,dd,a")];
    if (more) texts.push(...document.querySelectorAll(`${more} :is(h1,h2,h3,p,dt,dd,a)`));
    for (const el of texts) {
      if (el.closest("svg") || el.closest("[data-run-stage]")) continue;
      for (const r of el.getClientRects()) {
        if (r.width && r.height) boxes.push([r.left - base.left, r.top - base.top, r.right - base.left, r.bottom - base.top, el.textContent.slice(0, 24)]);
      }
    }
    const hits = [];
    for (const path of root.querySelectorAll("[data-strand]")) {
      if (!path.getAttribute("d")) continue;
      const len = path.getTotalLength();
      for (let s = 0; s <= len; s += 4) {
        const p = path.getPointAtLength(s);
        for (const [l, t, r, b, txt] of boxes) {
          if (p.x > l + 1 && p.x < r - 1 && p.y > t + 1 && p.y < b - 1) hits.push(`${Math.round(p.x)},${Math.round(p.y)} in "${txt}"`);
        }
      }
    }
    return { drawn: Math.round((1 - off) * 1000) / 1000, hits: [...new Set(hits)].slice(0, 5) };
  }, [scope, also ?? null]);
}

let failed = false;
async function shoot(page, scope, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const { drawn, hits } = await probe(page, scope, PAGES[name.split("-")[0]]?.also);
  console.log(`${name}  drawn=${drawn}${hits.length ? `  CROSSES ${hits.join("; ")}` : ""}`);
  if (hits.length) failed = true;
}

const LOOP = "[data-line*='circle-around']";
const END = `[data-line*='"end"']`;

const PAGES = {
  story: {
    route: "/story",
    ready: `ol[aria-label='Timeline'] ${LOOP}`,
    scope: "[data-page='story']",
    async walk(page, at) {
      await shoot(page, this.scope, at(0, "opening"));
      await centre(page, "[data-page='story'] [data-line*='origin']", 0.5, 40);
      await shoot(page, this.scope, at(1, "seed"));
      await centre(page, "#start-2021 [data-written]", 0.5);
      await shoot(page, this.scope, at(2, "first-beat"));
      await centre(page, "#icaros", 0.0, -60);
      await shoot(page, this.scope, at(3, "turn"));
      await centre(page, `#loop-open ${LOOP}`, 0.5);
      await shoot(page, this.scope, at(4, "loop-mid-draw"));
      await centre(page, `#loop-open ${LOOP}`, 1.1);
      await shoot(page, this.scope, at(5, "loop-drawn"));
      await centre(page, "#bothy", 0.6);
      await shoot(page, this.scope, at(6, "overlap"));
      await centre(page, `#loop-team ${LOOP}`, 0.5);
      await shoot(page, this.scope, at(7, "last-loop-mid-draw"));
      await centre(page, "#now", 0.9);
      await shoot(page, this.scope, at(8, "now"));
      await centre(page, "#icaros", 0.0, -60);
      await shoot(page, this.scope, at(9, "turn-back-up"));
    },
    depth: [`#loop-open ${LOOP}`, 0.5],
  },
  approach: {
    route: "/",
    ready: "#approach h3",
    scope: "#approach",
    also: "#work",
    async walk(page, at) {
      await centre(page, "[data-line-origin='approach-strand']", 0, 4);
      await shoot(page, this.scope, at(0, "start"));
      await centre(page, "[data-line-origin='approach-strand']", 0, 160);
      await shoot(page, this.scope, at(1, "off-the-strand"));
      await centre(page, "#approach header", 0.0, -40);
      await shoot(page, this.scope, at(2, "into-the-head"));
      await centre(page, `#approach ${END}`, 0.0, -50);
      await shoot(page, this.scope, at(3, "turn"));
      await centre(page, `#approach ${LOOP}`, 0.5);
      await shoot(page, this.scope, at(4, "loop-mid-draw"));
      await centre(page, "#approach [data-line-hold]", 1.0);
      await shoot(page, this.scope, at(5, "first-principle"));
      await centre(page, "#approach [data-line-hold]:last-of-type", 1.0);
      await shoot(page, this.scope, at(6, "last-principle"));
      await centre(page, `#approach ${END}`, 0.0, -50);
      await shoot(page, this.scope, at(7, "turn-back-up"));
    },
    depth: [`#approach ${LOOP}`, 0.5],
  },
};

for (const [key, pg] of Object.entries(PAGES)) {
  if (ONLY && ONLY !== key) continue;
  for (const lang of ["en", "he"]) {
    for (const [win, width, height] of WINDOWS) {
      const page = await open(pg.route, pg.ready, lang, width, height);
      await pg.walk(page, (n, where) => `${key}-${lang}-${win}-${n}-${where}`);
      await page.close();
    }
  }
  for (const [name, opts, before] of [
    ["reduced", { reduced: true }, null],
    ["paused", {}, () => document.body.classList.add("motion-paused")],
  ]) {
    const page = await open(pg.route, pg.ready, "en", 1440, 900, opts);
    if (before) await page.evaluate(before);
    await centre(page, ...pg.depth);
    await shoot(page, pg.scope, `${key}-en-desktop-off-${name}`);
    await page.close();
  }
}

await browser.close();
if (failed) {
  console.error("the line crosses text");
  process.exit(1);
}
