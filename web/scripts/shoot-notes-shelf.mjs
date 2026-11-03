/*
 * The notes shelf, held (#159), a laptop and a phone.
 *
 * What it shoots, into `docs/notes/`:
 *
 *   shelf-<w>x<h>-<nn>-<t>.png   the held frame at point t (0..1) of the
 *                                stage's contain range, then one frame after
 *                                the hold, on the way out
 *   shelf-<w>x<h>-back-<t>.png   the same point reached by scrolling UP from
 *                                the end — must match its forward frame
 *   shelf-<w>x<h>-focus.png      Tab to the fourth card from above the shelf
 *   shelf-<w>x<h>-reduced.png    prefers-reduced-motion: the plain list
 *   shelf-<w>x<h>-paused.png     body.motion-paused: the same plain list
 *
 * and prints what is not a picture: horizontal overflow, whether each
 * reverse frame is byte-identical to its forward one, where the focused card
 * landed, and the measured contrast of every kind of text on the card.
 *
 * The API is stubbed the way `a11y/axe-routes.mjs` stubs it: six notes, three
 * with a cover (project screenshots from `public/projects`, standing in for
 * covers the seed does not have), three without.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4399 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-notes-shelf.mjs`. Headless Chromium on this
 * box has almost no frame clock, so frames are driven by throwaway
 * screenshots and every wait polls on a timer (`{ polling: 500 }`).
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/notes");
const BASE = process.env.BASE ?? "http://localhost:4399";
mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  [1440, 900],
  [390, 844],
];
const POINTS = [0, 0.2, 0.4, 0.6, 0.8, 1];

const COVERS = ["windom", "icaros", "programing_with_yehuda"];
const TITLES = [
  ["Why sticky breaks a scroll timeline", "What a pinned element does to a view timeline"],
  ["Paper, and what it costs", "A ground that is not a gradient"],
  ["One loader, not five", "Every waiting region says what shape is coming"],
  ["The ceiling on dark grounds", "Two acts, and why a third is a different page"],
  ["Scroll is the clock", "Nothing on a timer, nothing fired once"],
  ["A footer is chrome", "What the ceiling counts, and what it does not"],
];
const POSTS = TITLES.map(([title, subtitle], i) => ({
  slug: `fixture-${i}`,
  title,
  subtitle,
  excerpt: `${subtitle}.`,
  publishedAt: `2026-${String(10 - i).padStart(2, "0")}-0${i + 1}T00:00:00.000Z`,
  tags: [],
  collection: "site",
  coverImage: i % 2 === 0 ? `/projects/${COVERS[i / 2]}-1200.jpg` : null,
  readingMinutes: 4 + i,
}));

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
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await context.route("**/api/blog/posts", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: POSTS }) })
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#notes [data-shelf-i] a"), null, {
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
    const stage = document.querySelector("[data-shelf-stage]").firstElementChild;
    const top = stage.getBoundingClientRect().top + window.scrollY;
    return Math.round(top + (stage.offsetHeight - window.innerHeight) * at);
  }, t);
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await frames(page, 4);
  await page.waitForTimeout(600);
  await frames(page, 1);
}

function below(w, h) {
  return { x: 0, y: 64, width: w, height: h - 64 };
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/* WCAG relative luminance contrast of each text kind against the colour
   actually painted behind it (the nearest ancestor with an opaque ground). */
async function contrast(page) {
  return page.evaluate(() => {
    const rgb = (s) => s.match(/[\d.]+/g).slice(0, 4).map(Number);
    const lum = ([r, g, b]) => {
      const f = (c) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ground = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = rgb(getComputedStyle(n).backgroundColor);
        if (c.length < 4 || c[3] === 1) return c;
      }
      return [255, 255, 255];
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
    };
    const card = document.querySelector("#notes [data-shelf-i] a");
    const out = {};
    const pick = { name: "h3", fact: "p", field: "li", arrow: "span[aria-hidden]" };
    for (const [k, sel] of Object.entries(pick)) {
      const el = card.querySelector(sel);
      out[k] = ratio(rgb(getComputedStyle(el).color), ground(el));
    }
    out.border = ratio(rgb(getComputedStyle(card).borderTopColor), ground(card.parentElement));
    return out;
  });
}

for (const [w, h] of WINDOWS) {
  const tag = `${w}x${h}`;
  const page = await open(w, h);
  for (const t of POINTS) await toPoint(page, t);
  const forward = {};
  let n = 0;
  for (const t of POINTS) {
    await toPoint(page, t);
    await page.screenshot({ path: `${OUT}/shelf-${tag}-${String(n).padStart(2, "0")}-${t}.png` });
    forward[t] = await page.screenshot({ clip: below(w, h) });
    console.log(tag, "t", t, "x-overflow", await overflow(page));
    n += 1;
  }
  await toPoint(page, 1.3);
  await page.screenshot({ path: `${OUT}/shelf-${tag}-${String(n).padStart(2, "0")}-exit.png` });

  for (const t of [0.8, 0.4]) {
    await toPoint(page, t);
    await page.screenshot({ path: `${OUT}/shelf-${tag}-back-${t}.png` });
    const buf = await page.screenshot({ clip: below(w, h) });
    console.log(tag, "reverse", t, buf.equals(forward[t]) ? "identical" : "DIFFERS");
  }
  console.log(tag, "contrast", JSON.stringify(await contrast(page)));

  /* Keyboard: from above the stage, Tab into the shelf and on to card 4. */
  await toPoint(page, -0.1);
  await page.focus('#notes [data-shelf-i="0"] a');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("Tab");
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
  await page.screenshot({ path: `${OUT}/shelf-${tag}-focus.png` });

  /* And out the other side without walking the cards: the skip link. */
  await toPoint(page, -0.1);
  await page.evaluate(() => document.querySelector("#notes a[href^='#']").focus());
  await page.keyboard.press("Enter");
  await frames(page, 2);
  console.log(tag, "skip lands on", await page.evaluate(() => document.activeElement.id));
  await page.keyboard.press("Tab");
  console.log(
    tag,
    "next tab",
    await page.evaluate(() => document.activeElement.textContent.trim().slice(0, 30))
  );

  await page.evaluate(() => document.body.classList.add("motion-paused"));
  await page.evaluate(() =>
    document.querySelector("#notes").scrollIntoView({ behavior: "instant", block: "start" })
  );
  await frames(page, 4);
  await page.screenshot({ path: `${OUT}/shelf-${tag}-paused.png` });
  console.log(tag, "paused x-overflow", await overflow(page));
  await page.context().close();

  const quiet = await open(w, h, { reduced: true });
  await quiet.evaluate(() =>
    document.querySelector("#notes").scrollIntoView({ behavior: "instant", block: "start" })
  );
  await frames(quiet, 4);
  await quiet.screenshot({ path: `${OUT}/shelf-${tag}-reduced.png` });
  console.log(tag, "reduced x-overflow", await overflow(quiet));
  console.log(tag, "reduced contrast", JSON.stringify(await contrast(quiet)));
  await quiet.context().close();
}

await browser.close();
