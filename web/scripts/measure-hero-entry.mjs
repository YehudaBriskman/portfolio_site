/*
 * The hero's arrival against the entry shutter (#194): when the cover starts
 * to lift, when it is gone, and when the hero's own arrival starts and ends.
 *
 *   npm run build && npx vite preview --port 4194 --strictPort &
 *   xvfb-run -a node scripts/measure-hero-entry.mjs http://localhost:4194/ after 5
 *
 * The frame clock is the whole difficulty. This box's Chromium — headless
 * or headed under xvfb, measured both ways — schedules almost no frames on
 * its own (0 rAF callbacks in 2s), so neither the shutter's double rAF nor a
 * clock animation would advance, and `animationend` would never fire. A
 * screenshot forces a frame, so a CDP capture loop runs for the whole load
 * and pumps the clock at roughly 60 frames a second. The wait polls every
 * 500ms rather than on rAF for the same reason. The first context a browser
 * opens gets no frames even with the pump (nor, often, the next), so four
 * warm-up loads are spent first.
 *
 * CPU is throttled 4x so the shutter has real work to wait for; `NET=slow`
 * adds a 150ms / 1.6Mbps link, which is where readiness — and so the lift —
 * comes late enough to separate "started at mount" from "started at the
 * lift" by more than a frame or two. Each run is
 * a fresh context (cold), then a second load in the same context (cached:
 * revalidated from the HTTP cache). All times are ms from navigation start.
 * Set CHROME to a Chromium binary when playwright-core's own is not installed.
 */
import { chromium } from "playwright-core";

const [url = "http://localhost:4194/", label = "run", runsArg = "3"] = process.argv.slice(2);
const runs = Number(runsArg);

const probe = () => {
  const t = (window.__t = { shutter: {}, hero: [], lcp: null });
  const now = () => Math.round(performance.now());
  const isShutter = (n) => n.nodeType === 1 && n.hasAttribute("data-state") && n.getAttribute("aria-hidden") === "true";
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "attributes" && isShutter(m.target)) t.shutter[m.target.getAttribute("data-state")] ??= now();
      if (m.type === "attributes" && m.attributeName === "data-arrival" && m.target.getAttribute("data-arrival") === "play") t.play ??= now();
      for (const n of m.removedNodes) if (isShutter(n)) t.shutter.removed ??= now();
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "data-arrival"] });
  for (const type of ["animationstart", "animationend"]) {
    window.addEventListener(
      type,
      (e) => {
        if (e.target.closest?.("#hero")) t.hero.push({ type, name: e.animationName, t: now() });
        else if (type === "animationstart" && e.animationName.includes("shutter")) t.tiles ??= now();
      },
      true,
    );
  }
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) t.lcp = { t: Math.round(e.startTime), el: e.element?.tagName ?? null };
  }).observe({ type: "largest-contentful-paint", buffered: true });
};

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Pump frames for as long as `live()` says so. A capture can hang outright
   in a context that has no frames yet, so each one is given a second. */
function pump(cdp, live) {
  return (async () => {
    while (live()) {
      await Promise.race([cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 1 }).catch(() => {}), sleep(1000)]);
    }
  })();
}

for (let w = 0; w < 4; w += 1) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  let on = true;
  const p = pump(cdp, () => on);
  await page.goto(url, { waitUntil: "load", timeout: 15000 }).catch(() => {});
  await sleep(2000);
  on = false;
  await Promise.race([p, sleep(3000)]);
  await ctx.close().catch(() => {});
  console.error(`warm-up ${w + 1} done`);
}

const rows = [];
for (let r = 0; r < runs; r += 1) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(probe);
  for (const kind of ["cold", "cached"]) {
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    if (process.env.NET === "slow") {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
    }
    let on = true;
    const p = pump(cdp, () => on);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page
      .waitForFunction(() => window.__t?.shutter.removed !== undefined && performance.now() > window.__t.shutter.removed + 2500, null, {
        polling: 500,
        timeout: 20000,
      })
      .catch(() => {});
    on = false;
    await p;
    const t = await page.evaluate(() => window.__t);
    const starts = t.hero.filter((h) => h.type === "animationstart").map((h) => h.t);
    const ends = t.hero.filter((h) => h.type === "animationend").map((h) => h.t);
    const first = starts.length ? Math.min(...starts) : null;
    const last = ends.length ? Math.max(...ends) : null;
    /* A load the pump never got frames into reports no LCP, or one tens of
       seconds late. It measured the harness, not the page: say so. */
    const stalled = t.lcp == null || t.lcp.t > 10000;
    rows.push({
      label: stalled ? `${label} (stalled)` : label,
      run: r + 1,
      kind,
      lcp: t.lcp?.t,
      lcpEl: t.lcp?.el,
      liftStart: t.shutter.leaving,
      coverGone: t.shutter.removed,
      tilesMove: t.tiles,
      play: t.play,
      heroStart: first,
      heroEnd: last,
      anims: starts.length,
      "start−lift": first == null ? "none" : first - t.shutter.leaving,
      "start−tiles": first == null ? "none" : first - t.tiles,
      "end−gone": last == null ? "none" : last - t.shutter.removed,
    });
    await page.close();
    console.error(`${label} ${r + 1} ${kind} done`);
  }
  await ctx.close();
}
await browser.close();
console.table(rows);
