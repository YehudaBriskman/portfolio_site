#!/usr/bin/env node
/*
 * Touch targets on the PUBLIC site, on a phone (plan PR 3).
 *
 *   npm run build && npm run a11y:public-targets      (about 15 s)
 *   WIDTHS=390 LANGS=en SHOTS=docs/design/public-targets/after npm run a11y:public-targets
 *
 * Emulates a phone (hasTouch + isMobile, so `(pointer: coarse)` is true) at
 * 360 and 390, English and Hebrew, on home, blog list, a post, projects, a
 * project, contact and help, against the same stubbed API the axe run uses.
 *
 * Two rules:
 *  - FLOOR (WCAG 2.5.8, 24): every visible link, button, field and checkbox
 *    is at least 24x24, except a link that sits inside a run of text.
 *  - HOUSE (44): the named controls (filter chips, row titles, "Notes" links,
 *    the sign-up field and consent labels, footer links) have a 44px block
 *    size; the footer links 44px inline as well. A target counts at its
 *    painted box OR at the area that answers a touch (an invisible ::after
 *    is allowed where the visual size must stay), measured by hit-testing
 *    outwards from its centre, so a stretched pseudo-element is seen.
 *
 * Not covered, on purpose: the top nav/dock and the Hero (another PR owns
 * them) and the blog search box (FilterControl). Fixed waits and polling by
 * hand, never rAF: headless Chromium here emits about one frame per 40 s.
 * Exit 1 on any miss. CHROME overrides the browser binary.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { answer, startPreview } from "./site-stub.mjs";

const WIDTHS = (process.env.WIDTHS ?? "360,390").split(",").map(Number);
const LANGS = (process.env.LANGS ?? "en,he").split(",");
const SHOTS = process.env.SHOTS ?? "";
const ROUTES = ["/", "/blog", "/blog/fixture-post", "/projects", "/projects/bothy", "/contact", "/help"];

/* The named controls and the size each owes (block, inline). Class names are
   CSS-module hashes with the source name kept in the middle, so match on that. */
const HOUSE = [
  { name: "filter chip", sel: '[class*="_chip_"]', block: 44 },
  { name: "row title", sel: '[class*="_rowTitle_"]', block: 44 },
  { name: "Notes link", sel: '[class*="_notes_"]', block: 44 },
  { name: "sign-up field", sel: 'form input:not([type=checkbox]):not([type=hidden]):not([tabindex="-1"])', block: 44 },
  { name: "consent label", sel: 'label:has(> input[type=checkbox])', block: 44 },
  { name: "footer link", sel: "footer a", block: 44, inline: 44 },
];

const base = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });

const probe = () => {
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && !e.closest("[aria-hidden=true],[hidden]") && !e.closest("[class*=_trap_]");
  };
  const srOnly = (e) => {
    const r = e.getBoundingClientRect();
    return r.width <= 1 || r.height <= 1 || r.right < 0 || r.left < -5000;
  };
  const inRun = (e) => {
    if (e.tagName !== "A" || getComputedStyle(e).display !== "inline") return false;
    const p = e.closest("p,li,dd,dt,td,blockquote,div") ?? e.parentElement;
    return (p.textContent ?? "").replace(e.textContent ?? "", "").trim().length > 12;
  };
  /* How far a touch still lands on `e`, outwards from its centre, along one axis. */
  const reach = (e, axis) => {
    const r = e.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cy < 0 || cy > innerHeight || cx < 0 || cx > innerWidth) return null;
    const hits = (x, y) => {
      const t = document.elementFromPoint(x, y);
      return !!t && (t === e || e.contains(t) || t.closest("a,button,label") === e);
    };
    let lo = 0, hi = 0;
    for (let d = 1; d < 80; d++) if (hits(axis === "y" ? cx : cx - d, axis === "y" ? cy - d : cy)) lo = d; else break;
    for (let d = 1; d < 80; d++) if (hits(axis === "y" ? cx : cx + d, axis === "y" ? cy + d : cy)) hi = d; else break;
    return lo + hi + 1;
  };
  const out = { floor: [], house: [] };
  const all = [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab]")];
  for (const e of all) {
    if (!visible(e) || srOnly(e) || inRun(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) out.floor.push({ el: label(e), w: Math.round(r.width), h: Math.round(r.height) });
  }
  function label(e) {
    return `${e.tagName.toLowerCase()}${e.type ? "[" + e.type + "]" : ""} "${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 28)}"`;
  }
  for (const h of window.__HOUSE) {
    for (const e of document.querySelectorAll(h.sel)) {
      if (!visible(e) || srOnly(e)) continue;
      e.scrollIntoView({ block: "center", behavior: "instant" });
      const r = e.getBoundingClientRect();
      const by = Math.max(r.height, reach(e, "y") ?? 0);
      const bx = Math.max(r.width, reach(e, "x") ?? 0);
      if (by < h.block || (h.inline && bx < h.inline)) out.house.push({ rule: h.name, el: label(e), box: `${Math.round(r.width)}x${Math.round(r.height)}`, hit: `${Math.round(bx)}x${Math.round(by)}` });
    }
  }
  return out;
};

let bad = 0;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
for (const width of WIDTHS) {
  for (const lang of LANGS) {
    const ctx = await browser.newContext({ viewport: { width, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
    await ctx.addInitScript((h) => (window.__HOUSE = h), HOUSE);
    await ctx.route("**/api/**", (r) => {
      const { status, body } = answer(r.request().url(), false);
      r.fulfill({ status, contentType: "application/json", body: typeof body === "string" ? body : JSON.stringify(body) });
    });
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const at = lang === "he" ? (route === "/" ? "/he" : `/he${route}`) : route;
      await page.goto(base.base + at, { waitUntil: "load" });
      /* Settle by hand: wait for the footer to exist, not for a frame. */
      await page.locator("footer").first().waitFor({ state: "attached" });
      await page.waitForTimeout(900);
      const r = await page.evaluate(probe);
      const tag = `${lang} ${width} ${route}`;
      for (const x of r.floor) { bad++; console.log(`FLOOR  ${tag}  ${x.el} is ${x.w}x${x.h}, under 24`); }
      for (const x of r.house) { bad++; console.log(`HOUSE  ${tag}  ${x.rule}: ${x.el} box ${x.box}, touch area ${x.hit}`); }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${lang}-${width}-${route === "/" ? "home" : route.slice(1).replace(/\//g, "-")}.png`, fullPage: true, timeout: 120000 });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
base.stop();
console.log(bad ? `\n${bad} touch-target miss(es).` : "Public touch targets: clean.");
process.exit(bad ? 1 : 0);
