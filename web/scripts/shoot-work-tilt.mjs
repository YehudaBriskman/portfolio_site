/*
 * The work run's shadow and tilt (#177), at 1440x900, English and Hebrew.
 *
 * What it shoots, into `docs/work-run/`:
 *
 *   tilt-1440x900[-he]-hover.png   the pointer near the top end corner of
 *                                  the card in the middle of the curve
 *   tilt-1440x900[-he]-focus.png   Tab to the third card: the fixed turn
 *
 * and prints, for each, the face's computed transform and the link's, so the
 * tilt can be seen to sit on the face while the link keeps its lean.
 *
 * With `MEASURE=<labelA>=<baseA>,<labelB>=<baseB>` it measures instead: at
 * 4x CPU throttle, the pointer is moved back and forth across that card in
 * small steps with real input events, counting `requestAnimationFrame`
 * callbacks against the wall clock and reading the renderer's script, style
 * and layout time per move from CDP `Performance.getMetrics`. Arms are
 * interleaved, order flipped each round, one warm-up discarded.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4398 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-work-tilt.mjs`. There is almost no frame
 * clock in headless Chromium on this box, so frames are driven by throwaway
 * screenshots and every wait polls on a timer (`{ polling: 500 }`).
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../docs/work-run");
const BASE = process.env.BASE ?? "http://localhost:4398";
const W = 1440;
const H = 900;
mkdirSync(OUT, { recursive: true });

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

async function open(base, rtl) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(`${base}/`, { waitUntil: "load" });
  if (rtl) {
    await page.evaluate(() => {
      document.documentElement.dir = "rtl";
      document.documentElement.lang = "he";
    });
  }
  await page.waitForFunction(() => document.querySelector("[data-run-stage] a"), null, {
    polling: 500,
    timeout: 20000,
  });
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
  }
  return page;
}

/* Scroll to card i's moment, where it stands in the middle of the curve. */
async function toCard(page, i) {
  await page.evaluate((n) => {
    document
      .querySelector(`[data-run-mark="${n}"]`)
      .scrollIntoView({ behavior: "instant", block: "start" });
  }, i);
  await frames(page, 4);
  await page.waitForTimeout(600);
  await frames(page, 1);
}

async function box(page, i) {
  return page.evaluate((n) => {
    const r = document.querySelector(`[data-run-i="${n}"] a`).getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, i);
}

async function transforms(page, i) {
  return page.evaluate((n) => {
    const a = document.querySelector(`[data-run-i="${n}"] a`);
    const f = a.querySelector("[data-run-face]");
    return {
      link: `${getComputedStyle(a).rotate} | ${getComputedStyle(a).transform.slice(0, 40)}`,
      face: getComputedStyle(f).transform,
      tilt: [f.style.getPropertyValue("--tilt-x"), f.style.getPropertyValue("--tilt-y")],
      size: [Math.round(f.offsetWidth), Math.round(f.offsetHeight)],
    };
  }, i);
}

async function shoot() {
  for (const rtl of [false, true]) {
    const tag = `${W}x${H}${rtl ? "-he" : ""}`;
    const page = await open(BASE, rtl);
    const i = 1;
    await toCard(page, i);
    const b = await box(page, i);
    /* Towards the top of the card's onward end: the reading end in each. */
    const ex = rtl ? b.x + b.w * 0.15 : b.x + b.w * 0.85;
    await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
    await page.mouse.move(ex, b.y + b.h * 0.2, { steps: 6 });
    await page.waitForFunction(
      (n) =>
        document
          .querySelector(`[data-run-i="${n}"] [data-run-face]`)
          .style.getPropertyValue("--tilt-x") !== "",
      i,
      { polling: 500, timeout: 120000 }
    );
    await frames(page, 4);
    await page.waitForTimeout(400);
    console.log(tag, "hover", JSON.stringify(await transforms(page, i)));
    await page.screenshot({ path: `${OUT}/tilt-${tag}-hover.png` });

    await page.mouse.move(W / 2, 30);
    await page.focus('[data-run-stage] [data-run-i="0"] a');
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await frames(page, 4);
    await page.waitForTimeout(1000);
    await frames(page, 2);
    console.log(tag, "focus", JSON.stringify(await transforms(page, 2)));
    await page.screenshot({ path: `${OUT}/tilt-${tag}-focus.png` });
    await page.close();
  }
}

async function pass(base) {
  const page = await open(base, false);
  await toCard(page, 1);
  const b = await box(page, 1);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.mouse.move(b.x + b.w * 0.1, b.y + b.h / 2);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const metric = async () =>
    Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value])
    );
  const m0 = await metric();
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
  const moves = 240;
  for (let k = 0; k < moves; k += 1) {
    const t = (k % 60) / 59;
    const u = Math.floor(k / 60) % 2 ? 1 - t : t;
    await page.mouse.move(b.x + b.w * (0.1 + 0.8 * u), b.y + b.h * (0.2 + 0.6 * u));
    await page.waitForTimeout(16);
  }
  const fps = await page.evaluate(() => {
    window.__run = false;
    return (window.__frames * 1000) / (performance.now() - window.__t0);
  });
  const m1 = await metric();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.close();
  const per = (k) => ((m1[k] - m0[k]) * 1000) / moves;
  return {
    fps,
    script: per("ScriptDuration"),
    style: per("RecalcStyleDuration"),
    layout: per("LayoutDuration"),
  };
}

async function measure(spec) {
  const arms = spec.split(",").map((a) => a.split("="));
  const rounds = Number(process.env.ROUNDS ?? 5);
  const res = Object.fromEntries(arms.map(([l]) => [l, []]));
  for (const [, base] of arms) await pass(base);
  for (let r = 0; r < rounds; r += 1) {
    const order = r % 2 ? [...arms].reverse() : arms;
    for (const [label, base] of order) {
      const p = await pass(base);
      res[label].push(p);
      console.log(
        `round ${r} ${label} ${p.fps.toFixed(1)}fps script ${p.script.toFixed(2)}ms style ${p.style.toFixed(2)}ms layout ${p.layout.toFixed(2)}ms per move`
      );
    }
  }
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  for (const [label] of arms) {
    const xs = res[label];
    console.log(
      `${label}: median ${median(xs.map((x) => x.fps)).toFixed(1)}fps, ` +
        `script ${median(xs.map((x) => x.script)).toFixed(2)}ms, ` +
        `style ${median(xs.map((x) => x.style)).toFixed(2)}ms, ` +
        `layout ${median(xs.map((x) => x.layout)).toFixed(2)}ms per move over ${xs.length}`
    );
  }
}

if (process.env.MEASURE) await measure(process.env.MEASURE);
else await shoot();
await browser.close();
