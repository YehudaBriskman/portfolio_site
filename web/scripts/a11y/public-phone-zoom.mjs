#!/usr/bin/env node
/*
 * Phone at 300% text (#824): labels never break mid-word and nothing is clipped
 * past the screen edge. At 360px with the root size at 300%, on the project
 * page, a blog post, a help topic and the Browse sheet, in en and he:
 *
 *   - no word of visible chrome text is split across lines (a word that does
 *     not fit makes its ROW wrap, or its label truncate with an ellipsis).
 *     The page title (h1), code and preformatted text are exempt: a title
 *     that cannot fit breaks anywhere as a last resort;
 *   - no visible control, chip, tab or label is drawn past the screen edge;
 *   - the page does not scroll sideways.
 *
 *   npm run build && node scripts/a11y/public-phone-zoom.mjs
 *   SHOTS=../docs/design/phone-layout-2/raw node scripts/a11y/public-phone-zoom.mjs
 *
 * No frame clock in this Chromium: transitions are switched off (a half-run
 * one would leave sizes stale) and polling is by hand.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { answer, startPreview } from "./site-stub.mjs";
import { handler as projectsHandler } from "./projects-fixture.mjs";

const WIDTH = 360;
const ZOOM = Number(process.env.ZOOM ?? 3);
const LANGS = (process.env.LANGS ?? "en,he").split(",");
const SHOTS = process.env.SHOTS ?? "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const base = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const fails = [];
const fail = (tag, msg) => fails.push(`${tag}  ${msg}`);

/* Runs in the page. The kit's own labels: links, buttons, summaries, tabs, chips,
   stat tiles, form labels. Prose, headings, row titles, the page title and the big .btn are exempt (they wrap at
   word boundaries and, if one word cannot fit, break as a last resort). */
function probe(rootSel) {
  const root = document.querySelector(rootSel) ?? document.body;
  const vw = innerWidth;
  const KIT = "a, button, summary, label, [role='tab'], [data-phone='stat-tile'], [class*='chip' i]";
  const skip = "h1, h2, h3, h4, [class*='Title'], [class*='title'], .btn, pre, code, svg, script, style, noscript, [aria-hidden='true'], [hidden], .editorial, .prose";
  const unseen = (el) => {
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") return true;
      if (a !== el && (cs.overflowX === "auto" || cs.overflowX === "scroll")) return true;
      if (a.tagName === "DETAILS" && !a.open && a !== el && !el.matches("summary") && !el.closest("summary")) return true;
    }
    return false;
  };
  const chain = (e) => { const o = []; for (let a = e; a && o.length < 4; a = a.parentElement) o.push(a.tagName.toLowerCase() + (a.className && typeof a.className === 'string' ? '.' + a.className.split(' ')[0] : '')); return o.join('<'); };
  const broken = [];
  const clipped = [];
  for (const el of root.querySelectorAll(KIT)) {
    if (el.closest(skip) || unseen(el)) continue;
    const eb = el.getBoundingClientRect();
    if (eb.width < 3 || eb.height < 3) continue;
    if (eb.left < -1 || eb.right > vw + 1) clipped.push(`${(el.textContent || "").trim().slice(0, 24)} [${Math.round(eb.left)}..${Math.round(eb.right)}] in ${chain(el)}`);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement.closest(skip)) continue;
      const re = /\S{3,}/g;
      for (let m = re.exec(n.textContent); m; m = re.exec(n.textContent)) {
        const r = document.createRange();
        r.setStart(n, m.index);
        r.setEnd(n, m.index + m[0].length);
        const tops = new Set([...r.getClientRects()].filter((q) => q.width > 0.5).map((q) => Math.round(q.top / 4)));
        if (tops.size > 1 && !/[-/]/.test(m[0])) broken.push(`${m[0]} in ${chain(el)}`);
      }
    }
  }
  return {
    broken: [...new Set(broken)].slice(0, 6),
    clipped: [...new Set(clipped)].slice(0, 6),
    scrollW: document.documentElement.scrollWidth,
    vw,
  };
}

const ZOOM_CSS = `*,*::before,*::after{transition:none !important;animation:none !important}html{font-size:${17 * ZOOM}px !important}`;

const settle = async (page) => {
  await page.locator("footer").first().waitFor({ state: "attached", timeout: 20000 });
  for (let i = 0; i < 20; i++) {
    if ((await page.locator('[aria-busy="true"]').count()) === 0) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(500);
};

await Promise.all(
  LANGS.map(async (lang) => {
    const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 780 }, hasTouch: true, isMobile: true, bypassCSP: true, reducedMotion: "reduce", locale: lang === "he" ? "he-IL" : "en-US" });
    let project = false;
    const projectApi = projectsHandler({ cover: true, windom: true });
    await ctx.route("**/api/**", async (route) => {
      if (project) return projectApi(route);
      const a = answer(route.request().url());
      await route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: typeof a.body === "string" ? a.body : JSON.stringify(a.body ?? a) });
    });
    const pre = lang === "he" ? "/he" : "";
    const page = await ctx.newPage();
    const shot = async (name) => {
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/zoom.${lang}.${name}.png`, fullPage: true, timeout: 120000 });
    };

    for (const [name, path, rootSel] of [
      ["project", "/projects/windom", "main"],
      ["post", "/blog/fixture-post", "main"],
      ["help", "/help/rss", "main"],
    ]) {
      const tag = `${name} ${lang} ${WIDTH} x${ZOOM}`;
      project = name === "project";
      await page.goto(base.base + pre + path, { waitUntil: "load" });
      await settle(page);
      await page.evaluate((css) => {
        const st = document.createElement("style");
        st.textContent = css;
        document.head.append(st);
      }, ZOOM_CSS);
      await page.waitForTimeout(300);
      const r = await page.evaluate(probe, rootSel);
      if (r.broken.length) fail(tag, `words broken mid-word: ${r.broken.join(" | ")}`);
      if (r.clipped.length) fail(tag, `drawn past the screen edge: ${r.clipped.join(" | ")}`);
      if (r.scrollW > r.vw + 1) fail(tag, `page scrolls sideways (${r.scrollW} > ${r.vw})`);
      await shot(name);
    }

    {
      const tag = `browse ${lang} ${WIDTH} x${ZOOM}`;
      project = false;
      await page.goto(base.base + pre + "/blog", { waitUntil: "load" });
      await settle(page);
      await page.evaluate((css) => {
        const st = document.createElement("style");
        st.textContent = css;
        document.head.append(st);
      }, ZOOM_CSS);
      await page.waitForTimeout(300);
      await page.locator('button[aria-controls="nav-menu"]').click({ force: true });
      await page.waitForTimeout(500);
      await page.locator("#nav-menu [data-local-browse] button").click({ force: true });
      await page.waitForTimeout(800);
      const r = await page.evaluate(probe, "dialog[open]");
      if (!(await page.locator("dialog[open]").count())) fail(tag, "the Browse sheet did not open");
      if (r.broken.length) fail(tag, `words broken mid-word: ${r.broken.join(" | ")}`);
      if (r.clipped.length) fail(tag, `drawn past the screen edge: ${r.clipped.join(" | ")}`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/zoom.${lang}.browse.png`, timeout: 120000 });
    }
    await ctx.close();
  }),
);

await browser.close();
base.stop();
if (fails.length) {
  console.log(fails.sort().join("\n"));
  console.log(`\n${fails.length} problem(s).`);
  process.exit(1);
}
console.log("Phone zoom, 300% text: clean.");
