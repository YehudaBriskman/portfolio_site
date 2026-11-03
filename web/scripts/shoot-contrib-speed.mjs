/*
 * The contribution year's pace (#246), measured and shot.
 *
 * What it prints, per window: the stage's height, the length of its `contain`
 * range (the act's whole clock, in scroll px), the scroll px each stage of
 * `city-raise` / `city-dolly` takes, the scene's own animation progress read
 * back at those boundaries (so the arithmetic is checked against the
 * browser, not trusted), and where the next section's top sits when the act
 * ends and when the frame lets go — the "no dead gap, no late start" check.
 *
 * What it shoots, into `docs/contrib-speed/` (or argv[2]), at 1440x900:
 *
 *   <label>-<n>-<px>.png   the held frame at a fixed number of scroll px into
 *                          the act, so a before and an after at the same
 *                          offset show how far the act got with the same
 *                          thumb travel. `CITY_LABEL` names the run.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4399 --strictPort`, then
 * `CITY_LABEL=after xvfb-run -a node scripts/shoot-contrib-speed.mjs`.
 * Headless Chromium on this box has almost no frame clock, so frames are
 * driven by throwaway screenshots and waits poll on a timer, never on rAF.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/contrib-speed");
const BASE = process.env.BASE ?? "http://localhost:4399";
const LABEL = process.env.CITY_LABEL ?? "now";
mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  [1440, 900],
  [390, 844],
];
/* The keyframe boundaries in `ContributionCity.module.css`. */
const STAGES = [
  ["flat, held", 0, 0.1],
  ["turn", 0.1, 0.3],
  ["rise", 0.3, 0.48],
  ["dolly in", 0.48, 0.6],
  ["dolly along", 0.6, 1],
];
/* Fixed scroll px into the act: the turn, the rise, the dolly as the
   pre-#246 pace had them. */
const SHOTS = [180, 400, 700];

function year() {
  const days = [];
  const end = Date.UTC(2026, 10, 1);
  for (let i = 364; i >= 0; i -= 1) {
    const d = new Date(end - i * 86400000);
    const n = (i * 7919) % 11;
    days.push({ date: d.toISOString().slice(0, 10), count: n > 6 ? n * 2 : 0 });
  }
  const total = days.reduce((s, d) => s + d.count, 0);
  return {
    from: days[0].date,
    to: days.at(-1).date,
    total,
    days,
    fetchedAt: new Date().toISOString(),
    error: null,
  };
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

async function open(width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await context.route("**/api/github/contributions", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ contributions: year() }),
    }),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  page.on(
    "request",
    (r) => process.env.DEBUG && console.log("request", r.url()),
  );
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page
    .waitForFunction(() => document.querySelector('[data-city="year"]'), null, {
      polling: 500,
      timeout: 20000,
    })
    .catch(async (e) => {
      console.log(
        "data-city:",
        await page.evaluate(
          () => document.querySelector("[data-city]")?.dataset.city,
        ),
      );
      throw e;
    });
  await page.evaluate(() => document.fonts.ready);
  await frames(page, 2);
  return page;
}

async function scrollTo(page, y) {
  await page.evaluate(
    (top) => window.scrollTo({ top, behavior: "instant" }),
    y,
  );
  await frames(page, 3);
  await page.waitForTimeout(400);
  await frames(page, 1);
}

/* The act's clock in document px: `contain 0%` is the stage's top at the
   top of the visibility range, `contain 100%` its bottom at the window's
   bottom. The scene's own progress is read back at each boundary to check
   the arithmetic against the browser. */
async function geometry(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('[data-city="year"]');
    const top = stage.getBoundingClientRect().top + window.scrollY;
    const section = document.getElementById("year");
    /* The first box after the year's dark act: the next section. */
    let next = section;
    while (next && !next.nextElementSibling) next = next.parentElement;
    next = next?.nextElementSibling;
    return {
      vh: window.innerHeight,
      height: stage.offsetHeight,
      section: section.offsetHeight,
      /* `contain 0%` is the stage's top at the top of the visibility range,
         which an `auto` inset puts at the document's scroll-padding-top. */
      pad:
        parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingTop,
        ) || 0,
      start: Math.round(
        top -
          (parseFloat(
            getComputedStyle(document.documentElement).scrollPaddingTop,
          ) || 0),
      ),
      end: Math.round(top + stage.offsetHeight - window.innerHeight),
      nextTop: next
        ? Math.round(next.getBoundingClientRect().top + window.scrollY)
        : null,
      stageBottom: Math.round(top + stage.offsetHeight),
    };
  });
}

async function progress(page) {
  return page.evaluate(() => {
    const anim = document
      .querySelector('[data-city="year"]')
      .getAnimations({ subtree: true })
      .find((a) => /city-raise/.test(a.animationName));
    const p = anim?.effect.getComputedTiming().progress;
    return p == null ? null : Math.round(p * 1000) / 1000;
  });
}

for (const [w, h] of WINDOWS) {
  const page = await open(w, h);
  /* Walk down to the year first and let everything above it settle: the
     sections above load their own data and change height as they do, and a
     stage measured from the top of the page would be measured too early. */
  let g = await geometry(page);
  for (let i = 0; i < 6; i += 1) {
    await scrollTo(page, g.start);
    const again = await geometry(page);
    if (again.start === g.start && again.height === g.height) break;
    g = again;
  }
  const range = g.end - g.start;
  console.log(
    `\n${LABEL} ${w}x${h}: section ${g.section}px, stage ${g.height}px, contain range (the clock) ${range}px, inset ${g.pad}px`,
  );
  for (const [name, a, b] of STAGES) {
    const y = Math.round(g.start + range * b);
    await scrollTo(page, y);
    console.log(
      `  ${name.padEnd(12)} ${String(Math.round(range * (b - a))).padStart(5)}px` +
        `  (ends at +${Math.round(range * b)}px, scene progress read ${await progress(page)})`,
    );
  }
  /* The hand-off: at the act's last frame, and as the frame lets go. */
  console.log(
    `  next section top: ${g.nextTop - (g.end + g.vh)}px below the window at contain 100%,` +
      ` ${g.nextTop - g.stageBottom}px after the stage's bottom`,
  );

  if (w === 1440) {
    let n = 1;
    for (const px of SHOTS) {
      await scrollTo(page, g.start + px);
      const p = await progress(page);
      await page.screenshot({ path: `${OUT}/${LABEL}-${n}-${px}px.png` });
      console.log(`  shot ${LABEL}-${n}-${px}px.png at progress ${p}`);
      n += 1;
    }
  }

  /* Reversible: past the end, then back up to each shot's offset. The scene's
     progress must come back to what it read on the way down. */
  const down = {};
  for (const px of SHOTS) {
    await scrollTo(page, g.start + px);
    down[px] = await progress(page);
  }
  await scrollTo(page, g.end + g.vh);
  for (const px of [...SHOTS].reverse()) {
    await scrollTo(page, g.start + px);
    const up = await progress(page);
    console.log(
      `  reverse +${px}px: ${up} up, ${down[px]} down, ${up === down[px] ? "same" : "DIFFERS"}`,
    );
  }
  await page.context().close();
}

await browser.close();
