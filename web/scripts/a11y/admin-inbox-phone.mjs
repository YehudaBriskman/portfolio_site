#!/usr/bin/env node
/*
 * The Marketing Inbox on a phone, held as a check (#670). jsdom cannot see
 * layout, so the sizes are measured in a real browser against a build:
 *
 *   npm run build
 *   npm run a11y:admin-inbox-phone
 *   SHOTS=/tmp/inbox-shots npm run a11y:admin-inbox-phone     (also saves screenshots)
 *
 * At 360, 390 and 430 wide, in English (LTR) and Hebrew (RTL), light and dark:
 *  - one row is one button: no other button, link or field inside its item;
 *  - a row prints at most three text facts (title, time and, at most, one more)
 *    and four named channel glyphs, and no "Ready" and no "Copy" in the list;
 *  - at least 7 rows sit above the fold of a 390x844 screen (the whole page is
 *    measured, header, tabs and the New announcement button included);
 *  - nothing scrolls sideways, even with a 60-character title at 320;
 *  - tapping a row opens the sheet, Escape closes it and focus is back on the
 *    row; Mark done offers Undo and Undo puts the button back;
 *  - Hebrew mirrors: the chevron sits at the left end of the row, the new dot at
 *    the right;
 *  - at 1440 wide the desktop list is unchanged (Copy buttons, no phone rows).
 *
 * Reuses site-stub.mjs (`vite preview` plus API fixtures): no login, no
 * network (every request that is not localhost is aborted). Polls on a timer,
 * never rAF: headless Chromium here emits about one frame per 40 s.
 * CHROME overrides the browser binary.
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
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const ago = (h) => new Date(NOW - h * 3_600_000).toISOString();
const EVT = (id, kind, title, h, o = {}) => ({ id, kind, ref: id, title, url: `https://example.com/${id}`, langs: ["en", "he"], createdAt: ago(h), readAt: o.read === false ? null : ago(h - 1), done: o.done ?? {}, dismissed: null });
const LONG60 = "A deliberately long title of sixty characters, no breaks ok";
const INBOX = [
  EVT("post:a", "post", "Rebuilding the admin as a tool with a deliberately long title that has to wrap on a phone", 2, { read: false }),
  EVT("release:b", "release", "Bothy v1.9.0", 20, { done: { linkedin: ago(5) } }),
  EVT("post:c", "post", "The theme change, as a wave", 60),
  EVT("custom:d", "custom", "A hand-made announcement", 90, { done: { linkedin: ago(80), x: ago(80), email: ago(80) } }),
  EVT("post:e", "post", "Hebrew, right to left, all the way down", 120, { read: false }),
  EVT("post:f", "post", "A settings page that remembers", 150),
  EVT("release:g", "release", "Bothy v1.8.2", 190, { done: { linkedin: ago(150), instagram: ago(150) } }),
  EVT("post:h", "post", "Notes on a box under the desk", 230),
  EVT("post:i", "post", LONG60, 260),
  EVT("post:j", "post", "Backups, and the day I tested one", 300),
  EVT("project:k", "project", "WindoM", 340),
  EVT("post:l", "post", "Why there is no dashboard", 400),
];
const KIT_ITEM = (t, limit) => ({ text: t, subject: "Subject line", limit, length: t.length, over: limit != null && t.length > limit });
const KIT = {
  en: { linkedin: KIT_ITEM("A new note is up: Rebuilding the admin. https://example.com/post-a #design", 3000), x: KIT_ITEM("New note: Rebuilding the admin https://example.com/post-a", 280), email: KIT_ITEM("Hello,\n\nA new note is up.", null), instagram: KIT_ITEM("A new note is up.", 2200) },
  he: { linkedin: KIT_ITEM("נוספה רשומה חדשה: בניית הניהול מחדש", 3000) },
};

const posted = [];
function answer(path, method, search) {
  const p = path.replace(/^\/api/, "");
  if (method === "POST" && /\/announce\/[^/]+\/(done|read)$/.test(p)) {
    posted.push(p);
    return { body: { ok: true, event: { ...INBOX[0], readAt: ago(1), done: p.endsWith("/done") ? { linkedin: ago(0) } : {} } } };
  }
  if (method !== "GET") return { status: 503, body: { error: "This check does not save." } };
  if (p === "/admin/announce") return { body: { ok: true, unread: 2, items: INBOX } };
  if (/^\/admin\/announce\/[^/]+\/preview$/.test(p)) {
    const long = /post%3Ac|post:c/.test(p);
    return { body: { ok: true, title: "T", description: "d", image: "", imageWidth: null, imageHeight: null, siteName: "S", url: "https://example.com/post-a", lang: "en", issues: long ? [{ code: "description-long", field: "description", severity: "warn" }] : [] } };
  }
  if (/^\/admin\/announce\/[^/]+$/.test(p)) return { body: { ok: true, siteOrigin: "https://example.com", event: { ...INBOX[0], summary: "A summary.", tags: [], version: null, custom: null }, kit: KIT } };
  const b = baseAnswer(`http://x${path}${search}`, false);
  return { status: b.status, body: b.body };
}

const fails = [];
const fail = (m) => fails.push(m);

/* ------------------------------------------------ measured in the page */
function measureList() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rows = [...document.querySelectorAll("[data-record-row]")];
  const clipped = (el) => { const r = el.getBoundingClientRect(); return r.width <= 2 || r.height <= 2; };
  const facts = (row) => {
    const out = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? "").trim();
      if (!t) continue;
      let el = n.parentElement;
      let hidden = false;
      for (; el && el !== row.parentElement; el = el.parentElement) {
        if (el.getAttribute("aria-hidden") === "true" || clipped(el)) { hidden = true; break; }
      }
      if (!hidden) out.push(t);
    }
    return out;
  };
  const item = (row) => row.closest("li") ?? row.parentElement;
  return {
    vw,
    scroll: document.documentElement.scrollWidth,
    rows: rows.length,
    cutFacts: rows.flatMap((r) => [...r.querySelectorAll(".rr-fact bdi")]).filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
    firstTop: Math.round(rows[0]?.getBoundingClientRect().top ?? -1),
    inFold: rows.filter((r) => r.getBoundingClientRect().bottom <= vh + 0.5).length,
    perRow: rows.map((r) => ({
      title: (r.getAttribute("aria-label") || "").slice(0, 40),
      buttons: item(r).querySelectorAll("button, a, input, select, textarea").length,
      facts: facts(r),
      glyphs: [...r.querySelectorAll("[data-channel]")].map((g) => g.getAttribute("data-channel") + ":" + g.getAttribute("aria-label")),
      overflow: r.scrollWidth - r.clientWidth,
      h: Math.round(r.getBoundingClientRect().height),
    })),
    listText: (document.querySelector("main")?.textContent ?? ""),
    copyButtons: [...document.querySelectorAll("main button")].filter((b) => /^(Copy|העתק)/.test((b.textContent ?? "").trim())).length,
    legacyCopy: document.querySelectorAll(".mk-quick").length,
    hint: !!document.querySelector(".mk-keys") && getComputedStyle(document.querySelector(".mk-keys")).display !== "none",
  };
}
function measureMirror() {
  const row = document.querySelector("[data-record-row]");
  const chev = row.querySelector("[data-rr-chevron]").getBoundingClientRect();
  const title = row.querySelector("[data-rr-title]").getBoundingClientRect();
  const dot = document.querySelector("[data-rr-unread]")?.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  return { chevLeftOfTitle: chev.right <= title.left + 1, dotAtRight: dot ? dot.left > r.left + r.width / 2 : null };
}

/* -------------------------------------------------------------- driving */
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });

async function open(w, h, lang, theme = "light", path = "/admin/marketing") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, theme);
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.goto(`${base}${lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => !!document.querySelector("[data-record-row], .mk-row") )) break;
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
/* dispatchEvent, not click(): Playwright's click waits for animation frames. */
const tap = (page, sel) => page.locator(sel).first().dispatchEvent("click");

try {
  for (const lang of ["en", "he"]) {
    for (const theme of ["light", "dark"]) {
      for (const w of [360, 390, 430]) {
        if (theme === "dark" && w === 360) continue;
        const h = w === 390 ? 844 : 800;
        const tag = `inbox ${w} ${lang} ${theme}`;
        const { page, close } = await open(w, h, lang, theme);
        const m = await page.evaluate(measureList);
        if (m.scroll > m.vw + 1) fail(`${tag}: page scrolls sideways (${m.scroll} > ${m.vw})`);
        if (m.rows !== INBOX.length) fail(`${tag}: ${m.rows} phone rows, expected ${INBOX.length}`);
        m.perRow.forEach((r, i) => {
          if (r.buttons !== 1) fail(`${tag} row ${i}: ${r.buttons} controls in the item, expected exactly 1`);
          if (r.facts.length > 3) fail(`${tag} row ${i}: ${r.facts.length} text facts (${r.facts.join(" | ")}), at most 3`);
          if (r.glyphs.length !== 4) fail(`${tag} row ${i}: ${r.glyphs.length} channel glyphs, expected 4`);
          if (r.glyphs.some((g) => !/posted|פורסם/.test(g))) fail(`${tag} row ${i}: a channel glyph has no posted/not-posted name`);
          if (r.overflow > 1) fail(`${tag} row ${i}: row overflows by ${r.overflow}px`);
          if (r.h < 56) fail(`${tag} row ${i}: ${r.h}px high, needs at least 56`);
        });
        if (m.cutFacts.length) fail(`${tag}: the time is cut off in ${m.cutFacts.length} rows (${m.cutFacts.slice(0, 2).join(", ")})`);
        if (m.copyButtons || m.legacyCopy) fail(`${tag}: Copy buttons are still in the list`);
        if (/\bReady\b|^מוכן/.test(m.listText)) fail(`${tag}: the list still prints "Ready"`);
        if (m.hint) fail(`${tag}: the keyboard hint is visible on a touch screen`);
        if (w === 390 && m.inFold < 7) fail(`${tag}: ${m.inFold} rows above the fold of 844px (first row starts at ${m.firstTop}px, rows ${m.perRow.map((r) => r.h).join("/")}px), needs at least 7`);
        if (SHOTS) await shot(page, `${w}-${lang === "he" ? "rtl" : "ltr"}-${theme}-list`);

        if (lang === "he" && m.rows > 0) {
          const mir = await page.evaluate(measureMirror);
          if (!mir.chevLeftOfTitle) fail(`${tag}: the chevron is not at the left end of the row`);
          if (mir.dotAtRight === false) fail(`${tag}: the new dot is not at the right end of the row`);
        }

        if (theme === "light" && w !== 430 && m.rows > 0) {
          /* The sheet: tap, Mark done and Undo, Escape and focus back. */
          await page.evaluate(() => document.querySelector("[data-record-row]")?.focus());
          await tap(page, "[data-record-row]");
          if (!(await waitFor(page, () => !!document.querySelector("dialog[open]")))) fail(`${tag}: tapping a row did not open the sheet`);
          else {
            await waitFor(page, () => !!document.querySelector("dialog[open] textarea"));
            const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            if (sw > 1) fail(`${tag}: the open sheet makes the page scroll sideways`);
            if (SHOTS) await shot(page, `${w}-${lang === "he" ? "rtl" : "ltr"}-${theme}-half`);
            if (await waitFor(page, () => [...document.querySelectorAll("dialog[open] button")].some((b) => /^(Mark as done|סימון כבוצע)/.test((b.textContent ?? "").trim())))) {
              await page.evaluate(() => [...document.querySelectorAll("dialog[open] button")].find((b) => /^(Mark as done|סימון כבוצע)/.test((b.textContent ?? "").trim()))?.click());
              const undo = await waitFor(page, () => [...document.querySelectorAll("dialog[open] button")].some((b) => /^(Undo|ביטול)$/.test((b.textContent ?? "").trim())));
              if (!undo) fail(`${tag}: Mark done offered no Undo`);
              else {
                await page.evaluate(() => [...document.querySelectorAll("dialog[open] button")].find((b) => /^(Undo|ביטול)$/.test((b.textContent ?? "").trim()))?.click());
                if (!(await waitFor(page, () => !![...document.querySelectorAll("dialog[open] button")].find((b) => /^(Mark as done|סימון כבוצע)/.test((b.textContent ?? "").trim()))))) fail(`${tag}: Undo did not bring Mark done back`);
              }
            } else fail(`${tag}: no Mark done button in the sheet`);
            if (SHOTS && w === 390) {
              await page.evaluate(() => document.querySelector("dialog[open] [data-sheet-header] button")?.click());
              await page.waitForTimeout(500);
              await shot(page, `${w}-${lang === "he" ? "rtl" : "ltr"}-${theme}-full`);
            }
            await page.keyboard.press("Escape");
            if (!(await waitFor(page, () => !document.querySelector("dialog[open]")))) fail(`${tag}: Escape did not close the sheet`);
            else if (!(await waitFor(page, () => document.activeElement === document.querySelector("[data-record-row]"), undefined, 12))) fail(`${tag}: focus did not return to the row`);
          }
        }
        await close();
      }
    }
  }

  /* A 60-character title at the smallest phone. */
  const small = await open(320, 568, "en");
  const sm = await small.page.evaluate(measureList);
  if (sm.scroll > sm.vw + 1) fail(`inbox 320: page scrolls sideways (${sm.scroll} > ${sm.vw})`);
  sm.perRow.forEach((r, i) => r.overflow > 1 && fail(`inbox 320 row ${i}: overflows by ${r.overflow}px`));
  await small.close();

  /* Desktop is unchanged. */
  const wide = await open(1440, 900, "en");
  const wm = await wide.page.evaluate(measureList);
  if (wm.rows !== 0) fail("inbox 1440: phone rows on a desktop screen");
  if (wm.legacyCopy !== INBOX.length) fail(`inbox 1440: ${wm.legacyCopy} quick-copy groups, expected ${INBOX.length}`);
  if (SHOTS) await shot(wide.page, `1440-ltr-light-list`);
  await wide.close();
} finally {
  await browser.close();
  stop();
}

if (fails.length) {
  console.log(`FAIL: ${fails.length}`);
  for (const f of fails.slice(0, 60)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("PASS: the phone Inbox is one tappable row per event, fits 7 rows, opens a sheet and mirrors in Hebrew.");
