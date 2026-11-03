/*
 * The hero held under the next act, and the aurora ribbon around the figure.
 *
 *   npm run build && npx vite preview --port 4271 --strictPort &
 *   xvfb-run -a node scripts/shoot-hero-aurora.mjs [out-dir] [prefix]
 *
 * Writes, per window (1440×900, 390×844) and theme (light, dark):
 *
 *   <prefix>-<theme>-<w>-top.png    scroll 0: the ribbon behind the head
 *                                   and in front of the chest
 *   <prefix>-<theme>-<w>-mid.png    the dark act's edge at 80% of the window:
 *                                   the ribbon's tail dipping under it
 *   <prefix>-<theme>-<w>-half.png   the edge at 55%, partly over the hero
 *                                   (the frame the before shots are at)
 *   <prefix>-<theme>-<w>-late.png   the edge at 25%: the figure still there,
 *                                   most of it covered
 *   <prefix>-light-1440-reduced.png prefers-reduced-motion, edge at 55%
 *
 * and prints, for each shot, where the figure is and whether anything is
 * masking it, so the screenshots are not the only evidence.
 *
 * `BEFORE=1` shoots only the light `half` pair (the bug, on main).
 * `DARK_CSS=<file>` injects a `:root[data-theme='dark']` token block, for a
 * branch where the theme system (#247) has not landed yet.
 *
 * Headless Chromium on this box has almost no frame clock, so frames are
 * driven by throwaway screenshots and every wait polls on a timer.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/hero-aurora");
const PREFIX = process.argv[3] ?? "after";
const BASE = process.env.BASE ?? "http://localhost:4271";
const BEFORE = process.env.BEFORE === "1";
const DARK_CSS = process.env.DARK_CSS
  ? readFileSync(process.env.DARK_CSS, "utf8")
  : "";
mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  [1440, 900],
  [390, 844],
];
/* Where the dark act's top edge sits, as a share of the window height. */
const POINTS = BEFORE
  ? { half: 0.55 }
  : { top: null, mid: 0.8, half: 0.55, late: 0.25 };
const THEMES = BEFORE ? ["light"] : ["light", "dark"];

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

async function open(width, height, { theme = "light", reduced = false } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
    colorScheme: theme,
  });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  if (theme === "dark") {
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "dark"),
    );
    if (DARK_CSS) await page.addStyleTag({ content: DARK_CSS });
  }
  /* The route chunk is lazy: wait for the hero itself, polling on a timer. */
  for (let i = 0; i < 60; i += 1) {
    if (
      await page.evaluate(() => !!document.querySelector("[data-portrait] img"))
    )
      break;
    await frames(page, 1);
  }
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    const gone = await page.evaluate(
      () => !document.querySelector('[class*="_shutter_"]'),
    );
    if (gone) break;
  }
  /* The arrival, once a visit, has ~1s of clock left after the cover. */
  await frames(page, 8);
  await page.waitForTimeout(800);
  return page;
}

async function scrollTo(page, edge) {
  const y = await page.evaluate((at) => {
    if (at === null) return 0;
    const hero = document.getElementById("hero");
    /* The act after the hero (or after its holder, once it has one). */
    const holder = hero.parentElement?.matches("main")
      ? hero
      : hero.parentElement;
    const next = holder.nextElementSibling;
    const top = next.getBoundingClientRect().top + window.scrollY;
    return Math.round(top - window.innerHeight * at);
  }, edge);
  await page.evaluate(
    (top) => window.scrollTo({ top, behavior: "instant" }),
    y,
  );
  await frames(page, 4);
  await page.waitForTimeout(400);
  await frames(page, 2);
  return y;
}

/* Where the figure is on screen and what, if anything, is hiding it. */
function probe(page) {
  return page.evaluate(() => {
    const img = document.querySelector("[data-portrait] img");
    const r = img.getBoundingClientRect();
    const mask = document.querySelector("[data-portrait-mask]");
    const next = (
      document.getElementById("hero").parentElement?.matches("main")
        ? document.getElementById("hero")
        : document.getElementById("hero").parentElement
    ).nextElementSibling.getBoundingClientRect();
    const ribbon = document.querySelector("[data-hero-ribbon]");
    return {
      figure: [Math.round(r.top), Math.round(r.bottom)],
      figureTransform: getComputedStyle(img).transform,
      maskTransform: mask ? getComputedStyle(mask).transform : null,
      nextTop: Math.round(next.top),
      ribbon: ribbon ? "present" : "absent",
    };
  });
}

for (const theme of THEMES) {
  for (const [w, h] of WINDOWS) {
    const page = await open(w, h, { theme });
    for (const [name, edge] of Object.entries(POINTS)) {
      const y = await scrollTo(page, edge);
      const file = `${PREFIX}-${theme}-${w}-${name}.png`;
      await page.screenshot({ path: resolve(OUT, file) });
      console.log(file, `scrollY=${y}`, JSON.stringify(await probe(page)));
    }
    await page.close();
  }
}

if (!BEFORE) {
  const page = await open(1440, 900, { reduced: true });
  const y = await scrollTo(page, 0.55);
  const file = `${PREFIX}-light-1440-reduced.png`;
  await page.screenshot({ path: resolve(OUT, file) });
  console.log(file, `scrollY=${y}`, JSON.stringify(await probe(page)));
  await page.close();
}

await browser.close();
