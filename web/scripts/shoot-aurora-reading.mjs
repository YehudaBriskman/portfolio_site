/*
 * The reading pen, shot and measured (owner, 2026-11-03), into
 * docs/aurora-reading/. (Its strand frames, A and B, moved to
 * `shoot-aurora-v3.mjs` when the owner had the band on "How I work"
 * removed and the notes' strand re-seated on the cards.)
 *
 *   C    the pen: frames at several scroll positions through "How I work"
 *        and a project page, and at EVERY position stepped through, the
 *        number of blocks mid-ink (some words written, some not, or one word
 *        between) — asserted to be at most one — and the place in the window
 *        at which a block's first word starts, asserted to be 65–70%.
 *
 * Both themes, desktop and phone. Frames are driven by hand with
 * `HeadlessExperimental.beginFrame` (this box's headless Chromium fires
 * almost no rAF, motion contract), so every shot is the settled state at
 * that scroll position.
 *
 *   npm run build && xvfb-run -a node scripts/shoot-aurora-reading.mjs
 *
 * Exits non-zero if an assertion fails; `report.json` has every number.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer as stub, startPreview } from "./a11y/site-stub.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? resolve(HERE, "../../docs/aurora-reading");
mkdirSync(OUT, { recursive: true });

/* Six notes, so the shelf has a row to lie the strand behind. */
function answer(url) {
  const r = stub(url, false);
  if (new URL(url).pathname === "/api/blog/posts") {
    const [one] = r.body.items;
    r.body.items = Array.from({ length: 6 }, (_, i) => ({ ...one, slug: `${one.slug}-${i}`, title: `${one.title} ${i + 1}` }));
  }
  return r;
}

const WINDOWS = [
  ["desk", 1440, 900],
  ["phone", 390, 844],
];
const THEMES = (process.env.THEMES ?? "light,dark").split(",");

async function launch(width, height, theme) {
  const context = await chromium.launchPersistentContext("", {
    executablePath: process.env.CHROME || undefined,
    viewport: { width, height },
    colorScheme: theme,
    args: ["--no-sandbox", "--enable-begin-frame-control", "--run-all-compositor-stages-before-draw", "--disable-gpu", "--font-render-hinting=none"],
  });
  await context.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
  await context.route("**/api/**", (r) => {
    const { status, body } = answer(r.request().url());
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return context;
}

let tick = 0;
async function frame(cdp, shot = false) {
  tick += 1;
  const r = await cdp.send("HeadlessExperimental.beginFrame", {
    frameTimeTicks: tick * 16.667,
    interval: 16.667,
    ...(shot ? { screenshot: { format: "png" } } : {}),
  });
  return r.screenshotData;
}

async function open(context, base, route, width, height, ready) {
  const anyPage = context.pages()[0] ?? (await context.newPage());
  const ctl = await context.newCDPSession(anyPage);
  const made = context.waitForEvent("page");
  await ctl.send("Target.createTarget", { url: "about:blank", enableBeginFrameControl: true });
  const page = await made;
  await page.setViewportSize({ width, height });
  const cdp = await context.newCDPSession(page);
  const nav = page.goto(base + route, { waitUntil: "load" });
  for (let i = 0; i < 400; i += 1) {
    await frame(cdp).catch(() => {});
    if (await page.evaluate((s) => document.readyState === "complete" && !!document.querySelector(s), ready).catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  await nav.catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 80; i += 1) {
    await frame(cdp);
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  /* The sequencer measures on a task; let it run. */
  for (let i = 0; i < 6; i += 1) {
    await new Promise((r) => setTimeout(r, 60));
    await frame(cdp);
  }
  return { page, cdp };
}

async function scrollTo(page, cdp, y) {
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y);
  /* Give the observers a task, then settle the frame. */
  for (let i = 0; i < 3; i += 1) {
    await frame(cdp);
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function shoot(cdp, name) {
  await frame(cdp);
  writeFileSync(resolve(OUT, name), Buffer.from(await frame(cdp, true), "base64"));
  return name;
}

/*
 * The pen's state in the window: every block on screen, how written it is
 * (0 muted … 1 ink), and where its top is as a share of the window.
 */
function penState(page, scope) {
  return page.evaluate((s) => {
    const H = innerHeight;
    const alpha = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return 1;
      const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return parts.length > 3 ? parts[3] : 1;
    };
    const out = [];
    for (const b of document.querySelector(s).querySelectorAll("[data-written]")) {
      const r = b.getBoundingClientRect();
      if (r.height === 0) continue;
      const words = [...b.querySelectorAll("[data-word]")].filter((w) => w.parentElement.closest("[data-written]") === b);
      if (!words.length) continue;
      const a = words.map((w) => alpha(getComputedStyle(w).color));
      const muted = Math.min(...a);
      const lit = a.filter((v) => v > 0.995).length;
      const between = a.filter((v) => v > muted + 0.005 && v < 0.995).length;
      out.push({
        top: r.top / H,
        bottom: r.bottom / H,
        words: a.length,
        lit,
        between,
        mid: (lit > 0 && lit < a.length) || between > 0,
        text: b.textContent.slice(0, 40),
      });
    }
    return out;
  }, scope);
}

const report = { failures: [], runs: [] };
const fail = (m) => {
  report.failures.push(m);
  console.log(`  ✗ ${m}`);
};

const { base, stop } = await startPreview();
try {
  for (const theme of THEMES) {
    for (const [wname, width, height] of WINDOWS) {
      const tag = `${theme}-${wname}`;
      const context = await launch(width, height, theme);
      console.log(tag);

      /* ── C: the pen, one block at a time ───────────────────────────── */
      for (const [key, route, scope, ready] of [
        ["home", "/", "#approach", "#approach [data-written]"],
        ["project", "/projects/bothy", "main", "main [data-written]"],
      ]) {
        const { page, cdp } = await open(context, base, route, width, height, ready);
        const first = await page.evaluate((s) => {
          const b = document.querySelector(s).querySelector("[data-written]");
          return b.getBoundingClientRect().top + scrollY;
        }, scope);
        const last = await page.evaluate((s) => {
          const all = document.querySelector(s).querySelectorAll("[data-written]");
          const b = all[all.length - 1];
          return b.getBoundingClientRect().bottom + scrollY;
        }, scope);
        /* Step through the whole run of prose, 1/40 of the window at a time. */
        const step = Math.round(height / 40);
        let worst = 0;
        let starts = [];
        let prev = null;
        let shots = 0;
        const shotEvery = Math.max(1, Math.floor((last - first + height) / step / 8));
        let n = 0;
        for (let y = first - height; y <= last; y += step, n += 1) {
          await scrollTo(page, cdp, y);
          const blocks = await penState(page, scope);
          const mid = blocks.filter((b) => b.mid);
          worst = Math.max(worst, mid.length);
          if (mid.length > 1) fail(`${key} ${tag} at ${y}: ${mid.length} blocks mid-ink: ${mid.map((b) => JSON.stringify(b.text)).join(", ")}`);
          /* A block's first word leaving muted: where is the block's top? */
          if (prev) {
            for (const b of blocks) {
              const before = prev.find((p) => p.text === b.text);
              if (before && before.lit === 0 && before.between === 0 && (b.lit > 0 || b.between > 0)) starts.push({ text: b.text, top: b.top, prevTop: before.top });
            }
          }
          prev = blocks;
          if (n % shotEvery === 0 && shots < 8) {
            const name = await shoot(cdp, `pen-${key}-${tag}-${shots}.png`);
            report.runs.push({ kind: "pen-frame", key, tag, y, name, mid: mid.map((b) => ({ text: b.text, top: +b.top.toFixed(3), lit: b.lit, of: b.words })) });
            shots += 1;
          }
        }
        /* A block that starts on its own schedule starts with its top
           between 65% and 70% (within one step); one held for its turn
           starts later (higher), never earlier. */
        const early = starts.filter((s) => s.prevTop > 0.7 + 1 / 40 + 0.005);
        for (const s of early) fail(`${key} ${tag}: "${s.text}" started with its top at ${s.prevTop.toFixed(3)}, below 70%`);
        const onTime = starts.filter((s) => s.prevTop >= 0.65 && s.top <= 0.7);
        report.runs.push({ kind: "pen", key, tag, worstMidInk: worst, starts: starts.map((s) => ({ text: s.text, between: [+s.top.toFixed(3), +s.prevTop.toFixed(3)] })) });
        console.log(`  ${key}: at most ${worst} block(s) mid-ink; ${starts.length} starts, ${onTime.length} on the 65–70% line, ${early.length} early`);
        if (!onTime.length) fail(`${key} ${tag}: no block started on the 65–70% line`);
        await page.close();
      }
      await context.close();
    }
  }
} finally {
  stop();
}
writeFileSync(resolve(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(report.failures.length ? `\n${report.failures.length} failure(s)` : "\nall clear");
process.exit(report.failures.length ? 1 : 0);
