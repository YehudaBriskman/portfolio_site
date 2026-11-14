#!/usr/bin/env node
/*
 * Direction A ("grouped") on the PUBLIC Projects pages, on a phone.
 *
 *   npm run build && npm run a11y:public-projects        (under 25 s)
 *
 * 360 / 390 / 430, English and Hebrew, light and dark, on /projects, the
 * Bothy project page (stats present) and WindoM (no repository stats).
 * Facts only, never timing:
 *   - no sideways overflow;
 *   - every [data-phone-circle] is a true circle of 32, 40 or 56 px;
 *   - list rows are 44+ tall and the whole row answers a touch on its link;
 *   - the sort and the project tabs are pill segments 44 tall with tablist
 *     semantics, one tab stop, arrow keys that follow the reading direction,
 *     and the URL (`?tab=`) in step;
 *   - the header card, stat tiles (one per datum the repository has, none
 *     when it has none), the collapsed Stack and the pinned action exist;
 *   - the pinned action sits above the safe area and covers nothing at the
 *     end of the page;
 *   - at 1280 none of it is there: no phone-only box has a size.
 * Waits are fixed and polling is by hand: this headless Chromium emits about
 * one frame per 40 s, so nothing here depends on rAF or animationend.
 * SHOTS=dir also writes full-page screenshots. CHROME overrides the binary.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startPreview } from "./site-stub.mjs";
import { handler } from "./projects-fixture.mjs";

const WIDTHS = (process.env.WIDTHS ?? "360,390,430").split(",").map(Number);
const LANGS = (process.env.LANGS ?? "en,he").split(",");
const THEMES = (process.env.THEMES ?? "light,dark").split(",");
const SHOTS = process.env.SHOTS ?? "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const base = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const fails = [];
const fail = (tag, msg) => fails.push(`${tag}  ${msg}`);

const settle = async (page) => {
  await page.locator("footer").first().waitFor({ state: "attached" });
  for (let i = 0; i < 20; i++) {
    if ((await page.locator('[aria-busy="true"]').count()) === 0) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(300);
};

const open = async (ctx, lang, route) => {
  const page = await ctx.newPage();
  await page.goto(base.base + (lang === "he" ? `/he${route}` : route), { waitUntil: "load" });
  await settle(page);
  return page;
};

const common = () => {
  const out = { overflow: innerWidth < document.documentElement.scrollWidth - 1, circles: [], rows: [] };
  for (const e of document.querySelectorAll("[data-phone-circle]")) {
    const r = e.getBoundingClientRect();
    if (r.width === 0) continue;
    const cs = getComputedStyle(e);
    out.circles.push({ w: Math.round(r.width), h: Math.round(r.height), round: cs.borderRadius === "50%" || parseFloat(cs.borderRadius) >= r.width / 2 });
  }
  return out;
};

const projectsProbe = () => {
  const out = window.__common();
  out.sorts = [...document.querySelectorAll("[data-phone-segmented] a, [data-phone-segmented] button")].map((e) => Math.round(e.getBoundingClientRect().height));
  out.rowsFound = 0;
  for (const row of document.querySelectorAll("[data-phone-row]")) {
    const r = row.getBoundingClientRect();
    if (r.width === 0) continue;
    out.rowsFound++;
    const link = row.querySelector("a");
    const hit = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1));
    const above = r.top < 0 || r.bottom > innerHeight;
    if (r.height < 64) out.rows.push(`row ${Math.round(r.height)} tall`);
    if (!above && !(hit && hit.closest("a") && row.contains(hit))) out.rows.push("row centre is not a link");
    if (!link) out.rows.push("row has no link");
  }
  return out;
};

const projectProbe = () => {
  const out = window.__common();
  const q = (s) => [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().width > 0);
  const tabs = q('[role="tablist"] [role="tab"]');
  out.tabs = tabs.map((t) => ({ h: Math.round(t.getBoundingClientRect().height), sel: t.getAttribute("aria-selected"), tab: t.tabIndex }));
  out.segmented = q('[role="tablist"][data-phone-segmented]').length;
  out.header = q('[data-phone-card="header"]').length;
  out.tiles = q('[data-phone="stat-tile"]').map((t) => t.textContent.replace(/\s+/g, " ").trim());
  out.tileH = q('[data-phone="stat-tile"]').map((t) => Math.round(t.getBoundingClientRect().height));
  out.details = q('[data-phone-card="header"] details').map((d) => d.open);
  out.cover = q('[data-phone="head-cover"]').map((c) => ({ fallback: c.hasAttribute("data-fallback"), h: Math.round(c.getBoundingClientRect().height), img: !!c.querySelector("img") }));
  out.crumb = q('[data-phone-card="header"] a[href$="/projects"]').length;
  out.pinRadius = (() => { const d = q("[data-phone-pinned]")[0]; return d ? { bg: getComputedStyle(d).backgroundColor, shadow: getComputedStyle(d).boxShadow !== "none" } : null; })();
  const pin = q('[data-phone="pinned-action"]')[0];
  out.pin = pin ? { text: pin.textContent.trim(), fixed: getComputedStyle(pin.closest("[data-phone-pinned]") ?? pin).position === "fixed", bottom: Math.round(innerHeight - pin.getBoundingClientRect().bottom), h: Math.round(pin.getBoundingClientRect().height) } : null;
  out.rowsDeep = q("[data-phone-row]").map((e) => Math.round(e.getBoundingClientRect().height));
  return out;
};

const endOfPage = () => {
  scrollTo(0, document.documentElement.scrollHeight);
  const pin = [...document.querySelectorAll('[data-phone="pinned-action"]')].find((e) => e.getBoundingClientRect().width > 0);
  if (!pin) return { covered: null };
  const box = (pin.closest("[data-phone-pinned]") ?? pin).getBoundingClientRect();
  const last = [...document.querySelectorAll("footer a, footer p, footer li")].filter((e) => e.getBoundingClientRect().width > 0).pop();
  return { covered: last ? last.getBoundingClientRect().bottom > box.top + 1 : false, pinTop: Math.round(box.top), lastBottom: last ? Math.round(last.getBoundingClientRect().bottom) : null, sy: Math.round(scrollY), h: document.documentElement.scrollHeight, flag: document.documentElement.hasAttribute("data-has-pinned"), pad: getComputedStyle(document.querySelector("footer")).paddingBottom, last: last ? last.tagName + last.textContent.slice(0, 12) : null };
};

const desktopProbe = () => {
  const bad = [];
  for (const e of document.querySelectorAll("[data-phone], [data-phone-pinned], [data-phone-chevron], [data-phone-row] [data-phone-circle]")) {
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(e).display !== "contents") bad.push(e.getAttribute("data-phone") ?? e.tagName);
  }
  return { bad, overflow: innerWidth < document.documentElement.scrollWidth - 1 };
};

/* 360 and 430 in light, 390 in light and dark, both languages; the extra pages
   (releases, a project with no stats) at 390 light only. One context each, all
   at once, so the run stays under 25 s. */
const combos = [];
for (const width of WIDTHS) for (const lang of LANGS) for (const theme of THEMES) {
  if (theme === "dark" && width !== 390) continue;
  combos.push({ width, lang, theme });
}
await Promise.all(combos.map(async ({ width, lang, theme }) => {
      const full = width === 390 && theme === "light";
      const ctx = await browser.newContext({ viewport: { width, height: 780 }, hasTouch: true, isMobile: true, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
      await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch { /* blocked */ } }, theme);
      await ctx.addInitScript(`window.__common = ${common.toString()}`);
      await ctx.route("**/api/**", handler());
      const T = (p) => `${lang} ${theme} ${width} ${p}`;

      /* /projects */
      let page = await open(ctx, lang, "/projects");
      let r = await page.evaluate(projectsProbe);
      if (r.overflow) fail(T("/projects"), "horizontal overflow");
      if (r.rowsFound < 3) fail(T("/projects"), `only ${r.rowsFound} phone rows`);
      for (const x of r.rows) fail(T("/projects"), x);
      if (!r.circles.length) fail(T("/projects"), "no icon circles");
      for (const c of r.circles) if (![32, 40, 56].includes(c.w) || c.w !== c.h || !c.round) fail(T("/projects"), `circle ${c.w}x${c.h} round=${c.round}`);
      if (r.sorts.length !== 3 || r.sorts.some((h) => h < 44)) fail(T("/projects"), `sort segments ${JSON.stringify(r.sorts)} (need 3 at 44+)`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/projects.${lang}.${theme}.${width}.png`, fullPage: true, timeout: 120000 });
      await page.close();

      /* a project with stats */
      page = await open(ctx, lang, "/projects/bothy");
      r = await page.evaluate(projectProbe);
      let tag = T("/projects/bothy");
      if (r.overflow) fail(tag, "horizontal overflow");
      if (!r.header) fail(tag, "no header card");
      if (!r.circles.some((c) => c.w === 56)) fail(tag, "no 56px header circle");
      for (const c of r.circles) if (![32, 40, 56].includes(c.w) || c.w !== c.h || !c.round) fail(tag, `circle ${c.w}x${c.h} round=${c.round}`);
      /* stub stats: 12 stars, 3 forks, TypeScript, v1.9.0 */
      for (const want of ["12", "3", "TypeScript", "v1.9.0"]) if (!r.tiles.some((t) => t.includes(want))) fail(tag, `no stat tile with ${want} (have ${JSON.stringify(r.tiles)})`);
      if (r.tiles.length !== 4) fail(tag, `${r.tiles.length} stat tiles, want 4`);
      if (!r.segmented) fail(tag, "tabs are not the segmented pill");
      if (r.tabs.length < 2 || r.tabs.some((t) => t.h < 44)) fail(tag, `tabs ${JSON.stringify(r.tabs)} (44 tall)`);
      if (r.tabs.filter((t) => t.tab === 0).length !== 1) fail(tag, "tablist needs exactly one tab stop");
      if (r.details.length !== 1 || r.details[0] !== false) fail(tag, `Details ${JSON.stringify(r.details)}, want one, closed`);
      if (r.cover.length !== 1 || r.cover[0].h < 100) fail(tag, `header cover ${JSON.stringify(r.cover)}`);
      if (r.crumb) fail(tag, "the Work crumb is still in the header card");
      if (!r.pinRadius || !r.pinRadius.shadow || /rgba\(0, 0, 0, 0\)|transparent/.test(r.pinRadius.bg)) fail(tag, `the pinned pill is not an opaque raised surface ${JSON.stringify(r.pinRadius)}`);
      if (!r.pin) fail(tag, "no pinned action");
      else {
        if (!r.pin.fixed) fail(tag, "pinned action is not fixed");
        if (r.pin.bottom < 8) fail(tag, `pinned action ${r.pin.bottom}px from the bottom`);
        if (r.pin.h < 44) fail(tag, `pinned action ${r.pin.h} tall`);
        if (!/Source|Open|Chrome|קוד|מאגר|Store|חנות/i.test(r.pin.text)) fail(tag, `pinned action says "${r.pin.text}"`);
      }
      const end = await page.evaluate(endOfPage);
      if (end.covered) fail(tag, `the pinned action covers the end of the page ${JSON.stringify(end)}`);
      await page.evaluate(() => scrollTo(0, 0));
      /* tab semantics: arrow follows the reading direction, URL in step */
      const first = page.locator('[role="tab"][aria-selected="true"]').first();
      await first.focus();
      await page.keyboard.press(lang === "he" ? "ArrowLeft" : "ArrowRight");
      await page.waitForTimeout(400);
      const sel = await page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? "");
      if (!sel.endsWith("-notes") || !page.url().includes("tab=notes")) fail(tag, `arrow key did not select Notes in step with the URL (${sel} ${page.url()})`);
      if (SHOTS) {
        await page.goto(base.base + (lang === "he" ? "/he" : "") + "/projects/bothy", { waitUntil: "load" });
        await settle(page);
        await page.screenshot({ path: `${SHOTS}/project.${lang}.${theme}.${width}.png`, fullPage: true, timeout: 120000 });
      }
      await page.close();

      /* releases tab, grouped rows */
      if (full) {
      page = await open(ctx, lang, "/projects/bothy?tab=releases");
      r = await page.evaluate(projectProbe);
      tag = T("/projects/bothy?tab=releases");
      if (!r.rowsDeep.length || r.rowsDeep.some((h) => h < 44)) fail(tag, `rows ${JSON.stringify(r.rowsDeep)} (need some, 44+)`);
      if (r.overflow) fail(tag, "horizontal overflow");
      await page.close();

      /* a project with no repository stats: no tiles, no empty strip */
      page = await open(ctx, lang, "/projects/windom");
      r = await page.evaluate(projectProbe);
      tag = T("/projects/windom");
      if (r.tiles.length) fail(tag, `invented stat tiles ${JSON.stringify(r.tiles)}`);
      if (r.overflow) fail(tag, "horizontal overflow");
      await page.close();
      }
      await ctx.close();
}));

/* desktop: untouched */
for (const lang of LANGS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await ctx.route("**/api/**", handler());
  for (const route of ["/projects", "/projects/bothy"]) {
    const page = await open(ctx, lang, route);
    const r = await page.evaluate(desktopProbe);
    if (r.bad.length) fail(`${lang} 1280 ${route}`, `phone-only boxes show on desktop: ${r.bad.join(", ")}`);
    if (r.overflow) fail(`${lang} 1280 ${route}`, "overflow");
    await page.close();
  }
  await ctx.close();
}

await browser.close();
base.stop();
if (fails.length) {
  const seen = new Set();
  for (const f of fails) if (!seen.has(f)) { seen.add(f); console.log("FAIL  " + f); }
  console.log(`\n${seen.size} problem(s).`);
  process.exit(1);
}
console.log("Public projects (direction A): clean.");
