/*
 * Frame cost of /projects at 4x CPU throttle (#169).
 *
 *   xvfb-run -a node scripts/measure-projects-fps.mjs [rounds] label=http://host:port ...
 *
 * Each arm is a build served somewhere (`vite preview`). Each pass loads
 * /projects, wheel-scrolls the whole document top to bottom with real input
 * events, and counts rAF frames over wall clock; a discarded warm-up pass
 * per arm, then rounds interleaved with the order flipped each round, same
 * as `measure-work-fps.mjs`. `SET=many` mocks twenty collections through
 * `page.route` (nothing is written to the data); a label ending `-reduced` runs its arm
 * under prefers-reduced-motion, which is the plain page with nothing scrubbed.
 */
import { chromium } from "playwright-core";

const arms = process.argv.slice(2).filter((a) => a.includes("=")).map((a) => a.split("="));
const rounds = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 5);
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const MANY = process.env.SET === "many";

function many() {
  return Array.from({ length: 20 }, (_, i) => ({
    slug: `fixture-${i + 1}`,
    title: `Fixture ${i + 1}`,
    tagline: "A small tool that does one thing",
    description: "Fixture.",
    coverImage: null,
    links: [],
    order: 60 + i,
    kind: "project",
    repoUrl: null,
    stats: null,
  }));
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function pass(base, reduced) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await context.route("**/api/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: MANY ? many() : [] }),
    })
  );
  const page = await context.newPage();
  await page.goto(`${base}/projects`, { waitUntil: "load" });
  await page.waitForFunction(
    (n) => document.querySelectorAll("main a[href^='/projects/']").length >= n,
    MANY ? 26 : 6,
    { polling: 500, timeout: 30000 }
  );
  for (let i = 0; i < 20; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
  }
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
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
  for (let d = 0; d < height; d += 100) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(16);
  }
  const fps = await page.evaluate(() => {
    window.__run = false;
    return (window.__frames * 1000) / (performance.now() - window.__t0);
  });
  await context.close();
  return { fps, height };
}

const reducedArm = (label) => label.endsWith("-reduced");
const results = Object.fromEntries(arms.map(([l]) => [l, []]));
for (const [label, base] of arms) await pass(base, reducedArm(label));
for (let r = 0; r < rounds; r += 1) {
  const order = r % 2 ? [...arms].reverse() : arms;
  for (const [label, base] of order) {
    const { fps, height } = await pass(base, reducedArm(label));
    results[label].push(fps);
    console.log(`round ${r} ${label} ${fps.toFixed(1)}fps (page ${height}px)`);
  }
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const [label] of arms) {
  const xs = results[label];
  console.log(
    `${label}: median ${median(xs).toFixed(1)}fps, range ${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)} over ${xs.length}`
  );
}
await browser.close();
