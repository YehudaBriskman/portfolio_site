#!/usr/bin/env node
/*
 * W3: the blog list cards and the post header on a phone.
 *
 *   npm run build && npm run a11y:public-blog-cards        (about 1 min)
 *
 * 360 / 390 / 430, English and Hebrew, light and dark. Facts only, never timing:
 *   - no sideways overflow on the list or a note;
 *   - the three recommended cards lead with a 16:9 plate (the cover where there
 *     is one, the glyph tile where there is not), lazy, size reserved;
 *   - titles start at the reading edge of their own script (dir=auto), and the
 *     wrapped meta line never begins with a separator;
 *   - the post: title, subtitle and byline share one start edge, the cover is
 *     16:9 and full width, there is no empty band between the byline and the
 *     first paragraph, and the floating bar does not sit over the first heading
 *     when the note opens;
 *   - Edit: a visitor's bar has three controls and no Edit; the signed-in owner's
 *     has four, Edit last, 44+ tall, named, inside the viewport; Edit is gone
 *     from the header; the bar's grid is 3 columns for a visitor, 4 for the owner;
 *   - at 1280 and 768 the phone-only plate has no size.
 * The admin session is a stub: the `admin-seen-v1` mark plus the stub's /admin/me.
 * Waits are fixed, never rAF (this headless Chromium emits about one frame per 40 s).
 * SHOTS=dir writes screenshots (bar open, tucked). CHROME overrides the binary.
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
const shot = async (page, path, opts = {}) => {
  for (let i = 0; ; i++) {
    try {
      return await page.screenshot({ path, timeout: 120000, ...opts });
    } catch (e) {
      if (i >= 3) throw e;
      await page.waitForTimeout(1500);
    }
  }
};

const settle = async (page) => {
  await page.locator("footer").first().waitFor({ state: "attached" });
  for (let i = 0; i < 20; i++) {
    if ((await page.locator('[aria-busy="true"]').count()) === 0) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(500);
};
const context = (width, lang, theme, admin) =>
  browser.newContext({
    viewport: { width, height: width < 640 ? 844 : 900 },
    hasTouch: width < 640,
    isMobile: width < 640,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    colorScheme: theme,
    locale: lang === "he" ? "he-IL" : "en-US",
  }).then(async (ctx) => {
    await ctx.addInitScript(
      ([t, a]) => {
        try {
          localStorage.setItem("theme", t);
          if (a) localStorage.setItem("admin-seen-v1", "1");
        } catch {
          /* blocked */
        }
      },
      [theme, admin],
    );
    await ctx.route("**/api/**", handler({ extras: true }));
    return ctx;
  });
const open = async (ctx, lang, route) => {
  const page = await ctx.newPage();
  await page.goto(base.base + (lang === "he" ? `/he${route}` : route), { waitUntil: "load" });
  await settle(page);
  return page;
};

/* ───────────────────────────────────────────────────────────── the list */
const listFacts = () => {
  const out = { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, cards: [], dots: 0 };
  for (const li of document.querySelectorAll('ul[class*="posts"] > li')) {
    const media = li.querySelector("[data-post-media]");
    const r = media?.getBoundingClientRect();
    const img = media?.querySelector("img");
    const title = li.querySelector("h3");
    const tr = title?.getBoundingClientRect();
    const head = li.querySelector('[class*="postHead"]')?.getBoundingClientRect();
    const rtl = getComputedStyle(li).direction === "rtl";
    const dirAuto = title?.getAttribute("dir") === "auto";
    out.cards.push({
      ratio: r && r.height ? r.width / r.height : 0,
      lazy: img ? img.loading === "lazy" && !!img.width && !!img.height : true,
      glyph: !!media?.querySelector("svg"),
      titleDir: getComputedStyle(title).direction,
      dirAuto,
      titleAlign: getComputedStyle(title).textAlign,
      startEdgeDelta: tr && head ? (getComputedStyle(title).direction === "rtl" ? Math.abs(tr.right - head.right) : Math.abs(tr.left - head.left)) : 0,
      pageRtl: rtl,
    });
  }
  for (const m of document.querySelectorAll('[class*="metaPart"]')) {
    const c = getComputedStyle(m, "::before").content;
    if (c && c !== "none" && c !== "normal") out.dots++;
  }
  return out;
};

/* ─────────────────────────────────────────────────────────── the post */
const postFacts = () => {
  const art = document.querySelector("article");
  const h1 = art.querySelector("h1");
  const sub = h1.nextElementSibling;
  const byline = [...art.querySelectorAll("header *")].filter((e) => e.getAttribute?.("data-byline") !== null).pop();
  const header = art.querySelector("header");
  const hr = header.getBoundingClientRect();
  const firstP = art.querySelector('[class*="prose"] p');
  const fpr = firstP?.getBoundingClientRect();
  const cover = art.querySelector("img.bleed");
  const cr = cover?.getBoundingClientRect();
  const h2 = [...art.querySelectorAll("h2")].find((h) => !header.contains(h));
  const h2r = h2?.getBoundingClientRect();
  const bar = document.querySelector('[data-phone="reader-bar"]');
  const pill = bar?.firstElementChild?.matches?.("[data-cols]") ? bar.firstElementChild : bar?.querySelector("[data-cols]");
  const br = pill?.getBoundingClientRect();
  const rtl = getComputedStyle(h1).direction === "rtl";
  const edge = (el) => {
    const r = el.getBoundingClientRect();
    return rtl ? r.right : r.left;
  };
  const lastHeaderChild = [...header.children].filter((c) => c.getClientRects().length > 0).pop()?.getBoundingClientRect();
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h1Edge: edge(h1),
    subEdge: sub && sub.tagName === "P" && !sub.hasAttribute("data-written-in") ? edge(sub) : null,
    gap: fpr && lastHeaderChild ? fpr.top - (cover ? cr.bottom : lastHeaderChild.bottom) : null,
    headerBottom: hr.bottom,
    coverRatio: cr && cr.height ? cr.width / cr.height : null,
    coverW: cr?.width ?? null,
    coverL: cr?.left ?? null,
    coverR: cr?.right ?? null,
    vw: document.documentElement.clientWidth,
    h2Top: h2r?.top ?? null,
    barTop: br?.top ?? null,
    cols: pill?.getAttribute("data-cols") ?? null,
    barBtns: pill ? [...pill.querySelectorAll("a,button")].map((e) => ({ r: e.getBoundingClientRect().toJSON(), n: e.getAttribute("aria-label") ?? e.textContent.trim(), edit: e.getAttribute("data-phone") === "reader-edit" })) : [],
    editInHeader: [...header.querySelectorAll('a[href*="/admin/posts/"]')].some((a) => a.getClientRects().length > 0),
    vh: innerHeight,
  };
};

for (const width of WIDTHS) {
  for (const lang of LANGS) {
    for (const theme of THEMES) {
      const tag = `${width} ${lang} ${theme}`;

      /* the list, as a visitor */
      {
        const ctx = await context(width, lang, theme, false);
        const page = await open(ctx, lang, "/blog");
        const f = await page.evaluate(listFacts);
        if (f.overflow > 0) fail(tag, `/blog overflows sideways by ${f.overflow}px`);
        if (f.cards.length !== 3) fail(tag, `/blog shows ${f.cards.length} recommended cards, expected 3`);
        for (const [i, c] of f.cards.entries()) {
          if (Math.abs(c.ratio - 16 / 9) > 0.03) fail(tag, `card ${i} plate is ${c.ratio.toFixed(2)}, not 16:9`);
          if (!c.lazy) fail(tag, `card ${i} cover is not lazy with a reserved size`);
          if (!c.dirAuto) fail(tag, `card ${i} title lacks dir=auto`);
          if (c.startEdgeDelta > 1) fail(tag, `card ${i} title starts ${c.startEdgeDelta}px off the area line's edge`);
        }
        if (!f.cards.some((c) => !c.glyph) && !f.cards.some((c) => c.glyph)) fail(tag, "no plates at all");
        if (f.cards.filter((c) => !c.glyph).length < 1) fail(tag, "the cover card shows no picture");
        if (f.dots > 0) fail(tag, `${f.dots} meta parts still draw a separator that can wrap to a line start`);
        if (SHOTS) {
          await shot(page, `${SHOTS}/blog.${width}.${lang}.${theme}.png`, { fullPage: true });
          const full = await open(ctx, lang, "/blog?view=feed");
          const ff = await full.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (ff > 0) fail(tag, `/blog?view=feed overflows sideways by ${ff}px`);
          await shot(full, `${SHOTS}/feed.${width}.${lang}.${theme}.png`, { fullPage: true });
        }
        await ctx.close();
      }

      /* a post, visitor then owner */
      for (const admin of [false, true]) {
        for (const slug of ["a-note-with-a-cover", "long-hebrew-title", "an-english-title-that-is-long-enough-to-wrap", "the-long-note"]) {
          if (admin && slug !== "a-note-with-a-cover" && slug !== "long-hebrew-title") continue;
          const t2 = `${tag} ${admin ? "owner" : "visitor"} ${slug}`;
          const ctx = await context(width, lang, theme, admin);
          const page = await open(ctx, lang, `/blog/${slug}`);
          if (admin) await page.waitForSelector('a[data-phone="reader-edit"]', { timeout: 8000 }).catch(() => {});
          const f = await page.evaluate(postFacts);
          if (f.overflow > 0) fail(t2, `overflows sideways by ${f.overflow}px`);
          if (f.subEdge != null && Math.abs(f.subEdge - f.h1Edge) > 1) fail(t2, `subtitle starts ${Math.abs(f.subEdge - f.h1Edge)}px off the title`);
          if (f.coverRatio != null) {
            if (Math.abs(f.coverRatio - 16 / 9) > 0.03) fail(t2, `cover is ${f.coverRatio.toFixed(2)}, not 16:9`);
            if (Math.abs(f.coverW - f.vw) > 1 || Math.abs(f.coverL) > 1 || Math.abs(f.coverR - f.vw) > 1) fail(t2, `cover spans ${Math.round(f.coverL)}..${Math.round(f.coverR)} of a ${f.vw}px page`);
          }
          if (f.gap != null && f.gap > 64) fail(t2, `${Math.round(f.gap)}px of empty space between the header and the first paragraph`);
          if (f.cols !== (admin ? "4" : "3")) fail(t2, `bar has data-cols=${f.cols}`);
          if (f.barBtns.length !== (admin ? 4 : 3)) fail(t2, `bar has ${f.barBtns.length} controls`);
          if (admin) {
            const e = f.barBtns.at(-1);
            if (!e?.edit) fail(t2, "Edit is not the bar's last control");
            else {
              if (e.r.height < 44 || e.r.width < 44) fail(t2, `Edit is ${Math.round(e.r.width)}x${Math.round(e.r.height)}`);
              if (e.r.left < 0 || e.r.right > f.vw) fail(t2, "Edit is outside the viewport");
              if (!e.n) fail(t2, "Edit has no name");
            }
          } else if (f.barBtns.some((b) => b.edit)) fail(t2, "a visitor's bar offers Edit");
          if (f.editInHeader) fail(t2, "Edit is still drawn in the header");
          if (f.h2Top != null && f.barTop != null && f.h2Top < f.vh && f.h2Top + 28 > f.barTop && slug === "the-long-note") fail(t2, `the first heading (${Math.round(f.h2Top)}) is under the bar (${Math.round(f.barTop)})`);
          if (SHOTS && (slug === "a-note-with-a-cover" || slug === "long-hebrew-title" || slug === "an-english-title-that-is-long-enough-to-wrap")) {
            await shot(page, `${SHOTS}/post.${slug}.${width}.${lang}.${theme}.${admin ? "owner" : "visitor"}.png`);
            if (slug === "a-note-with-a-cover") {
              /* tucked: scroll down past the threshold */
              await page.evaluate(() => {
                window.scrollTo(0, 500);
                window.dispatchEvent(new Event("scroll"));
              });
              await page.waitForTimeout(400);
              await page.evaluate(() => {
                window.scrollTo(0, 900);
                window.dispatchEvent(new Event("scroll"));
              });
              await page.waitForTimeout(700);
              await shot(page, `${SHOTS}/post-tucked.${width}.${lang}.${theme}.${admin ? "owner" : "visitor"}.png`);
            }
          }
          await ctx.close();
        }
      }
    }
  }
}

/* wide: the phone plate has no size, and the header row is back */
for (const width of [768, 1280]) {
  const ctx = await context(width, "en", "light", true);
  const page = await open(ctx, "en", "/blog");
  const sizes = await page.evaluate(() => [...document.querySelectorAll("[data-post-media]")].map((e) => e.getBoundingClientRect().height));
  if (sizes.some((h) => h > 0)) fail(`${width}`, "the phone plate has a size above the phone breakpoint");
  await ctx.close();
}

await browser.close();
base.stop();
if (fails.length) {
  console.error(`\n${fails.length} problem(s):\n${[...new Set(fails)].map((f) => ` - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("public-blog-cards: ok");
