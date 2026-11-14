#!/usr/bin/env node
/*
 * Direction A ("grouped") on the PUBLIC blog, on a phone.
 *
 *   npm run build && npm run a11y:public-blog        (about 25 s)
 *
 * 360 / 390 / 430, English and Hebrew, light and dark, on the blog list, the
 * feed with a topic filter, an area and a note. Facts only, never timing:
 *   - no sideways overflow;
 *   - every [data-phone-circle] is a true circle of 32, 40 or 56 px;
 *   - the note rows are 64+ tall, whole row one target, with a chevron;
 *   - the filter still filters (the tag results are only that tag's notes);
 *   - the reader: Contents, Text size and Share in one fixed floating bar,
 *     opaque (no blur), 44+ tall, above the safe area; Text size steps the
 *     reading scale; the bar tucks when scrolled down, returns when scrolled
 *     up, and is shown by focus; it never covers the end of the page;
 *   - at 1280 and 768 none of it is there: no phone-only box has a size.
 * Scrolling is simulated with scrollTo plus a `scroll` event, and waits are
 * fixed: this headless Chromium emits about one frame per 40 s.
 * SHOTS=dir also writes full-page screenshots. CHROME overrides the binary.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { startPreview } from "./site-stub.mjs";
import { handler } from "./blog-fixture.mjs";

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
/* poll by hand (never rAF) until the probe says so, at most ~3 s */
const until = async (page, probe, want) => {
  let p;
  for (let i = 0; i < 30; i++) {
    p = await page.evaluate(probe);
    if (want(p)) return p;
    await page.waitForTimeout(100);
  }
  return p;
};
const scrollTo = async (page, y) => {
  await page.evaluate((y) => {
    window.scrollTo(0, y);
    window.dispatchEvent(new Event("scroll"));
  }, y);
  await page.waitForTimeout(250);
};

const common = () => {
  const out = { overflow: innerWidth < document.documentElement.scrollWidth - 1, circles: [], notes: [], chevrons: 0, titles: [] };
  for (const e of document.querySelectorAll("[data-phone-circle]")) {
    const r = e.getBoundingClientRect();
    if (r.width === 0) continue;
    const cs = getComputedStyle(e);
    out.circles.push({ w: Math.round(r.width), h: Math.round(r.height), round: cs.borderRadius === "50%" || parseFloat(cs.borderRadius) >= r.width / 2 });
  }
  for (const li of document.querySelectorAll("[data-phone-note], [data-note-row]")) {
    const r = li.getBoundingClientRect();
    if (r.width === 0) continue;
    out.notes.push(Math.round(r.height));
    const a = li.querySelector("a");
    const t = a ? a.getBoundingClientRect().height : 0;
    if (t < 44) out.notes.push(-Math.round(t)); // a link under 44 shows as a negative
  }
  out.chevrons = [...document.querySelectorAll("[data-phone-chevron]")].filter((e) => e.getBoundingClientRect().width > 0).length;
  out.titles = [...document.querySelectorAll("main h3 a, [data-note-row] a[data-row-link], .rows a")].map((a) => a.textContent.trim()).filter(Boolean);
  return out;
};

const readerProbe = () => {
  const bar = document.querySelector('[data-phone="reader-bar"]');
  const out = { overflow: innerWidth < document.documentElement.scrollWidth - 1, has: !!bar };
  if (!bar) return out;
  const cs = getComputedStyle(bar);
  const pill = bar.querySelector("button")?.parentElement;
  const r = (pill ?? bar).getBoundingClientRect();
  out.fixed = cs.position === "fixed";
  out.bottomGap = Math.round(innerHeight - r.bottom);
  out.blur = [bar, pill].some((e) => e && /blur/.test(getComputedStyle(e).backdropFilter + getComputedStyle(e).filter));
  out.bg = pill ? getComputedStyle(pill).backgroundColor : "";
  out.buttons = [...bar.querySelectorAll("button")].map((b) => ({ n: (b.getAttribute("data-phone") ?? b.getAttribute("aria-label") ?? "").slice(0, 20), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) }));
  out.top = Math.round(r.top);
  out.tucked = bar.hasAttribute("data-tucked");
  out.offscreen = r.top >= innerHeight - 1;
  return out;
};

const lastContentClear = () => {
  scrollTo(0, document.documentElement.scrollHeight);
  const bar = document.querySelector('[data-phone="reader-bar"] > div:last-child') ?? document.querySelector('[data-phone="reader-bar"]');
  const box = bar.getBoundingClientRect();
  const last = [...document.querySelectorAll("footer a, footer p, footer li")].filter((e) => e.getBoundingClientRect().width > 0).pop();
  const tags = [...document.querySelectorAll("article ul a")].filter((e) => e.getBoundingClientRect().width > 0).pop();
  return { attr: document.documentElement.hasAttribute("data-has-reader-bar"), pad: getComputedStyle([...document.querySelectorAll("footer")].pop()).paddingBottom, sy: Math.round(scrollY), barTop: Math.round(box.top), lastBottom: last ? Math.round(last.getBoundingClientRect().bottom) : null, covered: last ? last.getBoundingClientRect().bottom > box.top + 1 : false, tagsBottom: tags ? Math.round(tags.getBoundingClientRect().bottom) : null };
};

const desktopProbe = () => {
  const bad = [];
  for (const e of document.querySelectorAll("[data-phone], [data-phone-chevron], [data-phone-related-circle], [data-phone-related-chevron]")) {
    const r = e.getBoundingClientRect();
    const d = getComputedStyle(e).display;
    if (r.width > 0 && r.height > 0 && d !== "contents") bad.push(e.getAttribute("data-phone") ?? e.tagName);
  }
  return { bad, overflow: innerWidth < document.documentElement.scrollWidth - 1 };
};

/* 360 and 430 in light and dark (lists + note), both languages; the filter and the area at 390. */
const combos = [];
for (const width of WIDTHS) for (const lang of LANGS) for (const theme of THEMES) combos.push({ width, lang, theme });

await Promise.all(
  combos.map(async ({ width, lang, theme }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 780 }, hasTouch: true, isMobile: true, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("theme", t);
      } catch {
        /* blocked */
      }
    }, theme);
    await ctx.addInitScript(`window.__common = ${common.toString()}`);
    await ctx.route("**/api/**", handler());
    const T = (p) => `${lang} ${theme} ${width} ${p}`;
    const checkCircles = (tag, r) => {
      for (const c of r.circles) if (![32, 40, 56].includes(c.w) || c.w !== c.h || !c.round) fail(tag, `circle ${c.w}x${c.h} round=${c.round}`);
    };

    /* the list: Latest as grouped rows */
    let page = await open(ctx, lang, "/blog");
    let r = await page.evaluate(() => window.__common());
    let tag = T("/blog");
    if (r.overflow) fail(tag, "horizontal overflow");
    if (r.notes.length < 6) fail(tag, `only ${r.notes.length} note rows`);
    if (r.notes.some((h) => h < 64)) fail(tag, `note rows ${JSON.stringify(r.notes.filter((h) => h < 64))} (64 tall, links 44)`);
    if (!r.circles.length) fail(tag, "no note circles");
    checkCircles(tag, r);
    if (r.chevrons < 6) fail(tag, `${r.chevrons} chevrons for ${r.notes.length} rows`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/blog.${lang}.${theme}.${width}.png`, fullPage: true, timeout: 120000 });
    await page.close();

    if (width === 390) {
      /* the feed with a topic: only that topic's notes, as rows */
      page = await open(ctx, lang, "/blog?view=feed&tag=docker");
      r = await page.evaluate(() => window.__common());
      tag = T("/blog?view=feed&tag=docker");
      if (r.overflow) fail(tag, "horizontal overflow");
      if (r.notes.filter((h) => h > 0).length !== 2) fail(tag, `${r.notes.length} rows for the docker topic, want 2`);
      checkCircles(tag, r);
      await page.close();

      /* an area: the history as groups with circles, actions kept */
      page = await open(ctx, lang, "/blog/area/bothy");
      r = await page.evaluate(() => window.__common());
      tag = T("/blog/area/bothy");
      if (r.overflow) fail(tag, "horizontal overflow");
      if (r.circles.length !== 3) fail(tag, `${r.circles.length} circles for 3 notes`);
      checkCircles(tag, r);
      const actions = await page.locator('[data-note-row] button, [data-note-row] a[aria-label]').count();
      if (actions < 9) fail(tag, `note actions (copy, share, open) dropped: ${actions}`);
      await page.close();
    }

    /* the reader */
    page = await open(ctx, lang, "/blog/the-long-note");
    tag = T("/blog/the-long-note");
    let p = await page.evaluate(readerProbe);
    if (p.overflow) fail(tag, "horizontal overflow");
    if (!p.has) fail(tag, "no floating reader bar");
    else {
      if (!p.fixed) fail(tag, "reader bar is not fixed");
      if (p.blur) fail(tag, "reader bar uses blur");
      if (/rgba\(.*, 0\)|transparent/.test(p.bg)) fail(tag, `reader bar background is not opaque: ${p.bg}`);
      if (p.bottomGap < 8) fail(tag, `reader bar ${p.bottomGap}px from the bottom`);
      if (p.buttons.length !== 3) fail(tag, `reader bar has ${p.buttons.length} controls, want Contents, Text size, Share: ${JSON.stringify(p.buttons)}`);
      if (p.buttons.some((b) => b.h < 44 || b.w < 44)) fail(tag, `bar controls under 44: ${JSON.stringify(p.buttons)}`);
      if (p.tucked) fail(tag, "bar is tucked at the top of the note");

      /* text size: the same reading scale the sheet changes */
      await page.locator('[data-phone="reader-size"]').click({ force: true });
      await page.waitForTimeout(200);
      const before = await page.evaluate(() => getComputedStyle(document.querySelector("article")).getPropertyValue("--note-scale").trim());
      await page.locator('[data-phone="reader-bar"] [role="group"] button').last().click({ force: true });
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => getComputedStyle(document.querySelector("article")).getPropertyValue("--note-scale").trim());
      if (before === after) fail(tag, `Text size did not change the reading scale (${before})`);
      await page.locator('[data-phone="reader-size"]').click({ force: true });
      await page.waitForTimeout(150);

      /* contents opens the sheet */
      await page.locator('[data-phone="reader-contents"]').click({ force: true });
      await page.waitForTimeout(250);
      if (!(await page.evaluate(() => !!document.querySelector("dialog[open]")))) fail(tag, "Contents did not open the sheet");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      await page.evaluate(() => document.activeElement?.blur());

      /* tuck: down hides, up returns, focus shows */
      await scrollTo(page, 700);
      p = await until(page, readerProbe, (q) => q.tucked);
      if (!p.tucked || !p.offscreen) fail(tag, `bar did not tuck on scroll down ${JSON.stringify({ t: p.tucked, top: p.top })}`);
      await scrollTo(page, 600);
      p = await until(page, readerProbe, (q) => !q.tucked);
      if (p.tucked || p.offscreen) fail(tag, "bar did not return on scroll up");
      await scrollTo(page, 1200);
      await page.keyboard.press("Shift");
      await page.locator('[data-phone="reader-contents"]').focus();
      await page.waitForTimeout(250);
      p = await page.evaluate(readerProbe);
      if (p.offscreen) fail(tag, "focus in the bar did not show it");
      await page.evaluate(() => document.activeElement?.blur());

      /* the end of the page is never under the bar */
      const end = await page.evaluate(() => {
        scrollTo(0, document.documentElement.scrollHeight);
        window.dispatchEvent(new Event("scroll"));
      });
      await page.waitForTimeout(250);
      await page.locator('[data-phone="reader-contents"]').focus();
      await page.waitForTimeout(250);
      const clear = await page.evaluate(lastContentClear);
      if (clear.covered) fail(tag, `the bar covers the end of the page ${JSON.stringify(clear)}`);
      void end;
    }
    /* the related notes are grouped rows with circles */
    const rel = await page.evaluate(() => [...document.querySelectorAll("[data-phone-related-circle]")].filter((e) => e.getBoundingClientRect().width > 0).length);
    if (width === 390 && rel < 1) fail(tag, "related notes have no circles");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/note.${lang}.${theme}.${width}.png`, fullPage: true, timeout: 120000 });
    await page.close();
    await ctx.close();
  }),
);

/* tablet and desktop: untouched */
for (const width of [1280, 768]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  await ctx.route("**/api/**", handler());
  for (const lang of LANGS) {
    for (const route of ["/blog", "/blog/area/bothy", "/blog/the-long-note"]) {
      const page = await open(ctx, lang, route);
      const r = await page.evaluate(desktopProbe);
      if (r.bad.length) fail(`${lang} ${width} ${route}`, `phone-only boxes show: ${r.bad.join(", ")}`);
      if (r.overflow) fail(`${lang} ${width} ${route}`, "overflow");
      await page.close();
    }
  }
  await ctx.close();
}

await browser.close();
base.stop();
if (fails.length) {
  const seen = new Set();
  for (const f of fails) if (!seen.has(f)) {
    seen.add(f);
    console.log("FAIL  " + f);
  }
  console.log(`\n${seen.size} problem(s).`);
  process.exit(1);
}
console.log("Public blog (direction A): clean.");
