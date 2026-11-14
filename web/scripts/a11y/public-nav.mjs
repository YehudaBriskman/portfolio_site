#!/usr/bin/env node
/*
 * The public phone nav (#775), in real Chromium with touch emulation, against
 * the built site (`npm run build` first):
 *
 *   npm run a11y:public-nav        under 20 s
 *
 * Under 640px the nav is ONE floating circle (44-48px, width == height) with
 * the menu icon, at the inline-end top corner, and nothing else: no bar, no
 * rule across the screen, no visible word. Per phone window x English/Hebrew x
 * routes:
 *   shape      exactly one circle; no visible "Menu"/"תפריט" text; no fixed or
 *              absolute full-width strip in the dock with a ground or a border;
 *   name       aria-label is the existing word, aria-expanded is false;
 *   place      inside the safe area at the inline-end edge (mirrored in he),
 *              also with a notch / landscape inset emulated;
 *   clear      no overlap with the first heading's box or the page's first
 *              block of text near the top;
 *   behaviour  a tap opens the menu, Escape closes it and focus returns to the
 *              circle, a second tap closes it, the sheet never leaves it
 *              unreachable (the circle is still on top while it is open).
 * At 768 and 1280 the bar is unchanged: the word is there, the bar is full width.
 *
 * Fixed waits, never rAF: headless Chromium here emits about one frame per 40 s.
 * CHROME overrides the browser binary.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./site-stub.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");

const PHONES = [
  ["360x640", 360, 640],
  ["390x844", 390, 844],
  ["430x932", 430, 932],
  ["390x667", 390, 667],
];
const ROUTES = ["/", "/blog", "/blog/fixture-post", "/projects", "/projects/bothy", "/contact", "/help"];
const WORDS = ["Menu", "תפריט"];

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

async function open({ w, h, he, route = "/", dark = false, insets }) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w < 640,
    isMobile: w < 640,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    colorScheme: dark ? "dark" : "light",
  });
  await ctx.route(/\/api\//, async (r) => {
    const a = answer(r.request().url());
    await r.fulfill({ status: a.status ?? 200, contentType: "application/json", body: typeof a.body === "string" ? a.body : JSON.stringify(a.body ?? a) });
  });
  const page = await ctx.newPage();
  if (insets) await (await ctx.newCDPSession(page)).send("Emulation.setSafeAreaInsetsOverride", { insets });
  const path = he ? (route === "/" ? "/he" : `/he${route}`) : route;
  await page.goto(base + path, { waitUntil: "load" });
  await page.waitForSelector('button[aria-controls="nav-menu"]', { state: "attached", timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
  await page.waitForTimeout(Number(process.env.SETTLE || 600));
  return { ctx, page };
}

/* Runs in the page. */
function measure() {
  const vw = innerWidth;
  const rtl = document.documentElement.dir === "rtl";
  const dock = document.querySelector('header[class*="_dock_"]');
  const btn = document.querySelector('button[aria-controls="nav-menu"]');
  const box = (e) => {
    const b = e.getBoundingClientRect();
    return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height };
  };
  const shown = (e) => {
    const cs = getComputedStyle(e);
    const b = e.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && b.width > 0 && b.height > 0;
  };
  const out = { vw, rtl, btn: btn && shown(btn) ? box(btn) : null };
  out.name = btn && { label: btn.getAttribute("aria-label"), expanded: btn.getAttribute("aria-expanded") };
  /* Visible words anywhere in the dock. */
  out.words = [];
  /* Full-width strips with a ground or a border. */
  out.strips = [];
  for (const e of dock?.querySelectorAll("*") ?? []) {
    if (!shown(e)) continue;
    const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
    if (own) out.words.push(own);
    const b = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    const ground = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
    const line = parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== "none";
    if (b.width >= vw * 0.9 && b.height <= 120 && (ground || line)) out.strips.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 24)}`);
    if (cs.backdropFilter !== "none" && cs.backdropFilter !== "") out.strips.push(`blur on ${e.tagName.toLowerCase()}`);
  }
  const hs = [...document.querySelectorAll("main h1, main h2, h1, h2")].filter(shown).filter((e) => !dock?.contains(e));
  const first = hs.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
  out.heading = first ? { ...box(first), text: first.textContent.trim().slice(0, 24) } : null;
  /* Any text node in the page that overlaps the circle's box, at scrollY 0. */
  out.covered = [];
  if (btn) {
    const c = btn.getBoundingClientRect();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || dock?.contains(n.parentElement)) continue;
      const p = n.parentElement;
      const cs = getComputedStyle(p);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.position === "fixed" || p.closest("[aria-hidden='true'], .sr-only")) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue;
        if (r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top) out.covered.push(n.textContent.trim().slice(0, 20));
      }
    }
  }
  return out;
}

const circleOk = (where, m, insets = {}) => {
  if (!m.btn) return fail(where, "no visible circle");
  const { w, h } = m.btn;
  if (Math.abs(w - h) > 0.5) fail(where, `the control is ${w}x${h}, want a circle (equal sides)`);
  if (w < 44 - 0.5 || w > 48 + 0.5) fail(where, `the circle is ${w}px, want 44-48`);
  const endGap = m.rtl ? m.btn.l : m.vw - m.btn.r;
  const inset = (m.rtl ? insets.left : insets.right) ?? 0;
  if (endGap < inset - 0.5) fail(where, `the circle is ${Math.round(endGap)}px from the inline-end edge, inside the ${inset}px inset`);
  if (endGap > inset + 24) fail(where, `the circle is ${Math.round(endGap)}px from the inline-end edge, want 24 or less (it is not in the corner)`);
  if (m.btn.t < (insets.top ?? 0) - 0.5) fail(where, `the circle is ${Math.round(m.btn.t)}px from the top, inside the ${insets.top}px inset`);
  if (m.btn.t > (insets.top ?? 0) + 24) fail(where, "the circle is not in the top corner");
  if (m.words.some((x) => WORDS.includes(x))) fail(where, `a visible word is left in the dock: ${m.words.join("|")}`);
  if (m.strips.length) fail(where, `a bar, line or blur is left: ${m.strips.join(", ")}`);
  if (!WORDS.includes(m.name.label ?? "")) fail(where, `aria-label is "${m.name.label}", want the existing Menu/תפריט string`);
  if (m.name.expanded !== "false") fail(where, "aria-expanded is not false at rest");
  if (m.covered.length) fail(where, `the circle sits on top of text: ${[...new Set(m.covered)].join(" | ")}`);
};

async function phones() {
  const jobs = [];
  for (const [name, w, h] of PHONES) for (const he of [false, true]) for (const route of ROUTES) jobs.push({ name, w, h, he, route });
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        const where = `${j.name} ${j.he ? "he" : "en"} ${j.route}`;
        const { ctx, page } = await open(j);
        try {
          const m = await page.evaluate(measure);
          circleOk(where, m);
          if (m.btn && m.heading && m.btn.l < m.heading.r && m.btn.r > m.heading.l && m.btn.t < m.heading.b && m.btn.b > m.heading.t) {
            fail(where, `the circle overlaps the first heading "${m.heading.text}"`);
          }
        } finally {
          await ctx.close();
        }
      }
    }),
  );
}

async function behaviour() {
  await Promise.all(
    [false, true].map(async (he) => {
      const where = `390x844 ${he ? "he" : "en"} behaviour`;
      const { ctx, page } = await open({ w: 390, h: 844, he, route: "/blog" });
      try {
        const btn = page.locator('button[aria-controls="nav-menu"]');
        const state = () => page.evaluate(() => ({
          expanded: document.querySelector('button[aria-controls="nav-menu"]').getAttribute("aria-expanded"),
          sheet: !document.getElementById("nav-menu").hidden,
          focus: document.activeElement === document.querySelector('button[aria-controls="nav-menu"]'),
          top: (() => {
            const b = document.querySelector('button[aria-controls="nav-menu"]').getBoundingClientRect();
            const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            return !!el?.closest('button[aria-controls="nav-menu"]');
          })(),
        }));
        await btn.click({ force: true });
        await page.waitForTimeout(300);
        let s = await state();
        if (s.expanded !== "true" || !s.sheet) fail(where, "a tap does not open the menu");
        if (!s.top) fail(where, "the circle is covered by the open menu, so it cannot be closed");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        s = await state();
        if (s.expanded !== "false" || s.sheet) fail(where, "Escape does not close the menu");
        if (!s.focus) fail(where, "focus does not return to the circle after Escape");
        await btn.click({ force: true });
        await page.waitForTimeout(300);
        await btn.click({ force: true });
        await page.waitForTimeout(300);
        s = await state();
        if (s.sheet) fail(where, "a second tap does not close the menu");
        /* A link in the sheet closes it and moves on. */
        await btn.click({ force: true });
        await page.waitForTimeout(300);
        await page.locator('#nav-menu a[href$="/projects"], #nav-menu a[href="/he/projects"]').first().click({ force: true });
        await page.waitForTimeout(600);
        s = await state();
        if (s.sheet) fail(where, "following a link does not close the menu");
        /* Scrolled: the circle is still there. */
        await page.evaluate(() => scrollTo(0, 400));
        await page.waitForTimeout(300);
        const m = await page.evaluate(measure);
        if (!m.btn) fail(where, "the circle is gone after scrolling");
      } finally {
        await ctx.close();
      }
    }),
  );
}

/* A notch in portrait, and a short wide phone window with side insets. */
async function safeAreas() {
  const cases = [
    ["portrait notch", 390, 844, { top: 47, bottom: 34, left: 0, right: 0 }],
    ["side insets 600x320", 600, 320, { top: 0, bottom: 21, left: 47, right: 47 }],
  ];
  await Promise.all(
    cases.flatMap(([name, w, h, insets]) =>
      [false, true].map(async (he) => {
        const where = `${name} ${he ? "he" : "en"}`;
        const { ctx, page } = await open({ w, h, he, insets });
        try {
          const m = await page.evaluate(measure);
          circleOk(where, m, insets);
        } finally {
          await ctx.close();
        }
      }),
    ),
  );
}

/* Tablet and desktop keep today's bar. */
async function wide() {
  for (const [w, h] of [[768, 1024], [1280, 800]]) {
    const { ctx, page } = await open({ w, h, he: false });
    try {
      const where = `${w}x${h} unchanged`;
      const m = await page.evaluate(() => {
        const dock = document.querySelector('header[class*="_dock_"]');
        const bar = dock.querySelector('[class*="_bar_"]');
        const b = bar.getBoundingClientRect();
        return { w: b.width, vw: innerWidth, line: parseFloat(getComputedStyle(bar).borderBottomWidth), blur: getComputedStyle(bar).backdropFilter };
      });
      if (m.w < m.vw - 1) fail(where, "the bar is no longer full width");
      if (m.line !== 1) fail(where, "the bar's bottom line changed");
      if (m.blur === "none") fail(where, "the bar's blur changed");
    } finally {
      await ctx.close();
    }
  }
}

const t0 = Date.now();
try {
  await phones();
  await behaviour();
  await safeAreas();
  await wide();
} finally {
  await browser.close();
  stop();
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (failures.length) {
  console.error(`public-nav: ${failures.length} problem(s) in ${secs}s`);
  for (const f of [...new Set(failures)].sort().slice(0, 60)) console.error("  " + f);
  process.exit(1);
}
console.log(`public-nav: ok in ${secs}s`);
