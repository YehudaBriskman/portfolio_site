/*
 * How I work (#157), both directions, a laptop and a phone.
 *
 * What it shoots, into `docs/approach/`:
 *
 *   approach-<lang>-<window>-<n>-<where>.png
 *
 * the section's head, then each principle part-way through its drawing and
 * once drawn, then the same depth on the way back up (which must match the
 * way down, because scroll is the only clock); plus reduced motion and Pause
 * at a depth where the first figure is half drawn with motion on, which must
 * both show it finished. The third switch, a browser without scroll-driven
 * animation, cannot be faked in Chromium — `@supports` answers for the engine
 * — so it is held by the stylesheet test.
 *
 * It also prints the measure: characters per line of the section's prose,
 * and the line's width in px, read off the laid-out text.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4417 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-approach.mjs`. `BASE` points it elsewhere.
 * Frames are driven by throwaway screenshots rather than waited for, because
 * headless Chromium here has almost no frame clock; anything that must wait
 * for a condition polls every 500ms instead of on rAF.
 *
 * HEBREW: the locale is listed and disabled until the strings exist, so
 * `lang` and `dir` are written directly — the copy stays English; what is
 * under test is the direction (the rail moves to the right) and the faces.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/approach");
const BASE = process.env.BASE ?? "http://127.0.0.1:4417";

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

async function open(lang, width, height, { reduced = false } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#approach [data-figure]"), null, {
    polling: 500,
    timeout: 30000,
  });
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
  return page;
}

/* `sel`'s top at `at` (0..1) of the window's height. */
async function to(page, sel, at) {
  const y = await page.evaluate(
    ([s, f]) => {
      const el = document.querySelector(s);
      return el.getBoundingClientRect().top + window.scrollY - window.innerHeight * f;
    },
    [sel, at],
  );
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await frames(page, 4);
}

/* How far the figure's strokes are drawn, 0..1, averaged over its marks. */
async function drawn(page, n) {
  return page.evaluate((i) => {
    const marks = document.querySelectorAll(`#approach svg[data-figure]`)[i].querySelectorAll("[data-step]");
    let sum = 0;
    for (const m of marks) {
      const cs = getComputedStyle(m);
      sum += (1 - Number.parseFloat(cs.strokeDashoffset)) * Number.parseFloat(cs.strokeOpacity);
    }
    return Math.round((sum / marks.length) * 100) / 100;
  }, n);
}

async function shoot(page, name, note = "") {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, note);
}

/* The i-th principle: after the head and the three intro sections. */
const fig = (i) => `#approach > div > div:nth-child(${5 + i})`;

for (const lang of ["en", "he"]) {
  for (const [win, width, height] of WINDOWS) {
    const at = (n, where) => `approach-${lang}-${win}-${n}-${where}`;
    const page = await open(lang, width, height);
    await to(page, "#approach", 0.15);
    await shoot(page, at(0, "head"));
    let n = 1;
    for (let i = 0; i < 3; i += 1) {
      await to(page, fig(i), 0.68);
      await shoot(page, at(n++, `p${i + 1}-drawing`), `drawn=${await drawn(page, i)}`);
      await to(page, fig(i), 0.3);
      await shoot(page, at(n++, `p${i + 1}-drawn`), `drawn=${await drawn(page, i)}`);
    }
    /* Back up to the first principle's half-drawn depth: must match the way down. */
    await to(page, fig(0), 0.68);
    await shoot(page, at(n++, "p1-back-up"), `drawn=${await drawn(page, 0)}`);

    if (lang === "en") {
      const measure = await page.evaluate(() => {
        const out = [];
        for (const p of document.querySelectorAll("#approach [data-written]")) {
          const words = [...p.querySelectorAll("[data-word]")];
          const lines = new Map();
          for (const w of words) {
            const top = Math.round(w.getBoundingClientRect().top);
            lines.set(top, (lines.get(top) ?? "") + w.textContent + " ");
          }
          const all = [...lines.values()];
          for (const l of all.slice(0, -1)) out.push(l.trim().length);
        }
        out.sort((a, b) => a - b);
        const p = document.querySelector("#approach [data-written]");
        return {
          fontPx: getComputedStyle(p).fontSize,
          widthPx: Math.round(p.getBoundingClientRect().width),
          medianChars: out[Math.floor(out.length / 2)],
          minChars: out[0],
          maxChars: out.at(-1),
          lines: out.length,
        };
      });
      console.log(`measure ${win}`, JSON.stringify(measure));
    }
    await page.close();
  }
}

for (const [name, opts, before] of [
  ["reduced", { reduced: true }, null],
  ["paused", {}, () => document.body.classList.add("motion-paused")],
]) {
  const page = await open("en", 1440, 900, opts);
  if (before) await page.evaluate(before);
  await to(page, fig(0), 0.68);
  await shoot(page, `approach-en-desktop-off-${name}`, `drawn=${await drawn(page, 0)}`);
  await page.close();
}

await browser.close();
