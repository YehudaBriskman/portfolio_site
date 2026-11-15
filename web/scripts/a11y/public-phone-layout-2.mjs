#!/usr/bin/env node
/*
 * Phone layout, second pass (#820): four things that must not come back.
 *
 *   npm run build && node scripts/a11y/public-phone-layout-2.mjs
 *   SHOTS=../docs/design/phone-layout-2/raw node scripts/a11y/public-phone-layout-2.mjs
 *
 * 1. PROJECT HEADER cannot collapse. tile | title+status | share on a grid:
 *    the status chip is under the title column's START edge (never beside it,
 *    never overlapping), the share button is inside the card, nothing
 *    overflows, for a short, a long, a Hebrew and a no-space title, at
 *    360/390/430 and at 200% text.
 * 2. BOTTOM DOCK: its gap to the bottom of the viewport is the same at every
 *    toolbar state (innerHeight changed to emulate Safari's bar collapsing),
 *    and the stylesheet never ADDS the safe area to the constant.
 * 3. BACK CONTROL is fixed: after a long scroll it is at the menu circle's top,
 *    height and layer, never overlaps the circle, and a very long name (Hebrew,
 *    English, mixed) is cut with an ellipsis inside the chip.
 * 4. POST FOOTER rhythm: tags, links, author card each have >= 16px between.
 *
 * Real iOS Safari is NOT emulated: env(safe-area-inset-bottom) is 0 in
 * headless Chromium, so (2) checks the toolbar-height half and the stylesheet.
 * Polling is by hand; this Chromium has no frame clock.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { startPreview } from "./site-stub.mjs";
import { handler as projectsHandler } from "./projects-fixture.mjs";
import { handler as blogHandler } from "./blog-fixture.mjs";

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
  await page.waitForTimeout(500);
};

const TITLES = {
  short: "WindoM",
  long: "Bothy: a console for one machine that asks Docker what is running right now",
  he: "טלמטריה ל־WindoM על אותו cluster קטן ועוד שם ארוך מאוד של פרויקט",
  nospace: "Supercalifragilisticexpialidocious-ProjectNameWithoutAnySpaces",
};
const LONG_NAMES = {
  en: "A very long area name that cannot possibly fit beside the menu circle at 360",
  he: "שם תחום ארוך מאוד שלא יכול להיכנס ליד כפתור התפריט בשום רוחב של טלפון",
  mixed: "oci-free-tier-observability-and-telemetry-for-a-small-cluster",
  short: "Work",
};

/* ---- 0. stylesheet facts ------------------------------------------------ */
{
  const css = readFileSync("src/index.css", "utf8");
  const m = css.match(/--dock-bottom:\s*([^;]+);/);
  if (!m || !/^max\(/.test(m[1].trim())) fail("css", `--dock-bottom must be max(), got ${m?.[1]}`);
  for (const f of ["src/components/ui/Dock.module.css", "src/components/notes/reader/Reader.module.css"]) {
    const t = readFileSync(f, "utf8");
    if (/inset-block-end:[^;]*safe-area-inset-bottom/.test(t)) fail("css", `${f} adds the safe area to a fixed bottom`);
  }
}

const probeHeader = () => {
  const vis = (s) => [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().width > 0);
  const head = vis('[data-phone-card="header"]')[0];
  if (!head) return { none: true };
  const h1El = head.querySelector("h1");
  const h1 = h1El.getBoundingClientRect();
  const pill = head.querySelector("[data-phone-pill]").getBoundingClientRect();
  const hb = head.getBoundingClientRect();
  const top = h1El.closest("div").parentElement;
  const kids = [...top.children].map((k) => k.getBoundingClientRect());
  const share = kids[2];
  const rtl = getComputedStyle(h1El.parentElement).direction === "rtl";
  const col = h1El.parentElement.getBoundingClientRect();
  const pillStart = rtl ? pill.right : pill.left;
  const colStart = rtl ? col.right : col.left;
  const overlap = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  return {
    overflow: innerWidth < document.documentElement.scrollWidth - 1,
    startGap: Math.round(Math.abs(pillStart - colStart)),
    below: Math.round(pill.top - h1.bottom),
    pillOverTitle: overlap(pill, h1),
    kidsOverlap: kids.some((a, i) => kids.some((b, j) => j > i && overlap(a, b))),
    shareInside: share.left >= hb.left - 1 && share.right <= hb.right + 1,
    colInside: col.left >= hb.left - 1 && col.right <= hb.right + 1,
    /* the title column holds ~10 characters, or the header has stacked (tile and
       share on a row above, the title full width under them) */
    colW: Math.round(col.width),
    fontPx: parseFloat(getComputedStyle(h1El).fontSize),
    stacked: col.top >= kids[0].bottom - 1,
    cardInner: Math.round(hb.width - 32),
    hOverflow: h1El.scrollWidth > h1El.clientWidth + 1,
    dockOverTitle: (() => {
      const d = document.querySelector("[data-phone-pinned]");
      if (!d) return false;
      const dr = d.getBoundingClientRect();
      return getComputedStyle(d).position === "fixed" && overlap(dr, h1) && h1.top >= 0 && h1.top < innerHeight;
    })(),
  };
};

const probeBack = () => {
  const float = document.querySelector("[data-floating-back]");
  const circle = [...document.querySelectorAll("button")].find((b) => b.getBoundingClientRect().width === 46 && getComputedStyle(b).position === "fixed");
  if (!float) return { none: true };
  const f = float.getBoundingClientRect();
  const link = float.querySelector("[data-back-chip]").getBoundingClientRect();
  const more = float.querySelector("[data-back-menu]").getBoundingClientRect();
  const name = float.querySelector("[data-back-pill]");
  const nb = name.getBoundingClientRect();
  const c = circle?.getBoundingClientRect();
  const cs = getComputedStyle(float);
  return {
    fixed: cs.position === "fixed",
    top: Math.round(f.top),
    height: Math.round(f.height),
    circleTop: c ? Math.round(c.top) : null,
    circleH: c ? Math.round(c.height) : null,
    overlapCircle: c ? f.left < c.right && c.left < f.right && f.top < c.bottom && c.top < f.bottom : false,
    inside: nb.left >= f.left - 1 && nb.right <= f.right + 1 && more.right <= f.right + 1 && more.left >= f.left,
    ellipsis: getComputedStyle(name).textOverflow === "ellipsis",
    linkH: Math.round(link.height),
    moreW: Math.round(more.width),
    off: f.left < 0 || f.right > innerWidth,
    scrollY: Math.round(scrollY),
  };
};

const combos = [];
for (const width of WIDTHS) for (const lang of LANGS) for (const theme of THEMES) combos.push({ width, lang, theme });

await Promise.all(
  combos.map(async ({ width, lang, theme }) => {
    const mk = async (h) => {
      const ctx = await browser.newContext({ viewport: { width, height: h }, hasTouch: true, isMobile: true, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
      await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch { /* blocked */ } }, theme);
      return ctx;
    };
    const pre = lang === "he" ? "/he" : "";

    /* 1 + 3 + 2: the project page */
    {
      const ctx = await mk(780);
      await ctx.route("**/api/**", projectsHandler({ cover: true, windom: true }));
      const page = await ctx.newPage();
      await page.goto(base.base + pre + "/projects/windom", { waitUntil: "load" });
      await settle(page);
      for (const [key, text] of Object.entries(TITLES)) {
        for (const zoom of [1, 1.5, 2, 3]) {
          const tag = `header ${lang} ${theme} ${width} ${key} x${zoom}`;
          await page.evaluate(([t, z]) => {
            scrollTo(0, 0);
            document.querySelector('[data-phone-card="header"] h1').textContent = t;
            let st = document.getElementById("zoom-probe");
            if (!st) { st = document.createElement("style"); st.id = "zoom-probe"; document.head.append(st); }
            /* No frame clock here: a transition (even the 0.01ms reduced-motion one) never
               finishes, so computed sizes stay at their start value. Switch them off. */
            st.textContent = `*,*::before,*::after{transition:none !important;animation:none !important}html{font-size:${17 * z}px !important}`;
          }, [text, zoom]);
          await page.waitForTimeout(250);
          const r = await page.evaluate(probeHeader);
          if (r.none) { fail(tag, "no header"); continue; }
          if (r.overflow) fail(tag, "horizontal overflow");
          if (r.startGap > 2) fail(tag, `status chip is ${r.startGap}px from the title column's start edge`);
          if (r.below < 0 || r.pillOverTitle) fail(tag, `status chip overlaps the title (${r.below}px under it)`);
          if (r.kidsOverlap) fail(tag, "tile, name and share overlap");
          if (!r.shareInside || !r.colInside) fail(tag, "share or name falls outside the card");
          if (!r.stacked && r.colW < r.fontPx * 5.5) fail(tag, `title column ${r.colW}px holds fewer than ~10 characters at ${r.fontPx}px and the header did not stack`);
          if (r.stacked && r.colW < r.cardInner - 2) fail(tag, `stacked title is ${r.colW}px, not the full ${r.cardInner}px`);
          if (r.hOverflow) fail(tag, "the title overflows its box sideways");
          if (r.dockOverTitle) fail(tag, "the fixed Dock covers the title");
          if (SHOTS && (zoom === 1 || key === "long")) {
            await page.locator('[data-phone-card="header"]').screenshot({ path: `${SHOTS}/head.${lang}.${theme}.${width}.${key}.x${zoom}.png`, timeout: 120000 });
          }
        }
      }
      /* back to normal size, but keep transitions off: with no frame clock a transition
         started by removing the override would stay half way for ever */
      await page.evaluate(() => { const st = document.getElementById("zoom-probe"); if (st) st.textContent = "*,*::before,*::after{transition:none !important;animation:none !important}"; });
      await page.waitForTimeout(150);

      for (const [key, name] of Object.entries(LONG_NAMES)) {
        const tag = `back ${lang} ${theme} ${width} ${key}`;
        await page.evaluate((n) => { document.querySelector("[data-back-pill]").textContent = n; }, name);
        await page.evaluate(() => scrollTo(0, 0));
        const a = await page.evaluate(probeBack);
        await page.evaluate(() => scrollTo(0, 900));
        await page.waitForTimeout(200);
        const b = await page.evaluate(probeBack);
        if (a.none) { fail(tag, "no floating back control"); continue; }
        if (!b.fixed || a.top !== b.top) fail(tag, `moves with the page: top ${a.top} then ${b.top}`);
        if (b.scrollY < 100) fail(tag, "the page did not scroll");
        if (b.height !== 46 || (b.circleH && b.height !== b.circleH)) fail(tag, `height ${b.height} vs circle ${b.circleH}`);
        if (b.circleTop != null && b.top !== b.circleTop) fail(tag, `top ${b.top} vs circle ${b.circleTop}`);
        if (b.overlapCircle) fail(tag, "overlaps the menu circle");
        if (!b.inside) fail(tag, "label or chevron spills out of the chip");
        if (!b.ellipsis) fail(tag, "the label has no ellipsis");
        if (b.linkH < 44 || b.moreW < 44) fail(tag, `targets ${b.linkH} x ${b.moreW}`);
        if (b.off) fail(tag, "chip is off screen");
        if (SHOTS && (width === 360 || key === "short")) {
          await page.screenshot({ path: `${SHOTS}/back.${lang}.${theme}.${width}.${key}.png`, timeout: 120000 });
        }
      }

      {
        const tag = `back menu ${lang} ${theme} ${width}`;
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator("[data-back-menu]").click({ force: true });
        await page.waitForTimeout(400);
        const items = await page.locator('[role="menuitem"]').allTextContents();
        if (items.length < 4) fail(tag, `menu has ${items.length} items: ${items}`);
        if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/menu.${lang}.${theme}.${width}.png`, timeout: 120000 });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
        if ((await page.locator('[role="menuitem"]').count()) !== 0) fail(tag, "Escape did not close the menu");
      }

      {
        const gaps = [];
        for (const h of [664, 720, 780]) {
          await page.setViewportSize({ width, height: h });
          await page.evaluate(() => scrollTo(0, 300));
          await page.waitForTimeout(150);
          gaps.push(await page.evaluate(() => {
            const d = document.querySelector("[data-phone-pinned]");
            return d ? Math.round(innerHeight - d.getBoundingClientRect().bottom) : null;
          }));
        }
        const tag = `dock ${lang} ${theme} ${width}`;
        if (gaps.includes(null)) fail(tag, "no pinned dock on the project page");
        else if (new Set(gaps).size !== 1 || gaps[0] !== 12) fail(tag, `gap to the bottom differs by toolbar height: ${gaps}`);
        if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/dock.${lang}.${theme}.${width}.png`, timeout: 120000 });
      }
      await ctx.close();
    }

    /* 4: a post, and its footer */
    {
      const ctx = await mk(780);
      await ctx.route("**/api/**", blogHandler());
      const page = await ctx.newPage();
      await page.goto(base.base + pre + "/blog/merging-does-not-ship", { waitUntil: "load" });
      await settle(page);
      const tag = `post ${lang} ${theme} ${width}`;
      const r = await page.evaluate(() => {
        const art = document.querySelector("article");
        const tags = art.querySelector("ul[class*='tagList']");
        const links = art.querySelector("ul[class*='groupRows']");
        const card = [...art.querySelectorAll("[class*='groupCard']")].find((e) => e.querySelector("a[href='/feed.xml']"));
        const feed = card?.querySelector("a[href='/feed.xml']");
        const byline = card?.firstElementChild;
        const gap = (a, b) => (a && b ? Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom) : null);
        const fr = feed?.getBoundingClientRect();
        const br = byline?.getBoundingClientRect();
        return {
          tagsToLinks: gap(tags, links),
          linksToCard: gap(links, card),
          feedGap: fr && br ? Math.round(fr.top >= br.bottom - 1 ? fr.top - br.bottom : Math.max(fr.left - br.right, br.left - fr.right)) : null,
          feedBottom: fr && card ? Math.round(card.getBoundingClientRect().bottom - fr.bottom) : null,
          have: { tags: !!tags, links: !!links, card: !!card },
          overflow: innerWidth < document.documentElement.scrollWidth - 1,
        };
      });
      if (!r.have.tags || !r.have.links || !r.have.card) fail(tag, `missing footer blocks ${JSON.stringify(r.have)}`);
      else {
        if (r.tagsToLinks < 16) fail(tag, `tags to link card ${r.tagsToLinks}px`);
        if (r.linksToCard < 16) fail(tag, `link card to author card ${r.linksToCard}px`);
        if (r.feedGap < 8) fail(tag, `RSS row ${r.feedGap}px under the byline`);
        if (r.feedBottom < 12) fail(tag, `RSS row ${r.feedBottom}px above the card's bottom edge`);
      }
      if (r.overflow) fail(tag, "horizontal overflow");
      if (SHOTS) {
        await page.evaluate(() => { const t = document.querySelector("article ul[class*='tagList']"); if (t) scrollTo(0, t.getBoundingClientRect().top + scrollY - 200); });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/postfoot.${lang}.${theme}.${width}.png`, timeout: 120000 });
      }
      await ctx.close();
    }
  }),
);

await browser.close();
base.stop();
if (fails.length) {
  const seen = new Set();
  for (const f of fails) if (!seen.has(f)) { seen.add(f); console.log("FAIL  " + f); }
  console.log(`\n${seen.size} problem(s).`);
  process.exit(1);
}
console.log("Phone layout, second pass: clean.");
