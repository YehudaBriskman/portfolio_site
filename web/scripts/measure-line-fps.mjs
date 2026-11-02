/*
 * Frame rate through a section the living line runs behind (#176, #178), at
 * 4x CPU throttle. `measure-approach-fps.mjs` with the route and the section
 * as parameters, so /story's timeline and the home page's "How I work" are
 * measured by one harness.
 *
 *   ROUTE=/story SEL="ol[aria-label='Timeline']" \
 *     xvfb-run -a node scripts/measure-line-fps.mjs <labelA>=<baseA> <labelB>=<baseB> [rounds]
 *
 * Defaults: ROUTE=/ and SEL=#approach. `PAUSED=1` sets the site's Pause on
 * every pass, which isolates what the motion costs from what the layout
 * costs.
 *
 * Each pass loads the route, jumps to just above the section, then wheels
 * through the whole of it with real input events (a scripted per-frame
 * `scrollTo` forces layout every tick and measures the harness), counting
 * `requestAnimationFrame` callbacks against the wall clock. Arms are
 * interleaved and their order flipped each round; one warm-up pass per arm
 * is discarded. Prints each pass and the median per arm.
 */
import { chromium } from "playwright-core";

const arms = process.argv.slice(2).filter((a) => a.includes("=")).map((a) => a.split("="));
const rounds = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 7);
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const ROUTE = process.env.ROUTE ?? "/";
const SEL = process.env.SEL ?? "#approach";

const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function pass(base) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(`${base}${ROUTE}`, { waitUntil: "load" });
  await page.waitForFunction((s) => document.querySelector(s), SEL, {
    polling: 500,
    timeout: 30000,
  });
  for (let i = 0; i < 20; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
  }
  const { top, height } = await page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { top: r.top + scrollY, height: r.height };
  }, SEL);
  if (process.env.PAUSED) await page.evaluate(() => document.body.classList.add("motion-paused"));
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top - H);
  await page.mouse.move(W / 2, H / 2);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    window.__frames = 0;
    window.__run = true;
    const tick = () => {
      window.__frames += 1;
      if (window.__run) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__t0 = performance.now();
  });
  const distance = height + H;
  const step = 100;
  for (let d = 0; d < distance; d += step) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(16);
  }
  const fps = await page.evaluate(() => {
    window.__run = false;
    return (window.__frames * 1000) / (performance.now() - window.__t0);
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.close();
  return { fps, height };
}

const results = Object.fromEntries(arms.map(([l]) => [l, []]));
for (const [, base] of arms) await pass(base);
for (let r = 0; r < rounds; r += 1) {
  const order = r % 2 ? [...arms].reverse() : arms;
  for (const [label, base] of order) {
    const { fps, height } = await pass(base);
    results[label].push(fps);
    console.log(`round ${r} ${label} ${fps.toFixed(1)}fps (section ${Math.round(height)}px)`);
  }
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const [label] of arms) {
  console.log(`${label}: median ${median(results[label]).toFixed(1)}fps over ${results[label].length}`);
}
await browser.close();
