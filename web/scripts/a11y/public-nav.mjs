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
 * The merge (#780), phones only, at 390x844 in both languages:
 *   one control  the circle's sheet opens with a local section ([data-local-browse],
 *                heading Browse/עיון) above the global links on /blog, an area,
 *                /projects and a project, with the page's own controls reachable
 *                (a link in it closes the sheet and moves on); pages with nothing
 *                to browse show only the global links; there is no Browse button
 *                and no drawer on the page; at 768 the Browse button is still there;
 *   title row    px from the top to the first h1: lists and text pages 24 or less,
 *                detail pages 72 or less, under the back chip;
 *   back chip    one link to the parent URL (not history), aria-label equal to its
 *                visible name, 40px tall, at the inline-start edge, arrow mirrored
 *                in Hebrew, no second link to the parent above the title;
 *   tuck         the circle tucks on scroll-down past 56px (opacity 0, no press),
 *                returns on scroll-up and on focus, never tucks while the sheet is
 *                open, moves only when motion is allowed. Scroll events are
 *                dispatched by hand: no frame clock here.
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

async function open({ w, h, he, route = "/", dark = false, insets, motion = "reduce" }) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: w < 640,
    isMobile: w < 640,
    deviceScaleFactor: 1,
    reducedMotion: motion,
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
  /* The content box: the title leaves its padding free for the circle (#780). */
  const pad = (e, side) => parseFloat(getComputedStyle(e)[`padding${side}`]) || 0;
  out.heading = first ? { ...box(first), l: box(first).l + pad(first, "Left"), r: box(first).r - pad(first, "Right"), text: first.textContent.trim().slice(0, 24) } : null;
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

/* ------------------------------------------------------------- the merge -- */

const BROWSE = ["Browse", "עיון"];
const LISTS = ["/blog", "/projects", "/story", "/follow", "/help", "/accessibility", "/developers/mcp"];
const DETAILS = ["/projects/bothy", "/blog/area/bothy", "/blog/fixture-post"];
const PARENT = { "/projects/bothy": "/projects", "/blog/area/bothy": "/blog", "/blog/fixture-post": "/blog" };
const WITH_LOCAL = ["/blog", "/blog/area/bothy", "/projects", "/projects/bothy"];
const WITHOUT_LOCAL = ["/help", "/story", "/follow", "/blog/fixture-post"];

/* Waits (by hand, never rAF) for a real h1: the loading one is sr-only. */
const ready = (page) =>
  page.waitForFunction(() => [...document.querySelectorAll("h1")].some((h) => h.getBoundingClientRect().height >= 12), null, { polling: 500, timeout: 20000 });

/* Runs in the page. */
function titleRow() {
  const vis = (e) => {
    const b = e.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== "hidden";
  };
  const rtl = document.documentElement.dir === "rtl";
  const h1 = [...document.querySelectorAll("h1")].find((h) => h.getBoundingClientRect().height >= 12 && !h.closest("[aria-hidden='true']"));
  const hb = h1?.getBoundingClientRect();
  const chips = [...document.querySelectorAll("a[data-back-chip]")];
  const chip = chips[0];
  const cb = chip?.getBoundingClientRect();
  const glyph = chip?.querySelector("svg");
  const parentLinks = chip
    ? [...document.querySelectorAll("main a[href]")].filter((a) => vis(a) && a.pathname === chip.pathname && a.getBoundingClientRect().top < hb.top)
    : [];
  const browseButtons = [...document.querySelectorAll("main button, main [role='button']")].filter(
    (b) => vis(b) && b.getAttribute("aria-haspopup") === "dialog" && /^(Browse|עיון)/.test(b.textContent.trim()),
  );
  return {
    rtl,
    vw: innerWidth,
    h1Top: hb ? Math.round(hb.top * 10) / 10 : null,
    chips: chips.length,
    chip: chip && {
      path: chip.pathname,
      label: chip.getAttribute("aria-label"),
      text: chip.textContent.trim(),
      l: cb.left,
      r: cb.right,
      t: cb.top,
      b: cb.bottom,
      h: cb.height,
      ph: chip.querySelector("[data-back-pill]")?.getBoundingClientRect().height ?? 0,
      glyphHidden: !!glyph?.closest("[aria-hidden='true']"),
      flip: glyph ? getComputedStyle(glyph).transform : "",
    },
    parentLinksAboveTitle: parentLinks.length,
    browseButtons: browseButtons.length,
    dialogs: document.querySelectorAll("main dialog.pop-dialog--side").length,
  };
}

async function titles() {
  const jobs = [];
  for (const he of [false, true]) for (const route of [...LISTS, ...DETAILS]) jobs.push({ he, route });
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        const where = `390x844 ${j.he ? "he" : "en"} ${j.route} title row`;
        const { ctx, page } = await open({ w: 390, h: 844, he: j.he, route: j.route });
        try {
          await ready(page);
          if (DETAILS.includes(j.route)) await page.waitForSelector("a[data-back-chip]", { state: "attached", timeout: 15000 }).catch(() => {});
          const m = await page.evaluate(titleRow);
          const detail = DETAILS.includes(j.route);
          if (m.h1Top === null) fail(where, "no visible h1");
          else if (m.h1Top > (detail ? 72 : 24)) fail(where, `the h1 starts ${m.h1Top}px from the top, want ${detail ? 72 : 24} or less`);
          if (m.browseButtons) fail(where, "a Browse button is still in the page on a phone");
          if (m.dialogs) fail(where, "a Browse drawer (dialog) is still in the page on a phone");
          if (!detail) {
            if (m.chips) fail(where, "a back chip on a page that has no parent");
            continue;
          }
          if (m.chips !== 1 || !m.chip) {
            fail(where, `${m.chips} back chips, want exactly 1`);
            continue;
          }
          const c = m.chip;
          const parent = (j.he ? "/he" : "") + PARENT[j.route];
          const okPath = c.path === parent || (j.route === "/blog/fixture-post" && c.path === (j.he ? "/he" : "") + "/projects/site");
          if (!okPath) fail(where, `the chip goes to ${c.path}, want the parent ${parent}`);
          if (c.label !== c.text) fail(where, `aria-label "${c.label}" is not the visible name "${c.text}"`);
          if (!c.glyphHidden) fail(where, "the chip's arrow is not aria-hidden");
          if (Math.abs(c.ph - 40) > 1) fail(where, `the chip is drawn ${c.ph}px tall, want 40`);
          if (c.h < 44 - 0.5) fail(where, `the chip link is ${c.h}px tall, want a 44px target (R5)`);
          const startGap = m.rtl ? m.vw - c.r : c.l;
          if (startGap > 24 || startGap < 0) fail(where, `the chip is ${Math.round(startGap)}px from the inline-start edge, want 0-24`);
          const flipped = /^matrix\(-1,/.test(c.flip);
          if (m.rtl && !flipped) fail(where, `the arrow is not mirrored in Hebrew (${c.flip})`);
          if (!m.rtl && flipped) fail(where, "the arrow is mirrored in English");
          if (m.h1Top !== null && m.h1Top < c.b) fail(where, "the title is not under the chip");
          if (m.parentLinksAboveTitle !== 1) fail(where, `${m.parentLinksAboveTitle} links to the parent above the title, want only the chip`);
        } finally {
          await ctx.close();
        }
      }
    }),
  );
}

/* Runs in the page: the sheet's first section and where it sits. */
function sheetShape() {
  const sheet = document.getElementById("nav-menu");
  const local = sheet.querySelector("[data-local-browse]");
  const global = sheet.querySelector("nav");
  const head = local?.querySelector("p")?.textContent.trim();
  const sb = sheet.getBoundingClientRect();
  const lb = local?.getBoundingClientRect();
  const focusables = local ? local.querySelectorAll("a[href], button:not([disabled]), input, select, textarea").length : 0;
  return {
    open: !sheet.hidden,
    local: !!local,
    head,
    above: !!local && !!global && lb.top < global.getBoundingClientRect().top,
    visible: !!lb && lb.height > 20 && lb.right > 0 && lb.left < innerWidth,
    inside: !!lb && lb.left >= sb.left - 1 && lb.right <= sb.right + 1,
    focusables,
    areaLink: !!local?.querySelector('a[href*="/blog/area/"]'),
    first: sheet.firstElementChild?.tagName.toLowerCase(),
  };
}

async function localSection() {
  const jobs = [];
  for (const he of [false, true]) for (const route of [...WITH_LOCAL, ...WITHOUT_LOCAL]) jobs.push({ he, route });
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        const where = `390x844 ${j.he ? "he" : "en"} ${j.route} local section`;
        const { ctx, page } = await open({ w: 390, h: 844, he: j.he, route: j.route });
        try {
          await ready(page);
          const btn = page.locator('button[aria-controls="nav-menu"]');
          await btn.click({ force: true });
          await page.waitForTimeout(500);
          let s = await page.evaluate(sheetShape);
          const wants = WITH_LOCAL.includes(j.route);
          if (!s.open) fail(where, "the menu did not open");
          if (wants && !s.local) {
            fail(where, "the menu has no local section");
            continue;
          }
          if (!wants) {
            if (s.local) fail(where, "a page with nothing to browse got a local section");
            if (s.first !== "nav") fail(where, `the menu opens on <${s.first}>, want the global links`);
            continue;
          }
          if (!BROWSE.includes(s.head ?? "")) fail(where, `the local section is headed "${s.head}", want the existing Browse/עיון`);
          if (!s.above) fail(where, "the local section is not above the global links");
          if (!s.visible || !s.inside) fail(where, "the local section is not drawn inside the sheet");
          if (s.focusables < 1) fail(where, "nothing in the local section can be reached");
          if (j.route === "/blog" && !s.areaLink) fail(where, "the blog's areas are not in the local section");
          /* Tab from the circle lands in the local section first (it is first in the order). */
          await page.keyboard.press("Tab");
          const inLocal = await page.evaluate(() => !!document.activeElement?.closest("[data-local-browse]"));
          if (!inLocal) fail(where, "Tab from the circle does not enter the local section");
          /* A link in it closes the menu and moves on. */
          if (j.route === "/blog") {
            await page.locator('#nav-menu [data-local-browse] a[href*="/blog/area/"]').first().click({ force: true });
            await page.waitForTimeout(800);
            s = await page.evaluate(sheetShape);
            if (s.open) fail(where, "following a link in the local section does not close the menu");
            if (!/\/blog\/area\//.test(new URL(page.url()).pathname)) fail(where, "the local link did not navigate");
          } else {
            await page.keyboard.press("Escape");
            await page.waitForTimeout(300);
            const back = await page.evaluate(() => ({
              closed: document.getElementById("nav-menu").hidden,
              focus: document.activeElement === document.querySelector('button[aria-controls="nav-menu"]'),
            }));
            if (!back.closed) fail(where, "Escape does not close the menu from the local section");
            if (!back.focus) fail(where, "focus does not return to the circle after Escape from the local section");
          }
        } finally {
          await ctx.close();
        }
      }
    }),
  );
}

/* The circle tucks on scroll-down, returns on scroll-up and focus. */
async function tuck() {
  for (const [motion, he] of [["reduce", false], ["no-preference", true]]) {
    const where = `390x844 ${he ? "he" : "en"} tuck (motion ${motion})`;
    const { ctx, page } = await open({ w: 390, h: 844, he, route: "/blog", motion });
    try {
      await ready(page);
      const state = () =>
        page.evaluate(() => {
          const b = document.querySelector('button[aria-controls="nav-menu"]');
          const cs = getComputedStyle(b);
          return {
            tucked: document.querySelector('header[class*="_dock_"]').hasAttribute("data-tucked"),
            opacity: Number(cs.opacity),
            press: cs.pointerEvents,
            translate: cs.translate,
            y: Math.round(scrollY),
          };
        });
      /* No frame clock: move, then say so. */
      const go = async (y) => {
        await page.evaluate((to) => {
          scrollTo(0, to);
          dispatchEvent(new Event("scroll"));
        }, y);
        await page.waitForTimeout(150);
        return state();
      };
      let s = await state();
      if (s.tucked || s.opacity !== 1) fail(where, "the circle is tucked at the top of the page");
      s = await go(40);
      if (s.tucked) fail(where, "the circle tucks inside the first 56px");
      s = await go(500);
      if (s.y < 400) {
        fail(where, `the page scrolls only ${s.y}px, too short to test the tuck`);
        continue;
      }
      if (!s.tucked || s.opacity !== 0 || s.press !== "none") fail(where, `scrolling down does not tuck the circle (${JSON.stringify(s)})`);
      if (motion === "reduce" && s.translate !== "none") fail(where, "with reduced motion the circle travels when it tucks");
      if (motion !== "reduce" && (s.translate === "none" || s.translate === "")) fail(where, "with motion allowed the circle does not lift off the edge");
      s = await go(380);
      if (s.tucked || s.opacity !== 1) fail(where, "scrolling up does not bring the circle back");
      s = await go(900);
      if (!s.tucked) fail(where, "the circle does not tuck again on the next scroll down");
      await page.locator('button[aria-controls="nav-menu"]').focus();
      await page.waitForTimeout(150);
      s = await state();
      if (s.tucked || s.opacity !== 1) fail(where, "focusing the circle does not bring it back");
      /* Open: never tucks. */
      await page.keyboard.press("Enter"); /* focused above: a key press, not a mouse click that can be lost */
      await page.waitForTimeout(1200);
      s = await go(1400);
      if (s.tucked || s.opacity !== 1) fail(where, `the circle tucks while the menu is open (${JSON.stringify(s)} ${await page.evaluate(() => document.querySelector(`button[aria-controls="nav-menu"]`).getAttribute("aria-expanded"))})`);
      await page.keyboard.press("Escape");
    } finally {
      await ctx.close();
    }
  }
}

/* Tablet keeps its Browse button; desktop has no chip. */
async function tabletAndDesktop() {
  const { ctx, page } = await open({ w: 768, h: 1024, he: false, route: "/projects/bothy" });
  try {
    await ready(page);
    const m = await page.evaluate(() => ({
      button: [...document.querySelectorAll("main button")].some((b) => b.getAttribute("aria-haspopup") === "dialog" && /^Browse/.test(b.textContent.trim())),
      chip: document.querySelectorAll("a[data-back-chip]").length,
      local: document.querySelectorAll("[data-local-browse]").length,
      crumb: [...document.querySelectorAll("main a")].some((a) => a.pathname === "/projects" && getComputedStyle(a).display !== "none"),
    }));
    if (!m.button) fail("768 project", "the tablet lost its Browse button");
    if (m.chip || m.local) fail("768 project", "phone-only parts (chip, local section) are mounted on a tablet");
    if (!m.crumb) fail("768 project", "the tablet lost the Work crumb");
  } finally {
    await ctx.close();
  }
  const d = await open({ w: 1280, h: 800, he: false, route: "/projects/bothy" });
  try {
    await ready(d.page);
    const m = await d.page.evaluate(() => ({ chip: document.querySelectorAll("a[data-back-chip]").length, local: document.querySelectorAll("[data-local-browse]").length }));
    if (m.chip || m.local) fail("1280 project", "phone-only parts are mounted on a desktop");
  } finally {
    await d.ctx.close();
  }
}

const t0 = Date.now();
try {
  await phones();
  await behaviour();
  await safeAreas();
  await wide();
  await titles();
  await localSection();
  await tuck();
  await tabletAndDesktop();
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
