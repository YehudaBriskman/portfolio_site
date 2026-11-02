/*
 * A frame strip of the hero's arrival against the entry shutter (#219).
 *
 *   npm run build && npx vite preview --port 4194 --strictPort &
 *   xvfb-run -a node scripts/capture-hero-arrival.mjs http://localhost:4194/ <out-dir>
 *
 * `measure-hero-entry.mjs` times the events; this one keeps the pictures, so
 * the number of arrivals a reader *sees* can be counted rather than inferred.
 * The same frame pump drives the clock (this box's Chromium schedules almost
 * no frames on its own): every capture forces one, and every capture is kept,
 * as `<kind>-<ms>.png`, ms from navigation start by the page's own clock, with
 * the entry step at that moment in `frames.json`. CPU is throttled 4x. One
 * cold load in a fresh context, then a cached one in the same context, at
 * 1440×900, English.
 *
 * The page's clock is read alongside each capture rather than after it, so a
 * frame's time is when it was asked for, which is within a frame of when it
 * was drawn. Frames are kept from the first tile leaving to 1.5s after the
 * sheet is gone.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [url = "http://localhost:4194/", out = "hero-frames"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const probe = () => {
  const t = (window.__t = { shutter: {}, play: null, lcp: null });
  const now = () => Math.round(performance.now());
  const isShutter = (n) => n.nodeType === 1 && n.hasAttribute("data-state") && n.getAttribute("aria-hidden") === "true";
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "attributes" && isShutter(m.target)) t.shutter[m.target.getAttribute("data-state")] ??= now();
      if (m.type === "attributes" && m.attributeName === "data-arrival" && m.target.getAttribute("data-arrival") === "play") t.play ??= now();
      for (const n of m.removedNodes) if (isShutter(n)) t.shutter.removed ??= now();
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "data-arrival"] });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) t.lcp = { t: Math.round(e.startTime), el: e.element?.tagName ?? null };
  }).observe({ type: "largest-contentful-paint", buffered: true });
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });

/* The first contexts a browser opens get no frames even with the pump. */
for (let w = 0; w < 4; w += 1) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  let on = true;
  const p = (async () => {
    while (on) await Promise.race([cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 1 }).catch(() => {}), sleep(1000)]);
  })();
  await page.goto(url, { waitUntil: "load", timeout: 15000 }).catch(() => {});
  await sleep(2000);
  on = false;
  await Promise.race([p, sleep(3000)]);
  await ctx.close().catch(() => {});
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(probe);
const summary = {};
for (const kind of ["cold", "cached"]) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const frames = [];
  let on = true;
  const p = (async () => {
    while (on) {
      const at = await page.evaluate(() => [Math.round(performance.now()), document.documentElement.dataset.entry ?? null]).catch(() => null);
      const shot = await Promise.race([cdp.send("Page.captureScreenshot", { format: "png" }).catch(() => null), sleep(1000)]);
      if (at && shot?.data) frames.push({ t: at[0], entry: at[1], data: shot.data });
    }
  })();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page
    .waitForFunction(() => window.__t?.shutter.removed !== undefined && performance.now() > window.__t.shutter.removed + 1700, null, {
      polling: 250,
      timeout: 20000,
    })
    .catch(() => {});
  on = false;
  await p;
  const t = await page.evaluate(() => window.__t);
  const from = t.shutter.leaving ?? 0;
  const to = (t.shutter.removed ?? Infinity) + 1500;
  const kept = frames.filter((f) => f.t >= from - 40 && f.t <= to);
  for (const f of kept) writeFileSync(join(out, `${kind}-${String(f.t).padStart(5, "0")}.png`), Buffer.from(f.data, "base64"));
  summary[kind] = { events: t, frames: kept.map(({ t: ft, entry }) => ({ t: ft, entry })) };
  console.error(`${kind}: ${kept.length} frames, lift ${t.shutter.leaving}, gone ${t.shutter.removed}, play ${t.play}, lcp ${JSON.stringify(t.lcp)}`);
  await page.close();
}
writeFileSync(join(out, "frames.json"), JSON.stringify(summary, null, 2));
await browser.close();
