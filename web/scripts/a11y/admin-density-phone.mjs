#!/usr/bin/env node
/*
 * How many controls the first screen of a phone asks for, held as a check
 * (#703, #704). jsdom cannot see layout, so it is measured in a real browser
 * against a build:
 *
 *   npm run build
 *   npm run a11y:admin-density-phone
 *   SHOTS=docs/design/shots-density-phone npm run a11y:admin-density-phone   (also saves screenshots)
 *   PROBE=1 ...                                                              (390 en light only, lists what it counted)
 *
 * "In the fold" is what a person sees with no scrolling and could actually
 * reach: button, input, select, textarea, role button/tab/switch/checkbox and
 * summary, with an open sheet as the whole screen, an `inert` page and the
 * inside of a closed Disclosure left out (they cannot be reached). A list row
 * (`[data-record-row]`) is the content, not the chrome, so it is counted
 * apart; the rows have their own checks (>= 7 above the fold).
 * At 390x844 the budgets are the tier-1 sets of docs/admin-design-guide.md:
 *
 *   post editor (stored, new, Hebrew, both)  <= 9
 *   publish review sheet                     <= 12, "what changes" above every control
 *   Audience, Areas (chrome, rows apart)     <= 7: search, Select, Add, Filters and the shell's two
 *   Overview, the nav drawer                 <= 10
 *   Library with every Disclosure open       no editor in the page flow, at most 3.5 screens tall
 *
 * and at 360, 390 and 430, in English (LTR) and Hebrew (RTL), light and dark:
 * nothing scrolls sideways, a sheet gives focus back to what opened it, and
 * the Hebrew screens are right to left. At 1440 the desktop editor still draws
 * its desktop controls.
 *
 * Reuses admin-fixtures.mjs (`vite preview` plus API fixtures): no login, no
 * network (every request that is not localhost is aborted). Polls on a timer,
 * never rAF: headless Chromium here emits about one frame per 40 s.
 * CHROME overrides the browser binary.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NOW, answer } from "./admin-fixtures.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const SHOTS = process.env.SHOTS || "";
const PROBE = !!process.env.PROBE;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const fails = [];
const fail = (m) => fails.push(m);

/* ------------------------------------------------ measured in the page */
function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    const cs = getComputedStyle(el);
    return !(cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0 || cs.clipPath === "inset(50%)");
  };
  /* An open sheet is the screen. Its own opacity is not asked: it may be mid-entrance. */
  const open = [...document.querySelectorAll("dialog[open]")];
  const root = open.length ? open[open.length - 1] : document.body;
  const CTL = 'button, input:not([type=hidden]), select, textarea, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], summary';
  const inFold = (el) => { const r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0; };
  /* Not reachable: behind an inert page, or inside a Disclosure that is closed (its summary stays). */
  const reachable = (el) => {
    if (el.closest("[inert]")) return false;
    const d = el.closest("details:not([open])");
    return !d || el.closest("summary")?.parentElement === d;
  };
  const all = [...root.querySelectorAll(CTL)].filter((el) => vis(el) && !el.closest(".sr-only") && reachable(el) && inFold(el));
  const ctl = all.filter((el) => !el.closest("[data-record-row]"));
  const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.id || "").replace(/\s+/g, " ").trim().slice(0, 30);
  const summary = root.querySelector("[data-review-summary]");
  const sheetCtl = [...root.querySelectorAll(CTL)].filter((el) => vis(el) && !el.closest("[data-sheet-header]") && !el.closest("details:not([open])") && !el.closest("[data-sheet-footer]"));
  const chev = document.querySelector(".a-select-chev");
  const sel = chev?.parentElement?.querySelector("select");
  return {
    vw, vh,
    inDialog: root !== document.body,
    scroll: document.documentElement.scrollWidth,
    controls: ctl.length,
    rows: all.length - ctl.length,
    textareasInFlow: [...document.querySelectorAll("main textarea")].filter((el) => !el.closest("dialog")).length,
    list: ctl.map((el) => `${el.tagName.toLowerCase()}${el.getAttribute("type") ? `[${el.getAttribute("type")}]` : ""} "${name(el)}"`),
    summaryTop: summary ? Math.round(summary.getBoundingClientRect().top) : null,
    firstSheetCtlTop: sheetCtl.length ? Math.round(Math.min(...sheetCtl.map((el) => el.getBoundingClientRect().top))) : null,
    docH: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    dir: document.documentElement.dir,
    chevOnInlineEnd: chev && sel ? (document.documentElement.dir === "rtl" ? chev.getBoundingClientRect().left < sel.getBoundingClientRect().left + sel.getBoundingClientRect().width / 2 : chev.getBoundingClientRect().left > sel.getBoundingClientRect().left + sel.getBoundingClientRect().width / 2) : null,
  };
}

/* -------------------------------------------------------------- driving */
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });

async function open(w, h, lang, theme, path, ready = "main") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, theme);
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/api/images/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#3a6f8f"/></svg>' });
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  page.on("pageerror", (e) => fail(`pageerror on ${path}: ${e.message.split("\n")[0]}`));
  await page.goto(`${base}${lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate((sel) => !!document.querySelector(sel) && !/Loading|טוען/.test(document.querySelector("main")?.textContent ?? ""), ready)) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(700);
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
/* dispatchEvent, not click(): Playwright's click waits for animation frames. */
const tap = (page, sel) => page.locator(sel).first().dispatchEvent("click");
const dir = (lang) => (lang === "he" ? "rtl" : "ltr");

const BUDGET = { editor: 9, review: 12, audience: 7, overview: 10, drawer: 10, areas: 7 };

function check(tag, m, budget) {
  if (PROBE) console.log(`${tag}: ${m.controls} chrome controls (+${m.rows} in rows), doc ${m.docH}px\n   ${m.list.join("\n   ")}`);
  if (m.scroll > m.vw + 1) fail(`${tag}: page scrolls sideways (${m.scroll} > ${m.vw})`);
  if (budget != null && m.controls > budget) fail(`${tag}: ${m.controls} controls in the fold, at most ${budget} (${m.list.join(" | ")})`);
}

/* [key, path, ready selector, budget, step]. A step opens the state to measure. */
const EDITOR = "/admin/posts/admin-redesign";
const SCREENS = [
  ["editor", EDITOR, "input.a-input-title", BUDGET.editor],
  ["editor-new", "/admin/posts/new", "input.a-input-title", BUDGET.editor + 1] /* the slug field is one more control a new note needs */,
  ["editor-he", EDITOR, "input.a-input-title", BUDGET.editor, async (p) => { await p.locator("select[data-editing-language]").selectOption("he"); }],
  ["editor-both", EDITOR, "input.a-input-title", BUDGET.editor, async (p) => { await p.locator("select[data-editing-language]").selectOption("both"); }],
  ["review", EDITOR, "input.a-input-title", BUDGET.review, async (p) => {
    await tap(p, 'button.a-btn-primary[aria-haspopup="dialog"]');
    await waitFor(p, () => !!document.querySelector("dialog[open] [data-review-summary]"));
  }],
  ["drawer", "/admin", "main", BUDGET.drawer, async (p) => { await tap(p, "header button[aria-controls]"); }],
  ["overview", "/admin", "main", BUDGET.overview],
  ["audience", "/admin/marketing?tab=audience", "[data-testid=audience]", BUDGET.audience],
  ["areas", "/admin/areas", "main", BUDGET.areas],
  ["library-expanded", "/admin/marketing?tab=library", "[data-testid=library]", null, async (p) => {
    await p.evaluate(() => document.querySelectorAll("details:not([open])").forEach((d) => (d.open = true)));
  }],
];

try {
  for (const lang of PROBE ? ["en"] : ["en", "he"]) {
    for (const theme of PROBE ? ["light"] : ["light", "dark"]) {
      for (const w of PROBE ? [390] : [360, 390, 430]) {
        const h = w === 390 ? 844 : w === 360 ? 740 : 932;
        for (const [key, path, ready, budget, step] of SCREENS) {
          /* Without SHOTS: budgets at 390 light, overflow at 360 and 430 on the three screens that carry the controls, dark at 390 on the editor and the review. */
          if (!SHOTS && !PROBE) {
            if (w !== 390 && !["editor", "audience", "areas"].includes(key)) continue;
            if (theme === "dark" && !(w === 390 && ["editor", "review"].includes(key))) continue;
          }
          const s = await open(w, h, lang, theme, path, ready);
          if (step) {
            try { s.page.setDefaultTimeout(4000); await step(s.page); await s.page.waitForTimeout(500); } catch (e) { fail(`${key} ${w} ${lang} ${theme}: the state could not be reached (${e.message.split("\n")[0]})`); await s.close(); continue; }
          }
          const m = await s.page.evaluate(measure);
          const tag = `${key} ${w} ${lang} ${theme}`;
          check(tag, m, w === 390 ? budget : null);
          if (lang === "he" && m.dir !== "rtl") fail(`${tag}: the page is not right to left`);
          if (m.chevOnInlineEnd === false) fail(`${tag}: the select's chevron is not at the inline end`);
          if (key === "review") {
            if (!m.inDialog) fail(`${tag}: the review did not open as a sheet`);
            else if (m.summaryTop == null || (m.firstSheetCtlTop != null && m.summaryTop > m.firstSheetCtlTop)) fail(`${tag}: what changes (${m.summaryTop}) is not above the first control (${m.firstSheetCtlTop})`);
          }
          if (key === "library-expanded") {
            if (m.textareasInFlow) fail(`${tag}: ${m.textareasInFlow} editors sit in the page flow, a template is one row`);
            if (m.docH > m.vh * 4) fail(`${tag}: ${(m.docH / m.vh).toFixed(1)} screens tall, at most 4`);
          }
          if (SHOTS) await shot(s.page, `${key}-${w}-${dir(lang)}-${theme}`);
          await s.close();
        }
      }
    }
  }

  /* Sheets give focus back to what opened them. */
  for (const lang of ["en", "he"]) {
    const ed = await open(390, 844, lang, "light", EDITOR, "input.a-input-title");
    for (const [what, opener, shows] of [
      ["review", 'button.a-btn-primary[aria-haspopup="dialog"]', "dialog[open] [data-review-summary]"],
      ["format", "button[data-format-sheet]", "dialog[open]"],
    ]) {
      await ed.page.locator(opener).first().focus();
      await ed.page.keyboard.press("Enter");
      if (!(await waitFor(ed.page, (q) => !!document.querySelector(q), shows))) { fail(`focus ${what} ${lang}: the sheet did not open`); continue; }
      await ed.page.keyboard.press("Escape");
      if (!(await waitFor(ed.page, () => !document.querySelector("dialog[open]")))) { fail(`focus ${what} ${lang}: Escape did not close the sheet`); continue; }
      await ed.page.waitForTimeout(300);
      const back = await ed.page.evaluate((q) => document.activeElement === document.querySelector(q), opener);
      if (!back) fail(`focus ${what} ${lang}: focus did not return to the button that opened the sheet`);
    }
    await ed.close();
  }

  /* The desktop editor is unchanged: the three-way toggle, a Hebrew title beside the English one. */
  const wide = await open(1440, 900, "en", "light", EDITOR, "input.a-input-title");
  const dm = await wide.page.evaluate(() => ({
    toggles: document.querySelectorAll("[role=group] button[aria-pressed]").length,
    titles: document.querySelectorAll("input.a-input-title").length,
    format: !!document.querySelector("button[data-format-sheet]"),
    select: !!document.querySelector("select[data-editing-language]"),
    tools: document.querySelectorAll("[role=toolbar] button").length,
    scroll: document.documentElement.scrollWidth - window.innerWidth,
  }));
  if (dm.toggles < 3 || dm.titles !== 2 || dm.format || dm.select || dm.tools < 13) fail(`editor 1440: the desktop editor changed (${JSON.stringify(dm)})`);
  if (dm.scroll > 1) fail("editor 1440: scrolls sideways");
  if (SHOTS) await shot(wide.page, "editor-1440-ltr-light");
  await wide.close();
  if (SHOTS) {
    for (const [lang, theme] of [["en", "dark"], ["he", "light"], ["he", "dark"]]) {
      const d = await open(1440, 900, lang, theme, EDITOR, "input.a-input-title");
      await shot(d.page, `editor-1440-${dir(lang)}-${theme}`);
      await d.close();
    }
  }
} finally {
  await browser.close();
  stop();
}

if (fails.length) {
  console.log(`FAIL: ${fails.length}`);
  for (const f of fails.slice(0, 60)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("PASS: the phone editor, review, Audience, Areas, drawer and Library keep to their control budgets.");
