/*
 * The projects cleanup (2026-11-03): /projects and the home page's work run,
 * at 1440×900, into `docs/projects-cleanup/`.
 *
 *   projects-1440x900.png        /projects, the full page
 *   home-work-1440x900-<t>.png   the work run, held at point t of its range
 *   home-hero-1440x900.png       the hero plate and its field line
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4398 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-projects-cleanup.mjs`. Waits poll on a
 * timer (`{ polling: 500 }`), never on rAF: headless Chromium on this box
 * has almost no frame clock.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/projects-cleanup");
const BASE = process.env.BASE ?? "http://localhost:4398";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

async function frames(page, n = 3) {
  for (let i = 0; i < n; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("pageerror", e.message));

await page.goto(`${BASE}/projects`, { waitUntil: "load" });
await page.waitForFunction(() => document.querySelector("main h1"), null, { polling: 500, timeout: 20000 });
await frames(page, 4);
await page.screenshot({ path: `${OUT}/projects-1440x900.png`, fullPage: true });
console.log("projects:", await page.evaluate(() => [...document.querySelectorAll("main h3")].map((h) => h.textContent).join(" | ")));

await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForFunction(() => document.querySelector("[data-run-stage] a"), null, { polling: 500, timeout: 20000 });
/* The hero's arrival masks need frames to move off the plate. */
await frames(page, 20);
await page.screenshot({ path: `${OUT}/home-hero-1440x900.png` });
console.log("hero plate:", await page.evaluate(() => [...document.querySelectorAll("#hero ul > li")].map((li) => li.textContent).join(" · ")));

const range = await page.evaluate(() => {
  const stage = document.querySelector("[data-run-stage]");
  const box = stage.getBoundingClientRect();
  const top = box.top + window.scrollY;
  return { start: top - window.innerHeight * 0.1, length: Math.max(1, box.height - window.innerHeight) };
});
for (const t of [0.12, 0.5, 0.88]) {
  await page.evaluate((y) => window.scrollTo(0, y), range.start + range.length * t);
  await frames(page, 4);
  await page.screenshot({ path: `${OUT}/home-work-1440x900-${String(t).replace(".", "")}.png` });
}
await browser.close();
