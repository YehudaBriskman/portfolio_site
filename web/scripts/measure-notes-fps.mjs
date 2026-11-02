/*
 * Frame rate through the home page's notes shelf, at 4x CPU throttle (#159).
 *
 *   xvfb-run -a node scripts/measure-notes-fps.mjs <labelA>=<baseA> <labelB>=<baseB> [rounds]
 *
 * The work run's harness (`measure-work-fps.mjs`) pointed at `#notes`, with
 * the API stubbed to six notes — three with a cover — as the shoot stubs it,
 * because the shelf has nothing to move without them. Each pass loads `/`,
 * jumps to a window above `#notes`, wheels through the whole section with real
 * input events, and counts `requestAnimationFrame` callbacks against the wall
 * clock. Arms interleaved, order flipped each round, one warm-up per arm
 * discarded; prints each pass and the median per arm.
 */
import { chromium } from "playwright-core";

const arms = process.argv.slice(2).filter((a) => a.includes("=")).map((a) => a.split("="));
const rounds = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 5);
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);

const COVERS = ["windom", "icaros", "text_encrypting"];
const POSTS = Array.from({ length: 6 }, (_, i) => ({
  slug: `fixture-${i}`,
  title: `A note about decision ${i + 1}`,
  subtitle: "What it cost, and what it bought",
  excerpt: "What it cost.",
  publishedAt: "2026-09-01T00:00:00.000Z",
  tags: [],
  collection: "site",
  coverImage: i % 2 === 0 ? `/projects/${COVERS[i / 2]}-1200.jpg` : null,
  readingMinutes: 5,
}));

const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function pass(base) {
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  await context.route("**/api/blog/posts", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: POSTS }) })
  );
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#notes a[href^='/blog/fixture']"), null, {
    polling: 500,
    timeout: 30000,
  });
  for (let i = 0; i < 20; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
  }
  const { top, height } = await page.evaluate(() => {
    const r = document.querySelector("#notes").getBoundingClientRect();
    return { top: r.top + scrollY, height: r.height };
  });
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top - H);
  await page.mouse.move(W / 2, H / 2);
  const cdp = await context.newCDPSession(page);
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
  await context.close();
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
  const xs = results[label];
  console.log(
    `${label}: median ${median(xs).toFixed(1)}fps over ${xs.length} (range ${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)})`
  );
}
await browser.close();
