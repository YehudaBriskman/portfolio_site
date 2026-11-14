#!/usr/bin/env node
/*
 * Route-change focus on the public site (#776), in real Chromium against the
 * built site (`npm run build` first):
 *
 *   npm run a11y:public-focus        about 20 s
 *
 * The rule: focus MAY move to the page heading on navigation (screen readers
 * and keyboard users land on it), but a navigation that was not caused by the
 * keyboard must not paint a focus ring, and one that was must paint a strong
 * one. Two runs:
 *
 *   touch      390x844, hasTouch + isMobile, he and en: after a tap on a link
 *              the heading holds focus and has NO visible outline.
 *   keyboard   1280x800: after Tab + Enter on a link the heading holds focus
 *              and its outline is at least 2px, then one Tab lands on a real
 *              control that also shows a ring.
 *
 * Where a route has no link on the page the run started from, a real tap (or
 * key press) on the body sets the modality and the router is driven with
 * history.pushState + popstate, which is the same event the links produce.
 *
 * Fixed waits and hand polling, never rAF: headless Chromium here emits about
 * one frame per 40 s. CHROME overrides the browser binary.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./site-stub.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");

/* [start page, destination]. A link to the destination is looked for on start. */
const ROUTES = [
  ["/", "/projects"],
  ["/projects", "/projects/windom"],
  ["/", "/blog"],
  ["/blog", "/blog/fixture-post"],
  ["/blog", "/blog/area/bothy"],
  ["/", "/story"],
  ["/", "/help"],
  ["/", "/follow"],
  ["/", "/accessibility"],
  ["/", "/subscribe/confirm"],
  ["/", "/unsubscribe"],
  ["/", "/subscribe/manage"],
  ["/", "/no-such-page"],
];

const T0 = Date.now();
const lapAll = (m) => process.env.TIMING && console.log("##", m, Date.now() - T0);
const { base, stop } = await startPreview();
lapAll("preview");
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

async function open(opts) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, reducedMotion: "reduce", ...opts });
  await ctx.route(/\/api\//, async (route) => {
    const a = answer(route.request().url());
    await route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: typeof a.body === "string" ? a.body : JSON.stringify(a.body ?? a) });
  });
  /* RouteAnnouncer waits for the new heading with requestAnimationFrame, and
     this box's headless Chromium presents about one frame per 40 s, so a
     navigation would take minutes to land. Timers stand in for frames. */
  await ctx.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });
  return { ctx, page: await ctx.newPage() };
}

/* Runs in the page: what the focused element looks like. */
function probe() {
  const el = document.activeElement;
  if (!el || el === document.body) return { body: true };
  const cs = getComputedStyle(el);
  const w = parseFloat(cs.outlineWidth) || 0;
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id,
    inMain: !!el.closest("main") || el.tagName === "MAIN",
    outline: cs.outlineStyle !== "none" && w > 0 ? w : 0,
    focusVisible: el.matches(":focus-visible"),
    modality: document.documentElement.getAttribute("data-input"),
  };
}

async function settle(page, ms = 5000) {
  /* Poll by hand: the heading arrives behind a lazy chunk. */
  const end = Date.now() + ms;
  let p;
  while (Date.now() < end) {
    await page.waitForTimeout(100);
    p = await page.evaluate(probe);
    if (!p.body && (p.tag === "h1" || p.tag === "main")) break;
  }
  return p;
}

async function go(page, from, to, how) {
  const T = Date.now();
  const lap = (m) => process.env.TIMING && console.log(m, from, to, Date.now() - T);
  await page.goto(base + from, { waitUntil: "load" });
  lap("loaded");
  /* Hand polling for the start page's heading: the page is lazy. */
  for (let i = 0; i < 50 && !(await page.evaluate(() => !!document.querySelector("main h1, h1"))); i++) await page.waitForTimeout(100);
  await page.waitForTimeout(200);
  /* Sets the modality the way a person would, before navigating. */
  if (how === "keyboard") await page.keyboard.press("Tab");
  /* No Playwright actionability checks: they wait on rAF (see header). */
  const box = await page.evaluate((href) => {
    const el = [...document.querySelectorAll(`a[href="${href}"]`)].find((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden");
    if (!el) return null;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    el.setAttribute("data-focus-probe", "");
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, to);
  lap("probed");
  if (box) {
    if (how === "keyboard") {
      await page.evaluate(() => document.querySelector("[data-focus-probe]").focus());
      await page.keyboard.press("Enter");
    } else {
      /* The touch sequence, dispatched in the page: a real Playwright tap waits
         for a presented frame, which on this box's headless Chromium is a
         minute or more for the first one. The link is not focused by it, so the
         heading is focused with nothing focused before, the case that painted
         the ring. */
      await page.evaluate(() => {
        const el = document.querySelector("[data-focus-probe]");
        for (const [type, C] of [["pointerdown", PointerEvent], ["touchstart", Event], ["mousedown", MouseEvent], ["pointerup", PointerEvent], ["mouseup", MouseEvent]])
          el.dispatchEvent(new C(type, { bubbles: true, cancelable: true }));
        el.click();
      });
    }
    return "link";
  }
  if (how === "touch") await page.evaluate(() => document.dispatchEvent(new Event("touchstart", { bubbles: true })));
  await page.evaluate((path) => {
    history.pushState({}, "", path);
    dispatchEvent(new PopStateEvent("popstate"));
  }, to);
  return "router";
}

/* ---------------------------------------------------------------- touch */
for (const he of [false, true]) {
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: he ? "he-IL" : "en-US" });
  for (const [from, to] of he ? ROUTES.filter((_, i) => [1, 3, 5, 7, 9, 12].includes(i)) : ROUTES) {
    const a = he ? "/he" + (from === "/" ? "" : from) : from;
    const b = he ? "/he" + to : to;
    const how = await go(page, a, b, "touch");
    const p = await settle(page);
    lapAll("settled " + b);
    const where = `touch ${he ? "he" : "en"} ${a} -> ${b} (${how})`;
    if (p.body) fail(where, "focus lost to <body>");
    else {
      if (!p.inMain) fail(where, `focus landed outside main (${p.tag}#${p.id})`);
      if (p.outline > 0) fail(where, `a ring is painted on ${p.tag}#${p.id} after a tap (outline ${p.outline}px)`);
    }
  }

}

/* ------------------------------------------------------------- keyboard */
{
  const { ctx, page } = await open({ viewport: { width: 1280, height: 800 } });
  for (const [from, to] of ROUTES.slice(0, 8)) {
    const how = await go(page, from, to, "keyboard");
    const p = await settle(page);
    const where = `keyboard ${from} -> ${to} (${how})`;
    if (p.body) {
      fail(where, "focus lost to <body>");
      continue;
    }
    if (p.modality !== "keyboard") fail(where, `modality is ${p.modality}`);
    if (p.outline < 2) fail(where, `keyboard focus on ${p.tag}#${p.id} has a ${p.outline}px ring, need 2px or more`);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(100);
    const n = await page.evaluate(probe);
    if (n.body) fail(where, "Tab from the heading dropped focus to <body>");
    else if (n.outline < 2 && !["input", "textarea", "select"].includes(n.tag)) fail(where, `Tab target ${n.tag}#${n.id} has a ${n.outline}px ring`);
  }
  /* Forced colors keep outlines: nothing in the rule may switch them off. */

}
{
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, forcedColors: "active" });
  await go(page, "/", "/projects", "touch");
  const p = await settle(page);
  if (!p.body && p.outline === 0 && p.focusVisible) fail("forced-colors", "outline removed while :focus-visible matches");

}




/* Exit without closing contexts: closing waits on frames and costs ~10 s. */
stop();
if (failures.length) {
  console.error(`public-focus: ${failures.length} failure(s)\n` + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
console.log("public-focus: ok");
process.exit(0);
