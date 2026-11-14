#!/usr/bin/env node
/*
 * The public landing page's first screen on phones (mobile plan PR 6), in real
 * Chromium with touch emulation, against the built site (`npm run build` first):
 *
 *   npm run a11y:public-landing        about 15 s
 *
 * Per phone window (360x640, 390x844, 430x932, 390x667 short, 844x390
 * landscape) x English/Hebrew x light/dark:
 *   overflow   nothing is wider than the screen, and nothing pokes out past a
 *              screen edge unless a clipping box inside the screen holds it
 *              (a decoration only the document's clip hid was a real defect);
 *   cta        the hero's ask, with the line under it, is wholly on the first
 *              screen and 24px or more clear of its bottom edge;
 *   targets    the ask and every control in the top dock hit 44px (measured by
 *              hit-testing, so an invisible padded target counts);
 *   text       the counter's unit is 12px or more, and iOS is told not to
 *              inflate type in landscape (text-size-adjust: 100%).
 * Then, with a notch emulated (CDP `Emulation.setSafeAreaInsetsOverride`), in
 * portrait and in landscape: the dock pads itself by the insets and its
 * controls, and the ask, sit inside the safe rectangle. And at 768x1024 the
 * tablet's marks and links are 44px targets too.
 * With motion left on, the scroll cue (when there is one) is decoration:
 * aria-hidden, not focusable, and still under reduced motion.
 *
 * Fixed waits, never rAF: headless Chromium here emits about one frame per
 * 40 s. CHROME overrides the browser binary.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./site-stub.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");

const WINDOWS = [
  ["360x640", 360, 640],
  ["390x844", 390, 844],
  ["430x932", 430, 932],
  ["390x667", 390, 667],
  ["844x390", 844, 390],
];
const GAP = 24;
const TARGET = 44;

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

async function open({ w, h, he, dark, reduce = true, insets }) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    reducedMotion: reduce ? "reduce" : "no-preference",
    colorScheme: dark ? "dark" : "light",
  });
  await ctx.route(/\/api\//, async (route) => {
    const a = answer(route.request().url());
    await route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: typeof a.body === "string" ? a.body : JSON.stringify(a.body ?? a) });
  });
  const page = await ctx.newPage();
  if (insets) await (await ctx.newCDPSession(page)).send("Emulation.setSafeAreaInsetsOverride", { insets });
  await page.goto(base + (he ? "/he" : "/"), { waitUntil: "load" });
  await page.waitForSelector('#hero a[href="#contact"]', { state: "attached", timeout: 15000 });
  /* The living line is lazy and sizes itself after fonts: wait for its box. */
  await page.waitForSelector("[data-living-line] svg[viewBox]", { state: "attached", timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  /* With one frame in 40 s a transition started by a late re-measure never
     leaves its first value, so measure the settled layout, not a frozen start. */
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important}" });
  await page.waitForTimeout(Number(process.env.SETTLE || 500));
  return { ctx, page };
}

/* Runs in the page. */
function measure(args) {
  const { TARGET } = args;
  const vw = innerWidth;
  const vh = innerHeight;
  const out = { vw, vh, scrollW: document.documentElement.scrollWidth };

  /* Out past a screen edge, and not held by a clipping box that is itself on the screen.
     The honeypot and the JSON-LD trap sit wholly off-screen on purpose (no overlap with the screen). */
  const clipped = (el) => {
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== "visible" || cs.contain.includes("paint")) {
        const b = a.getBoundingClientRect();
        if (b.left >= -1 && b.right <= vw + 1) return true;
      }
    }
    return false;
  };
  out.over = [...document.querySelectorAll("body *")]
    .filter((e) => {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.position === "fixed") return false;
      const b = e.getBoundingClientRect();
      if (b.width === 0 || b.right <= 0 || b.left >= vw) return false;
      return (b.left < -1 || b.right > vw + 1) && !clipped(e);
    })
    .slice(0, 4)
    .map((e) => `${e.tagName.toLowerCase()}.${String(e.getAttribute("class") ?? "").slice(0, 28)} ${Math.round(e.getBoundingClientRect().left)}..${Math.round(e.getBoundingClientRect().right)}`);

  const link = document.querySelector('#hero a[href="#contact"]');
  const ask = link?.parentElement;
  const ab = ask?.getBoundingClientRect();
  out.ask = ab && { top: ab.top, bottom: ab.bottom, left: ab.left, right: ab.right };
  const dock = document.querySelector('[class*="_dock_"]');
  const bar = dock?.querySelector('[class*="_bar_"]');
  const dcs = bar && getComputedStyle(bar);
  out.dock = bar && {
    height: dock.getBoundingClientRect().height,
    pt: parseFloat(dcs.paddingTop),
    pl: parseFloat(dcs.paddingLeft),
    pr: parseFloat(dcs.paddingRight),
  };

  /* A control's hit box: how far a press still lands on it, probed every 1px
     out from its centre (an invisible ::after counts, a covering sibling does not). */
  const reach = (el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hits = (x, y) => document.elementFromPoint(x, y)?.closest("a,button,input,select,summary,[role=button]") === el;
    const span = (dx, dy) => {
      let a = 0;
      while (a < 40 && hits(cx - dx * (a + 1), cy - dy * (a + 1))) a++;
      let b = 0;
      while (b < 40 && hits(cx + dx * (b + 1), cy + dy * (b + 1))) b++;
      return a + b + 1;
    };
    return { w: span(1, 0), h: span(0, 1) };
  };
  const label = (e) => (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 18);
  out.targets = [];
  if (link) out.targets.push({ name: "ask: " + label(link), ...reach(link) });
  if (dock) {
    for (const e of dock.querySelectorAll("a,button")) {
      const cs = getComputedStyle(e);
      const b = e.getBoundingClientRect();
      if (b.width === 0 || cs.visibility === "hidden" || (e.offsetParent === null && cs.position !== "fixed")) continue;
      if (b.bottom <= 0 || b.top >= 60) continue;
      out.targets.push({ name: "dock: " + label(e), ...reach(e), left: b.left, right: b.right, top: b.top });
    }
  }
  const unit = document.querySelector('[class*="_unit_"]');
  out.unit = unit && parseFloat(getComputedStyle(unit).fontSize);
  /* Authored, not computed: under mobile emulation Chromium resolves the default to 100% too. */
  out.adjust = "";
  for (const sheet of document.styleSheets) {
    let rules = [];
    try {
      rules = [...sheet.cssRules];
    } catch {
      continue;
    }
    for (const r of rules) {
      if (r.selectorText && /(^|,\s*)html\b/.test(r.selectorText)) out.adjust = r.style.getPropertyValue("-webkit-text-size-adjust") || r.style.getPropertyValue("text-size-adjust") || out.adjust;
    }
  }
  out.cue = [...document.querySelectorAll('[data-scroll-cue]')].map((c) => ({
    hidden: c.getAttribute("aria-hidden"),
    focusable: c.matches("a,button,[tabindex]") || !!c.querySelector("a,button,[tabindex]"),
    animations: c.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
  }));
  return out;
}

async function matrix() {
  const jobs = [];
  for (const [name, w, h] of WINDOWS) for (const he of [false, true]) for (const dark of [false, true]) jobs.push({ name, w, h, he, dark });
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        const where = `${j.name} ${j.he ? "he" : "en"} ${j.dark ? "dark" : "light"}`;
        const { ctx, page } = await open(j);
        try {
          const m = await page.evaluate(measure, { TARGET });
          if (m.scrollW > m.vw) fail(where, `document is ${m.scrollW}px wide on a ${m.vw}px screen`);
          for (const o of m.over) fail(where, `wider than the screen and not clipped inside it: ${o}`);
          if (!m.ask) fail(where, "no hero ask found");
          else {
            if (m.ask.bottom > m.vh - GAP) fail(where, `the ask ends ${Math.round(m.vh - m.ask.bottom)}px from the bottom edge, want ${GAP}`);
            if (m.ask.top < 0 || m.ask.left < 0 || m.ask.right > m.vw) fail(where, "the ask is not wholly on the first screen");
          }
          for (const t of m.targets) {
            if (t.h < TARGET - 0.5 || (t.w < TARGET - 0.5)) fail(where, `${t.name} hits ${t.w}x${t.h}, want ${TARGET}`);
          }
          if (m.unit != null && m.unit < 12) fail(where, `the counter unit is ${m.unit}px, want 12`);
          if (m.adjust.trim() !== "100%") fail(where, `text-size-adjust is "${m.adjust.trim()}", want 100% on html`);
        } finally {
          await ctx.close();
        }
      }
    }),
  );
}

/* A notch, in portrait and in landscape; English and Hebrew. */
async function safeAreas() {
  const cases = [
    ["portrait notch", 390, 844, { top: 47, bottom: 34, left: 0, right: 0 }],
    ["landscape notch", 844, 390, { top: 0, bottom: 21, left: 47, right: 47 }],
  ];
  await Promise.all(
    cases.flatMap(([name, w, h, insets]) =>
      [false, true].map(async (he) => {
        const where = `${name} ${he ? "he" : "en"}`;
        const { ctx, page } = await open({ w, h, he, dark: false, insets });
        try {
          const m = await page.evaluate(measure, { TARGET });
          /* Under 640 the nav is one floating circle, not a padded bar (#775; public-nav.mjs holds its place); the circle's own box is checked below. */
          const phone = w < 640;
          if (phone) {
            const c = m.targets.find((x) => x.name.startsWith("dock"));
            if (!c || c.top < insets.top - 0.5) fail(where, "the menu circle reaches into the notch");
          }
          if (!phone && m.dock.pt < insets.top) fail(where, `the dock pads its top by ${m.dock.pt}px, the notch is ${insets.top}px`);
          if (!phone && m.dock.pl < insets.left) fail(where, `the dock pads its left by ${m.dock.pl}px, want ${insets.left}`);
          if (!phone && m.dock.pr < insets.right) fail(where, `the dock pads its right by ${m.dock.pr}px, want ${insets.right}`);
          for (const t of m.targets.filter((x) => x.name.startsWith("dock"))) {
            if (t.left < insets.left - 0.5 || t.right > m.vw - insets.right + 0.5) fail(where, `${t.name} reaches into the notch (${Math.round(t.left)}..${Math.round(t.right)})`);
          }
          if (m.ask.bottom > m.vh - insets.bottom - 8) fail(where, `the ask ends ${Math.round(m.vh - m.ask.bottom)}px from the bottom, inside the ${insets.bottom}px home-indicator inset`);
          if (m.ask.left < insets.left || m.ask.right > m.vw - insets.right) fail(where, "the ask reaches into the side inset");
        } finally {
          await ctx.close();
        }
      }),
    ),
  );
}

/* Tablet: pointer is coarse there too, so the nav's marks and links are 44px. */
async function tablet() {
  for (const he of [false, true]) {
    const { ctx, page } = await open({ w: 768, h: 1024, he, dark: false });
    try {
      const m = await page.evaluate(measure, { TARGET });
      const where = `768x1024 ${he ? "he" : "en"}`;
      if (m.targets.filter((t) => t.name.startsWith("dock")).length < 5) fail(where, "the tablet dock shows fewer controls than expected");
      for (const t of m.targets) if (t.h < TARGET - 0.5 || t.w < TARGET - 0.5) fail(where, `${t.name} hits ${t.w}x${t.h}, want ${TARGET}`);
    } finally {
      await ctx.close();
    }
  }
}

/* Motion left on: a scroll cue, when there is one, is decoration. */
async function cue() {
  for (const reduce of [true, false]) {
    const { ctx, page } = await open({ w: 390, h: 667, he: false, dark: false, reduce });
    try {
      const m = await page.evaluate(measure, { TARGET });
      for (const c of m.cue) {
        if (c.hidden !== "true") fail(`cue reduce=${reduce}`, "the scroll cue is not aria-hidden");
        if (c.focusable) fail(`cue reduce=${reduce}`, "the scroll cue is focusable");
        if (reduce && c.animations) fail(`cue reduce=${reduce}`, "the scroll cue animates under reduced motion");
      }
    } finally {
      await ctx.close();
    }
  }
}

const t0 = Date.now();
try {
  await matrix();
  await safeAreas();
  await tablet();
  await cue();
} finally {
  await browser.close();
  stop();
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (failures.length) {
  console.error(`public-landing: ${failures.length} problem(s) in ${secs}s`);
  for (const f of [...new Set(failures)].sort()) console.error("  " + f);
  process.exit(1);
}
console.log(`public-landing: ok in ${secs}s`);
