#!/usr/bin/env node
/*
 * Brand motion, shot (#251), into docs/brand-motion/.
 *
 *   npm run build && xvfb-run -a node scripts/shoot-brand-motion.mjs [frames|dashboards|all]
 *
 * frames      A project page's Overview section ("Worth knowing", the first
 *             card that arrived through the old ink wipe) caught at 0%, 30%,
 *             60% and 100% of its appearance, in Light and Dark, with motion
 *             ON. FRAMES_TAG names the set (`before` on the old tree, `after`
 *             on this one). Each frame also records, from the page itself,
 *             whether anything painted over the section's text: the section's
 *             opacity, its clip-path, and any pseudo-element with a
 *             background. The appearance is scroll-scrubbed, so a frame is a
 *             scroll position: the section's top at the window's foot minus
 *             p of the scroll the appearance takes (the lesser of RANGE_PX
 *             and the section's height, or the old wipe's `entry 8%`-
 *             `entry 92%` of the section's height).
 *
 * dashboards  /blog, /blog/area/site, /blog/log, /projects and
 *             /projects/bothy in Light and Dark, desktop and phone, with
 *             reduced motion so every scrub is on its finished frame.
 *
 * Against the built site and the axe run's API fixtures
 * (scripts/a11y/site-stub.mjs). Polling is by hand (500ms): headless
 * Chromium on the dev box has almost no rAF clock.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./a11y/site-stub.mjs";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/brand-motion");
mkdirSync(OUT, { recursive: true });
const what = process.argv[2] || "all";
const TAG = process.env.FRAMES_TAG || "after";
/* The new appearance runs over the first 240px of a section's entry. */
const RANGE_PX = Number(process.env.RANGE_PX || 240);

const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const DASHBOARDS = [
  ["blog", "/blog"],
  ["blog-area", "/blog/area/site"],
  ["blog-log", "/blog/log"],
  ["projects", "/projects"],
  ["project", "/projects/bothy"],
];

const { base, stop } = await startPreview();
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  headless: !process.env.DISPLAY,
  args: ["--no-sandbox"],
});

async function open(theme, size, reduced) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
    colorScheme: theme === "dark" ? "light" : "dark",
  });
  await context.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
  await context.route("**/api/**", (r) => {
    const { status, body } = answer(r.request().url(), false);
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return { context, page: await context.newPage() };
}

async function settle(page, route, theme) {
  await page.goto(base + route, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("h1") !== null, null, { polling: 500, timeout: 20_000 });
  await page
    .waitForFunction(() => !document.querySelector("div[data-state][aria-hidden='true']"), null, { polling: 500, timeout: 90_000 })
    /* The entry shutter must be gone: a frame taken under it shows the grid. */
    .catch(() => {
      throw new Error(`${route}: the entry shutter never left`);
    });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const painted = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (painted !== theme) throw new Error(`${route} painted ${painted}, expected ${theme}`);
}

async function shot(page, file, opts = {}) {
  for (let i = 0; ; i++) {
    try {
      await page.screenshot({ path: file, timeout: 45_000, ...opts });
      return;
    } catch (e) {
      if (i >= 3) throw e;
    }
  }
}

const log = [];
try {
  if (what === "frames" || what === "all") {
    for (const theme of ["light", "dark"]) {
      const { context, page } = await open(theme, "desktop", false);
      await settle(page, "/projects/bothy", theme);
      /* Warm the timelines: scroll once past the section and back, so the
         first frame is sampled from a live timeline, not a cold one. */
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1500);
      /* ~0%: a hair inside the range, because at its exact start edge a view
         timeline can read as not yet active and show the resting frame. */
      for (const p of [0.02, 0.3, 0.6, 1]) {
        const probe = await page.evaluate(
          ({ p, rangePx, tag }) => {
            const h = document.getElementById("highlights-heading");
            const card = h.closest("section");
            /* The animated box: the old wipe wrapped the card; the new
               arrival is the card itself. */
            const box = tag === "before" ? card.parentElement : card;
            const r = box.getBoundingClientRect();
            const docTop = r.top + window.scrollY;
            const travel = tag === "before" ? (0.08 + 0.84 * p) * r.height : p * Math.min(r.height, rangePx);
            window.scrollTo(0, docTop - window.innerHeight + travel);
            return { height: r.height };
          },
          { p, rangePx: RANGE_PX, tag: TAG },
        );
        /* Give the scroll a frame to reach the timelines (rAF is rare here). */
        await page.waitForTimeout(2500);
        const covered = await page.evaluate(() => {
          const h = document.getElementById("highlights-heading");
          const card = h.closest("section");
          const box = card.parentElement;
          const out = [];
          /* The box, the card and the heading: anything painted over the
             block (the old band was the box's ::after). The list bullets
             are content, not a cover, and are left out. */
          for (const el of [box, card, h]) {
            const cs = getComputedStyle(el);
            if (cs.clipPath && cs.clipPath !== "none") out.push(`clip-path ${cs.clipPath.slice(0, 40)} on ${el.tagName}`);
            for (const pseudo of ["::before", "::after"]) {
              const ps = getComputedStyle(el, pseudo);
              if (ps.content !== "none" && ps.content !== "normal" && ps.backgroundColor !== "rgba(0, 0, 0, 0)")
                out.push(`${pseudo} background ${ps.backgroundColor} on ${el.tagName}`);
            }
          }
          let o = 1;
          for (let el = h; el; el = el.parentElement) o *= Number(getComputedStyle(el).opacity);
          return { covered: out, headingOpacity: Math.round(o * 1000) / 1000, cardTranslate: getComputedStyle(card).translate };
        });
        const file = resolve(OUT, `appear-${TAG}-${theme}-${String(Math.round(p * 100)).padStart(3, "0")}.png`);
        await shot(page, file);
        log.push({ tag: TAG, theme, progress: p, sectionHeight: probe.height, ...covered, file: file.split("/docs/")[1] });
        console.log(file, JSON.stringify(covered));
      }
      await context.close();
    }
    writeFileSync(resolve(OUT, `appear-${TAG}.json`), JSON.stringify(log, null, 2) + "\n");
  }

  if (what === "dashboards" || what === "all") {
    for (const theme of ["light", "dark"]) {
      for (const size of ["desktop", "phone"]) {
        for (const [name, route] of DASHBOARDS) {
          const { context, page } = await open(theme, size, true);
          await settle(page, route, theme);
          const file = resolve(OUT, `${name}-${theme}-${size}.png`);
          await shot(page, file);
          console.log(file);
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  stop();
}
