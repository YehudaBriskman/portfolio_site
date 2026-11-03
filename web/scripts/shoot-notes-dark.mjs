/*
 * The notes as dark cards on paper (#179), a laptop and a phone.
 *
 * What it shoots, into `docs/notes/`:
 *
 *   dark-<w>x<h>-home-rest.png    the home shelf, held, every card at rest
 *   dark-<w>x<h>-home-hover.png   the same, the centred card hovered (on the
 *                                 phone: a touch context, where every card
 *                                 stands open and there is nothing to hover)
 *   dark-<w>x<h>-blog.png         /blog, at rest
 *   dark-<w>x<h>-blog-hover.png   /blog, the second card hovered (laptop only)
 *   dark-<w>x<h>-reduced.png      the home shelf with reduced motion
 *
 * and prints what is not a picture: every card's height at rest (they must
 * all be one number), whether hovering moved any neighbour, the bar's
 * material over the notes (paper: the section is not a dark ground), the
 * section's own ground, horizontal overflow, and the measured WCAG contrast
 * of the text and secondary text on a card's fill, and of the card's fill and
 * edge against the paper it stands on.
 *
 * The API is stubbed the way `shoot-notes-shelf.mjs` stubs it: six notes,
 * three with a cover, three without.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4399 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-notes-dark.mjs`. Headless Chromium on this
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

const COVERS = ["windom", "icaros", "programing_with_yehuda"];
const TITLES = [
  ["Why sticky breaks a scroll timeline", "What a pinned element does to a view timeline, and the one inset that fixes it"],
  ["Paper, and what it costs", "A ground that is not a gradient"],
  ["One loader, not five", "Every waiting region says what shape is coming"],
  ["The ceiling on dark grounds, and the day it moved", "Two acts, a room, and why a fourth is a different page"],
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

async function open(path, width, height, { reduced = false, touch = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
    hasTouch: touch,
    isMobile: touch,
  });
  await context.route("**/api/**", (r) => {
    const p = new URL(r.request().url()).pathname.replace(/^\/api/, "");
    const body =
      p === "/blog/posts" ? { items: POSTS } : p === "/blog/collections" ? { items: [] } : null;
    return body
      ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
      : r.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  page.on("console", (m) => m.type() === "error" && console.log("console", m.text()));
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  const ready = path === "/" ? "#notes [data-shelf-i] a" : "main h2 a";
  await page.waitForFunction((sel) => document.querySelector(sel), ready, {
    polling: 500,
    timeout: 20000,
  });
  await page.evaluate(() => document.fonts.ready);
  await frames(page, 3);
  return page;
}

async function toShelf(page, t) {
  const y = await page.evaluate((at) => {
    const stage = document.querySelector("[data-shelf-stage]").firstElementChild;
    const top = stage.getBoundingClientRect().top + window.scrollY;
    return Math.round(top + (stage.offsetHeight - window.innerHeight) * at);
  }, t);
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await frames(page, 4);
  await page.waitForTimeout(500);
  await frames(page, 1);
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/* Every card's box: heights at rest must be one number. */
async function boxes(page, sel) {
  return page.evaluate(
    (s) =>
      Array.from(document.querySelectorAll(s)).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY), h: Math.round(r.height * 10) / 10 };
      }),
    sel
  );
}

async function bar(page) {
  return page.evaluate(() => document.querySelector("[data-material]")?.getAttribute("data-material"));
}

/* WCAG contrast of each named element's text (or edge) against the colour
   actually painted behind it: the nearest ancestor with an opaque ground. */
async function contrast(page, picks) {
  return page.evaluate((spec) => {
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
    const out = {};
    for (const [k, sel, mode] of spec) {
      const el = document.querySelector(sel);
      if (!el) {
        out[k] = "missing";
        continue;
      }
      const cs = getComputedStyle(el);
      out[k] =
        mode === "edge"
          ? ratio(rgb(cs.borderTopColor), ground(el.parentElement))
          : mode === "fill"
            ? ratio(rgb(cs.backgroundColor), ground(el.parentElement))
            : ratio(rgb(cs.color), ground(el));
    }
    return out;
  }, picks);
}

const HOME_PICKS = [
  ["name", "#notes [data-shelf-i] a h3"],
  ["fields", "#notes [data-shelf-i] a li"],
  ["description", "#notes [data-shelf-i] a p"],
  ["arrow", "#notes [data-shelf-i] a > div > span[aria-hidden]"],
  ["card fill vs paper", "#notes [data-shelf-i] a", "fill"],
  ["card edge vs paper", "#notes [data-shelf-i] a", "edge"],
  ["section head", "#notes h2"],
  ["eyebrow", "#notes .section-head-note"],
];
const BLOG_PICKS = [
  ["h1", "main h1"],
  ["intro", "main header p.text-clay"],
  ["card title", "main article h2"],
  ["card date", "main article time"],
  ["card description", "main article p.text-clay"],
  ["card fill vs paper", "main article > div", "fill"],
  ["card edge vs paper", "main article > div", "edge"],
];

for (const [w, h] of WINDOWS) {
  const tag = `${w}x${h}`;
  const phone = w < 640;

  /* The home shelf. */
  const page = await open("/", w, h, { touch: phone });
  await toShelf(page, 0.4);
  await page.mouse.move(2, h - 2);
  await frames(page, 2);
  await page.screenshot({ path: `${OUT}/dark-${tag}-home-rest.png` });
  const rest = await boxes(page, "#notes [data-shelf-i] > a");
  console.log(tag, "home card heights", JSON.stringify(rest.map((b) => b.h)));
  console.log(tag, "bar over the notes", await bar(page));
  console.log(
    tag,
    "section ground",
    await page.evaluate(() => getComputedStyle(document.querySelector("#notes")).backgroundColor),
    "dark grounds in #notes",
    await page.evaluate(() => document.querySelectorAll("#notes [data-chrome], #notes[data-chrome]").length)
  );
  console.log(tag, "home contrast", JSON.stringify(await contrast(page, HOME_PICKS)));

  if (!phone) {
    /* The card nearest the middle of the frame. */
    const i = await page.evaluate(() => {
      const mid = window.innerWidth / 2;
      let best = 0;
      let gap = Infinity;
      document.querySelectorAll("#notes [data-shelf-i] > a").forEach((a, n) => {
        const r = a.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < gap) [gap, best] = [d, n];
      });
      return best;
    });
    const card = page.locator("#notes [data-shelf-i] > a").nth(i);
    await card.hover();
    await frames(page, 4);
    await page.waitForTimeout(400);
    await frames(page, 1);
    await page.screenshot({ path: `${OUT}/dark-${tag}-home-hover.png` });
    const open1 = await boxes(page, "#notes [data-shelf-i] > a");
    const moved = open1.filter((b, n) => n !== i && (b.x !== rest[n].x || b.y !== rest[n].y || b.h !== rest[n].h));
    console.log(tag, "hovered card", i, "height", rest[i].h, "->", open1[i].h, "neighbours moved", moved.length);
  } else {
    await page.screenshot({ path: `${OUT}/dark-${tag}-home-hover.png` });
    console.log(tag, "touch: description shown at rest", await page.evaluate(() =>
      getComputedStyle(document.querySelector("#notes [data-shelf-i] a p")).opacity));
  }

  console.log(tag, "home x-overflow", await overflow(page));
  await page.context().close();

  /* Reduced motion: no growth, the description simply there. */
  const quiet = await open("/", w, h, { reduced: true });
  await quiet.evaluate(() =>
    document.querySelector("#notes [data-shelf-stage]").scrollIntoView({ behavior: "instant", block: "start" })
  );
  await frames(quiet, 4);
  await quiet.screenshot({ path: `${OUT}/dark-${tag}-reduced.png` });
  console.log(tag, "reduced heights", JSON.stringify((await boxes(quiet, "#notes [data-shelf-i] > a")).map((b) => b.h)));
  await quiet.context().close();

  /* /blog. */
  const blog = await open("/blog", w, h, { touch: phone });
  await blog.evaluate(() =>
    window.scrollTo({ top: document.querySelector("main [aria-live]").getBoundingClientRect().top + window.scrollY - 220, behavior: "instant" })
  );
  await blog.mouse.move(2, 2);
  await frames(blog, 4);
  await blog.screenshot({ path: `${OUT}/dark-${tag}-blog.png` });
  const cards = await boxes(blog, "main article > div");
  console.log(tag, "blog card heights", JSON.stringify(cards.map((b) => b.h)));
  console.log(tag, "blog bar", await bar(blog));
  console.log(tag, "blog contrast", JSON.stringify(await contrast(blog, BLOG_PICKS)));
  if (!phone) {
    const second = blog.locator("main article > div").nth(2);
    await second.hover();
    await frames(blog, 4);
    await blog.waitForTimeout(400);
    await frames(blog, 1);
    await blog.screenshot({ path: `${OUT}/dark-${tag}-blog-hover.png` });
    const after = await boxes(blog, "main article > div");
    const moved = after.filter((b, n) => n !== 2 && (b.x !== cards[n].x || b.y !== cards[n].y));
    console.log(tag, "blog hovered", cards[2].h, "->", after[2].h, "neighbours moved", moved.length);
  }
  console.log(tag, "blog x-overflow", await overflow(blog));
  await blog.context().close();
}

await browser.close();
