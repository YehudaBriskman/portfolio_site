#!/usr/bin/env node
/*
 * Direction A ("grouped") on the public pages that are not Projects, Blog or
 * the reader, on a phone. One runner, three page groups (one per PR):
 *
 *   npm run build && npm run a11y:public-phone [-- home|info|forms]   (under 25 s)
 *
 * With no argument it runs every group in scripts/a11y/phone-pages/.
 *
 * 360 / 390 / 430, English and Hebrew, light and dark (dark at 390 only).
 * Facts only, never timing:
 *   - no sideways overflow;
 *   - every [data-phone-circle] is a true circle of 32, 40 or 56 px;
 *   - the page has the grouped surfaces it should (min counts per page);
 *   - every row, button, text field and footer link is 44 tall (and footer
 *     links 44 wide); a checkbox's label is its hit area;
 *   - with a short viewport (the on-screen keyboard), each text field can be
 *     focused, stays inside the visible viewport and is not under a fixed
 *     element, and the primary button can be reached the same way;
 *   - at 1280 and 768 no phone-only box has a size (the byte comparison is
 *     compare-wide.mjs).
 * Waits are fixed and polling is by hand: this headless Chromium emits about
 * one frame per 40 s, so nothing here depends on rAF or animationend.
 * SHOTS=dir also writes full-page screenshots. CHROME overrides the binary.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startPreview } from "./site-stub.mjs";
import { handler } from "./projects-fixture.mjs";

const group = process.argv[2];
const WIDTHS = (process.env.WIDTHS ?? "360,390,430").split(",").map(Number);
const LANGS = (process.env.LANGS ?? "en,he").split(",");
const THEMES = (process.env.THEMES ?? "light,dark").split(",");
const SHOTS = process.env.SHOTS ?? "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const HERE = dirname(fileURLToPath(import.meta.url));
const names = group ? [group] : readdirSync(resolve(HERE, "phone-pages")).filter((n) => n.endsWith(".mjs")).map((n) => n.replace(/\.mjs$/, ""));
const pages = (await Promise.all(names.map((n) => import(`./phone-pages/${n}.mjs`)))).flatMap((m) => m.pages);

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

const probe = () => {
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.display !== "none" && !e.closest("[aria-hidden='true']");
  };
  const out = { overflow: innerWidth < document.documentElement.scrollWidth - 1, circles: [], small: [], groups: 0, cards: 0, fields: 0 };
  for (const e of document.querySelectorAll("[data-phone-circle]")) {
    const r = e.getBoundingClientRect();
    if (r.width === 0) continue;
    const cs = getComputedStyle(e);
    out.circles.push({ w: Math.round(r.width), h: Math.round(r.height), round: cs.borderRadius === "50%" || parseFloat(cs.borderRadius) >= r.width / 2 });
  }
  out.groups = [...document.querySelectorAll("[data-phone-group]")].filter((e) => e.getBoundingClientRect().height > 0).length;
  out.cards = [...document.querySelectorAll("[data-ph-card],[data-ph-ask]")].filter(vis).length;
  /* targets: whole rows, buttons, text fields, footer links, checkbox labels */
  const sel = [
    "[data-phone-row]",
    "main .btn",
    "main button",
    "main input:not([type=hidden]):not([type=checkbox]):not([type=radio])",
    "main select",
    "main textarea",
    "main label:has(input[type=checkbox])",
    "footer a",
    "[data-ph-target]",
    "[data-ph=onward]",
  ].join(",");
  for (const e of document.querySelectorAll(sel)) {
    if (!vis(e) || e.closest("[data-ph-trap]") || e.closest("dialog:not([open])")) continue;
    const r = e.getBoundingClientRect();
    const name = (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 24);
    if (r.height < 43.5) out.small.push(`${name} ${Math.round(r.width)}x${Math.round(r.height)}`);
    else if (e.matches("footer a") && r.width < 43.5) out.small.push(`${name} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  out.fields = [...document.querySelectorAll("main input:not([type=hidden]):not([type=checkbox]), main textarea, main select")].filter(vis).length;
  out.tiny = [...document.querySelectorAll("main input:not([type=hidden]):not([type=checkbox]), main textarea, main select")]
    .filter(vis)
    .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16)
    .map((e) => e.name || e.id);
  return out;
};

/* The keyboard: a short viewport, each field focused and brought into view. */
const keyboard = async (page, tag, vh) => {
  const h0 = page.viewportSize().height;
  await page.setViewportSize({ width: page.viewportSize().width, height: vh });
  await page.waitForTimeout(150);
  const handles = await page.$$("main input:not([type=hidden]):not([type=checkbox]):not([data-ph-trap] input):not([name=website]), main textarea");
  for (const h of handles) {
    if (!(await h.isVisible())) continue;
    await h.focus();
    await h.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(250);
    const r = await h.evaluate((e) => {
      const b = e.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, Math.min(Math.max(b.top + b.height / 2, 0), innerHeight - 1));
      return { top: b.top, bottom: b.bottom, vh: innerHeight, covered: !(top && (top === e || e.contains(top) || top.closest("label")?.contains(e))), id: e.name || e.id };
    });
    if (r.top < 0 || r.bottom > r.vh) fail(tag, `field ${r.id} outside the short viewport (${Math.round(r.top)}..${Math.round(r.bottom)} of ${r.vh})`);
    if (r.covered) fail(tag, `field ${r.id} is under another element with the keyboard up`);
  }
  const btn = page.locator("main button[type=submit], main .btn-solid[type=submit]").first();
  if (await btn.count()) {
    await btn.evaluate((e) => e.scrollIntoView({ block: "center" }));
    const ok = await btn.evaluate((e) => {
      const b = e.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, Math.min(Math.max(b.top + b.height / 2, 0), innerHeight - 1));
      return top === e || e.contains(top);
    });
    if (!ok) fail(tag, "the submit button is covered with the keyboard up");
  }
  await page.setViewportSize({ width: page.viewportSize().width, height: h0 });
};

const combos = [];
for (const width of WIDTHS) for (const lang of LANGS) for (const theme of THEMES) {
  if (theme === "dark" && width !== 390) continue;
  combos.push({ width, lang, theme });
}
await Promise.all(combos.map(async ({ width, lang, theme }) => {
  const ctx = await browser.newContext({ viewport: { width, height: 780 }, hasTouch: true, isMobile: true, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch { /* blocked */ } }, theme);
  await ctx.route("**/api/**", handler());
  for (const spec of pages) {
    const tag = `${lang} ${theme} ${width} ${spec.route}`;
    const page = await ctx.newPage();
    await page.goto(base.base + (lang === "he" ? "/he" : "") + (spec.route === "/" ? "" : spec.route), { waitUntil: "load" });
    await settle(page);
    if (spec.before) await spec.before(page);
    const r = await page.evaluate(probe);
    if (r.overflow) fail(tag, "horizontal overflow");
    if (r.groups < (spec.groups ?? 0)) fail(tag, `${r.groups} grouped surfaces, want ${spec.groups}`);
    if (r.cards < (spec.cards ?? 0)) fail(tag, `${r.cards} cards, want ${spec.cards}`);
    if (r.circles.length < (spec.circles ?? 0)) fail(tag, `${r.circles.length} icon circles, want ${spec.circles}`);
    for (const c of r.circles) if (![32, 40, 56].includes(c.w) || c.w !== c.h || !c.round) fail(tag, `circle ${c.w}x${c.h} round=${c.round}`);
    for (const s of r.small) fail(tag, `target under 44: ${s}`);
    for (const f of r.tiny) fail(tag, `field ${f} under 16px`);
    if (spec.keyboard) {
      if (r.fields < 1) fail(tag, "no text field found for the keyboard check");
      await keyboard(page, tag, 440);
    }
    if (spec.check) await spec.check(page, (m) => fail(tag, m), { lang, width });
    if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/${spec.name}.${lang}.${theme}.png`, fullPage: true, timeout: 120000 });
    await page.close();
  }
  await ctx.close();
}));

/* tablet and desktop: nothing phone-only has a box */
for (const width of [1280, 768]) {
  for (const lang of LANGS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await ctx.route("**/api/**", handler());
    for (const spec of pages) {
      const page = await ctx.newPage();
      await page.goto(base.base + (lang === "he" ? "/he" : "") + (spec.route === "/" ? "" : spec.route), { waitUntil: "load" });
      await settle(page);
      const r = await page.evaluate(() => {
        const bad = [];
        for (const e of document.querySelectorAll("[data-ph-only], [data-phone-chevron], [data-phone-row] [data-phone-circle], [data-phone-circle]")) {
          const b = e.getBoundingClientRect();
          if (b.width > 0 && b.height > 0 && getComputedStyle(e).display !== "contents") bad.push(e.getAttribute("data-ph-only") ?? e.tagName);
        }
        return { bad, overflow: innerWidth < document.documentElement.scrollWidth - 1 };
      });
      if (r.bad.length) fail(`${lang} ${width} ${spec.route}`, `phone-only boxes show on a wide screen: ${r.bad.join(", ")}`);
      if (r.overflow) fail(`${lang} ${width} ${spec.route}`, "overflow");
      await page.close();
    }
    await ctx.close();
  }
}

await browser.close();
base.stop();
if (fails.length) {
  const seen = new Set();
  for (const f of fails) if (!seen.has(f)) { seen.add(f); console.log("FAIL  " + f); }
  console.log(`\n${seen.size} problem(s).`);
  process.exit(1);
}
console.log(`Public phone pages (${names.join(", ")}, direction A): clean.`);
