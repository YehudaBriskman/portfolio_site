#!/usr/bin/env node
/*
 * The media library on a phone (#681), measured in a real browser against a
 * build, because jsdom cannot see layout:
 *
 *   npm run build
 *   npm run a11y:admin-media-phone
 *   SHOTS=/tmp/media-shots npm run a11y:admin-media-phone     (also saves screenshots)
 *   BEFORE=1 ...   measure and shoot only, assert nothing (to record a "before" build)
 *
 * At 360, 390 and 430 wide, English (LTR) and Hebrew (RTL), light and dark:
 *  - 14 tiles, two or three columns, each tile one button and roughly square;
 *  - nothing scrolls sideways;
 *  - at least 6 tiles sit above the fold of a 390x844 screen (was 0);
 *  - a tap opens the sheet, the alt text comes before "where it is used" and
 *    before the closed details, Escape closes it and focus is back on the tile;
 *  - at 1440 the desktop page is unchanged (radios, the explainer, tile text).
 *
 * Reuses site-stub.mjs (`vite preview` plus API fixtures): no login, no
 * network. Polls on a timer, never rAF: headless Chromium here emits about one
 * frame per 40 s. CHROME overrides the browser binary.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { answer: baseAnswer, startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const SHOTS = process.env.SHOTS || "";
const BEFORE = Boolean(process.env.BEFORE);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const SWATCH = (c) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="${c}"/><circle cx="2" cy="1.5" r="0.8" fill="#ffffff55"/></svg>`)}`;
const COLORS = ["#3a6f8f", "#8f5a3a", "#4a7a52", "#7a4a7a", "#8f8a3a", "#3a8f84", "#8f3a52", "#52568f"];
const make = (i, alt, usedBy, extra = {}) => ({
  id: `item-${i}`, _rev: "1-a", name: `item-${i}.jpg`, alt, caption: "", credit: "", kind: "image", format: "jpeg", mime: "image/jpeg", file: null,
  width: 1600, height: 1200, bytes: 184_000, createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-01T10:00:00.000Z",
  url: `https://yehudabriskman.com/api/images/media/item-${i}`, preview: `/api/images/m/item-${i}/w400-${"a".repeat(15)}${i % 10}.webp`, srcset: { avif: "", webp: "" },
  largest: { avif: null, webp: `/api/images/m/item-${i}/w1600-${"b".repeat(15)}${i % 10}.webp` }, usedBy, ...extra,
});
const USE = (title, slug) => [{ id: `collection:${slug}`, type: "collection", title, slug, field: "coverImage" }];
const MEDIA = [
  make(1, "A cabin under the aurora, with a clock and a greeting over it.", USE("The site", "site"), { he: { alt: "בקתה תחת זוהר הצפון.", caption: "" } }),
  make(2, "An orange sports car on a coastal highway.", []),
  make(3, "A leaf.", [], { kind: "icon", format: "svg", mime: "image/svg+xml", file: "/api/images/m/item-3/icon-aaaaaaaaaaaaaaaa.svg", monochrome: true, width: 24, height: 24, bytes: 412 }),
  make(4, "A walk through the dashboard, from the list to one item.", [], { kind: "video", format: "mp4", mime: "video/mp4", file: "/api/images/m/item-4/video-aaaaaaaaaaaaaaaa.mp4", durationMs: 12_000, hasAudio: false, captions: null }),
  make(5, "A harbour at dusk.", USE("WindoM", "windom")),
  make(6, "", []),
  make(7, "A desk with two monitors and a lamp.", USE("Notes", "notes")),
  make(8, "A long road through a wide valley.", []),
  make(9, "", USE("Projects", "projects")),
  make(10, "A hand holding a small brass key.", []),
  make(11, "A grey cat asleep on a stack of books.", USE("The site", "site")),
  make(12, "A close view of a circuit board.", []),
  make(13, "A bicycle leaning on a blue wall.", []),
  make(14, "A cup of tea beside a window.", USE("Story", "story")),
];
/* The image server is not here: every /api/images/ request is answered with a flat colour. */
const colourOf = (path) => COLORS[Number(/item-(\d+)/.exec(path)?.[1] ?? 0) % COLORS.length];

const fails = [];
const fail = (m) => fails.push(m);

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });

async function open(w, h, lang, theme = "light", path = "/admin/media") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, theme);
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/admin/media" && route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, items: MEDIA }) });
    }
    if (u.pathname.startsWith("/api/images/")) {
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: decodeURIComponent(SWATCH(colourOf(u.pathname)).split(",")[1]) });
    }
    const b = baseAnswer(`http://x${u.pathname}${u.search}`, route.request().method() !== "GET");
    return route.fulfill({ status: b.status ?? 200, contentType: "application/json", body: JSON.stringify(b.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.goto(`${base}${lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => document.querySelectorAll("main ul[aria-label] > li > div > button").length > 3)) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(500);
  return { page, close: () => ctx.close() };
}

/* page.screenshot waits for a frame this headless build rarely produces; the protocol's own capture does not. */
async function shot(page, name) {
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(data, "base64"));
  await cdp.detach();
}
const waitFor = async (page, fn, arg, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(250);
  }
  return false;
};

function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tiles = [...document.querySelectorAll("main ul[aria-label] > li > div > button")];
  const rects = tiles.map((t) => t.getBoundingClientRect());
  const cols = new Set(rects.map((r) => Math.round(r.left))).size;
  return {
    vw,
    scroll: document.documentElement.scrollWidth,
    tiles: tiles.length,
    cols,
    inFold: rects.filter((r) => r.bottom <= vh + 0.5 && r.top >= 0).length,
    firstTop: Math.round(rects[0]?.top ?? -1),
    pageH: document.documentElement.scrollHeight,
    squareWorst: Math.max(0, ...rects.map((r) => Math.abs(r.width - r.height))),
    inner: tiles.slice(0, 20).map((t) => t.closest("li").querySelectorAll("button, a, input, select, textarea").length),
    text: (document.querySelector("main")?.innerText ?? "").length,
  };
}

try {
  const matrix = [];
  for (const lang of ["en", "he"]) {
    for (const theme of ["light", "dark"]) {
      for (const w of [360, 390, 430]) {
        if (theme === "dark" && w === 360 && !SHOTS) continue;
        const h = w === 390 ? 844 : 800;
        const tag = `media ${w} ${lang} ${theme}`;
        const dir = lang === "he" ? "rtl" : "ltr";
        const { page, close } = await open(w, h, lang, theme);
        const m = await page.evaluate(measure);
        matrix.push({ tag, ...m });
        if (!BEFORE) {
          if (m.scroll > m.vw + 1) fail(`${tag}: page scrolls sideways (${m.scroll} > ${m.vw})`);
          if (m.tiles !== MEDIA.length) fail(`${tag}: ${m.tiles} tiles, expected ${MEDIA.length}`);
          if (m.cols < 2 || m.cols > 3) fail(`${tag}: ${m.cols} columns, expected 2 or 3`);
          if (m.squareWorst > 2) fail(`${tag}: a tile is ${m.squareWorst}px off square`);
          if (m.inner.some((n) => n !== 1)) fail(`${tag}: a tile holds ${m.inner.join("/")} controls, expected exactly 1`);
          if (w === 390 && m.inFold < 6) fail(`${tag}: ${m.inFold} tiles above the fold of 844px (first starts at ${m.firstTop}px), needs at least 6`);
        }
        if (SHOTS) await shot(page, `${w}-${dir}-${theme}-grid`);

        if (m.tiles > 0 && (SHOTS || (theme === "light" && w !== 430))) {
          await page.evaluate(() => document.querySelector("main ul[aria-label] > li > div > button")?.focus());
          await page.locator("main ul[aria-label] > li > div > button").first().dispatchEvent("click");
          const opened = await waitFor(page, () => !!document.querySelector("dialog[open]"));
          if (!opened) { if (!BEFORE) fail(`${tag}: tapping a tile did not open the sheet`); }
          else {
            await waitFor(page, () => !!document.querySelector("dialog[open] textarea"));
            if (!BEFORE) {
              const order = await page.evaluate(() => {
                const d = document.querySelector("dialog[open]");
                const alt = d.querySelector("textarea");
                const used = [...d.querySelectorAll("h3")].find((h) => /used|בשימוש|משמש/i.test(h.textContent ?? ""));
                const det = [...d.querySelectorAll("details")].pop();
                const after = (a, b) => !!(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
                return { altBeforeUsed: after(alt, used), usedBeforeDetails: after(used, det), detailsClosed: det ? !det.open : null, scroll: document.documentElement.scrollWidth - window.innerWidth };
              });
              if (!order.altBeforeUsed) fail(`${tag}: the alt text is not above "where it is used"`);
              if (!order.usedBeforeDetails) fail(`${tag}: "where it is used" is not above the details`);
              if (order.detailsClosed !== true) fail(`${tag}: the details are not closed`);
              if (order.scroll > 1) fail(`${tag}: the open sheet makes the page scroll sideways`);
            }
            if (SHOTS) await shot(page, `${w}-${dir}-${theme}-sheet`);
            await page.keyboard.press("Escape");
            if (!(await waitFor(page, () => !document.querySelector("dialog[open]")))) { if (!BEFORE) fail(`${tag}: Escape did not close the sheet`); }
            else if (!BEFORE && !(await waitFor(page, () => document.activeElement === document.querySelector("main ul[aria-label] > li > div > button"), undefined, 12))) fail(`${tag}: focus did not return to the tile`);
          }
        }
        await close();
      }
    }
  }

  const small = await open(320, 568, "en");
  const sm = await small.page.evaluate(measure);
  if (!BEFORE && sm.scroll > sm.vw + 1) fail(`media 320: page scrolls sideways (${sm.scroll} > ${sm.vw})`);
  await small.close();

  const wide = await open(1440, 900, "en");
  const wm = await wide.page.evaluate(() => ({
    radios: document.querySelectorAll('main input[type="radio"]').length,
    explainer: /Anything in use cannot be deleted/.test(document.querySelector("main")?.innerText ?? ""),
    phone: !!document.querySelector("[data-media-grid]"),
  }));
  if (!BEFORE) {
    if (wm.radios < 3) fail("media 1440: the kind radios are gone");
    if (!wm.explainer) fail("media 1440: the explainer is gone");
    if (wm.phone) fail("media 1440: the phone grid is drawn on a desktop screen");
  }
  if (SHOTS) await shot(wide.page, "1440-ltr-light-grid");
  await wide.close();
  if (SHOTS) {
    for (const [lang, theme] of [["en", "dark"], ["he", "light"], ["he", "dark"]]) {
      const d = await open(1440, 900, lang, theme);
      await shot(d.page, `1440-${lang === "he" ? "rtl" : "ltr"}-${theme}-grid`);
      await d.close();
    }
  }

  console.log(JSON.stringify(matrix.filter((r) => r.tag.endsWith("light") || SHOTS).map(({ tag, tiles, cols, inFold, firstTop, pageH, scroll, vw }) => ({ tag, tiles, cols, inFold, firstTop, pageH, overflowX: scroll - vw })), null, 0).replace(/\},\{/g, "},\n{"));
} finally {
  await browser.close();
  stop();
}

if (fails.length) {
  console.error(`\n${fails.length} problem(s):\n- ${fails.join("\n- ")}`);
  process.exit(1);
}
console.log(BEFORE ? "\nmeasured (nothing asserted)." : "\nmedia on a phone: ok.");
