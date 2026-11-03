/*
 * The hero held under the next act, and the aurora ribbon around the figure.
 *
 *   npm run build && npx vite preview --port 4271 --strictPort &
 *   xvfb-run -a node scripts/shoot-hero-aurora.mjs [out-dir] [prefix]
 *
 * Writes, per window (1440×900, 390×844) and theme (light, dark):
 *
 *   <prefix>-<theme>-<w>-top.png    scroll 0: the ribbon across the chest
 *   <prefix>-<theme>-<w>-mid.png    the dark act's edge at 80% of the window:
 *                                   the ribbon's tail dipping under it
 *   <prefix>-<theme>-<w>-half.png   the edge at 55%, partly over the hero
 *                                   (the frame the before shots are at)
 *   <prefix>-<theme>-<w>-late.png   the edge at 25%: the figure still there,
 *                                   most of it covered
 *   <prefix>-light-1440-reduced.png prefers-reduced-motion, edge at 55%
 *   <prefix>-<theme>-1440-zoom-head.png  the head and shoulders, where v1's
 *                                   back half showed through (#272), and a
 *                                   byte comparison with the ribbon hidden
 *   <prefix>-<theme>-1440-zoom-edge.png  the figure's left edge, where the
 *                                   sweep comes in over the chest
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

async function open(width, height, { theme = "light", reduced = false, dpr = 1 } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: dpr,
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

  /* The silhouette, close up (#272): nothing of the ribbon may show through
     the figure. For each theme, at 3x, the head and shoulders (where v1's
     back half ran) are shot twice with the ribbon and once without it, and
     the differing pixels counted: the ribbon's own count must be none. */
  for (const theme of THEMES) {
    const zoom = await open(1440, 900, { theme, dpr: 3 });
    const box = await zoom.evaluate(() => {
      const r = document.querySelector("[data-portrait] img").getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    /* The head and shoulders down to just above the chest (y 450 of 845),
       from below the fact line: hiding a composited layer re-rasterises the
       type over the crown, which differs in its anti-aliasing and is not
       the ribbon. */
    const head = {
      x: Math.round(box.x),
      y: Math.round(box.y + box.height * (80 / 845)),
      width: Math.round(box.width),
      height: Math.round(box.height * (360 / 845)),
    };
    /* The left edge of the figure where the sweep comes in over the chest. */
    const edge = {
      x: Math.round(box.x - box.width * 0.15),
      y: Math.round(box.y + box.height * (400 / 845)),
      width: Math.round(box.width * 0.6),
      height: Math.round(box.height * (220 / 845)),
    };
    const shot = (clip) => zoom.screenshot({ clip });
    const diff = (a, b) =>
      /* Decoded and compared in the page, which has a canvas. */
      zoom.evaluate(
        async ([a, b]) => {
          const pixels = async (src) => {
            const img = new Image();
            img.src = `data:image/png;base64,${src}`;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const g = c.getContext("2d");
            g.drawImage(img, 0, 0);
            return g.getImageData(0, 0, c.width, c.height);
          };
          const [p, q] = [await pixels(a), await pixels(b)];
          const rows = new Set();
          let changed = 0;
          for (let i = 0; i < p.data.length; i += 4) {
            if (
              p.data[i] !== q.data[i] ||
              p.data[i + 1] !== q.data[i + 1] ||
              p.data[i + 2] !== q.data[i + 2]
            ) {
              changed += 1;
              rows.add(Math.floor(i / 4 / p.width));
            }
          }
          const r = [...rows];
          return {
            changed,
            of: p.width * p.height,
            rows: r.length ? [Math.min(...r), Math.max(...r)] : null,
          };
        },
        [a.toString("base64"), b.toString("base64")],
      );
    const on = await shot(head);
    await frames(zoom, 2);
    const onAgain = await shot(head);
    await zoom.screenshot({ path: resolve(OUT, `${PREFIX}-${theme}-1440-zoom-head.png`), clip: head });
    await zoom.screenshot({ path: resolve(OUT, `${PREFIX}-${theme}-1440-zoom-edge.png`), clip: edge });
    await zoom.addStyleTag({ content: "[data-hero-ribbon]{visibility:hidden!important}" });
    await frames(zoom, 2);
    const off = await shot(head);
    /* The first number is the noise floor (two shots, ribbon on both); the
       second is what the ribbon itself changes. */
    console.log(
      `${theme} head and shoulders (${head.width}x${head.height}):`,
      "on vs on",
      JSON.stringify(await diff(on, onAgain)),
      "on vs off",
      JSON.stringify(await diff(onAgain, off)),
    );
    await zoom.close();
  }
}

await browser.close();
