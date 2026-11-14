#!/usr/bin/env node
/*
 * Four admin screens on a phone, held as a check (#682): Overview,
 * Connected apps, Translations and Settings. jsdom cannot see layout, so the
 * sizes are measured in a real browser against a build:
 *
 *   npm run build
 *   npm run a11y:admin-phone-screens
 *   SHOTS=/tmp/shots npm run a11y:admin-phone-screens   (also saves screenshots + density.json)
 *
 * At 360, 390 and 430 wide, in English (LTR) and Hebrew (RTL), light and dark:
 *  - nothing scrolls sideways;
 *  - a phone row is one button (no other control in its item), prints at most
 *    two text facts, is at least 56px high and does not overflow;
 *  - Overview opens on "needs you" rows; Connections, Translations and
 *    Settings show their rows/groups, and Settings keeps its save history in a
 *    closed section of compact rows (never seven cards);
 *  - a Connections row opens a sheet, Escape closes it and focus returns;
 *  - at 1440 the desktop screens are unchanged (no phone rows).
 * With SHOTS set it also renders each screen's DESKTOP layout at 390 (the
 * phone media query forced off) so the density numbers have a "before".
 *
 * Reuses site-stub.mjs (`vite preview` plus API fixtures): no login, no
 * network. Polls on a timer, never rAF: headless Chromium here emits about one
 * frame per 40 s. CHROME overrides the browser binary.
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

const NOW = Date.now();
const ago = (h) => new Date(NOW - h * 3_600_000).toISOString();
const ahead = (h) => new Date(NOW + h * 3_600_000).toISOString();

const GRANT = (id, client, status, o = {}) => ({
  id, client, scopes: o.scopes ?? ["mcp:read"], login: "owner", createdAt: ago(900), lastUsedAt: o.last === undefined ? ago(3) : o.last,
  expiresAt: status === "expired" ? ago(40) : ahead(500), revokedAt: status === "revoked" ? ago(60) : null, revokedReason: status === "revoked" ? "Revoked by the owner" : null, status,
});
const GRANTS = [
  GRANT("g1", "Claude Code", "active", { scopes: ["mcp:read", "mcp:write"] }),
  GRANT("g2", "A client with a deliberately long name that has to wrap", "active", { last: null }),
  GRANT("g3", "Cursor", "revoked"),
  GRANT("g4", "Old laptop", "expired"),
];
const CAMPAIGNS = [{ id: "c1", name: "November note", status: "failed", counters: { sent: 10, failed: 3, skipped: 0 }, createdAt: ago(30), updatedAt: ago(2) }];
const INBOX = { ok: true, unread: 2, items: [] };

const SETTINGS = (() => {
  const base = structuredClone(baseAnswer("http://x/api/admin/settings", false).body);
  const mk = (v) => {
    const s = structuredClone(base.settings);
    s.visuals.accent = v % 2 ? "pine" : "ink";
    s.home.sections[v % 5].visible = false;
    return s;
  };
  base.version = 7;
  base._rev = "7-fixture";
  base.history = [6, 5, 4, 3, 2, 1].map((v) => ({ version: v, at: ago(v * 20), settings: mk(v) })).concat([{ version: 0, at: ago(200), settings: base.settings }]);
  return base;
})();

function answer(path, method, search) {
  const p = path.replace(/^\/api/, "");
  if (method !== "GET") return { status: 503, body: { error: "This check does not save." } };
  if (p === "/admin/mcp/grants") return { body: { ok: true, items: GRANTS } };
  if (p === "/admin/campaigns") return { body: { ok: true, campaigns: CAMPAIGNS } };
  if (p === "/admin/announce") return { body: INBOX };
  if (p === "/admin/settings") return { body: SETTINGS };
  const b = baseAnswer(`http://x${path}${search}`, false);
  return { status: b.status, body: b.body };
}

const SCREENS = [
  { id: "overview", path: "/admin", ready: "[data-testid=overview-phone], [data-record-row]", rows: (n) => n >= 2 },
  { id: "connections", path: "/admin/connections", ready: "[data-record-row]", rows: (n) => n === GRANTS.length },
  { id: "translations", path: "/admin/translations", ready: "[data-record-row]", rows: (n) => n === 4 },
  { id: "settings", path: "/admin/settings", ready: "[data-settings-group]", rows: (n) => n === 0 },
];

const fails = [];
const fail = (m) => fails.push(m);
const density = [];

function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rows = [...document.querySelectorAll("[data-record-row]")];
  const item = (r) => r.closest("li") ?? r.parentElement;
  const factsOf = (r) => [...r.querySelectorAll(".rr-fact")].filter((f) => f.getBoundingClientRect().width > 2).length;
  return {
    vw,
    scroll: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    vh,
    rows: rows.length,
    groups: document.querySelectorAll("[data-settings-group]").length,
    cards: document.querySelectorAll("main .a-card").length,
    perRow: rows.map((r) => ({
      title: (r.getAttribute("aria-label") || "").slice(0, 40),
      buttons: item(r).querySelectorAll("button, a, input, select, textarea").length,
      facts: factsOf(r),
      overflow: r.scrollWidth - r.clientWidth,
      h: Math.round(r.getBoundingClientRect().height),
    })),
    historyOpen: document.querySelector("[data-testid=settings-history]")?.open ?? null,
  };
}

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });

async function open(w, h, lang, theme, screen, { before = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, theme);
  if (before) {
    /* The desktop layout at phone width: the phone media query answers no. */
    await ctx.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) => (/max-width:\s*599px/.test(q) ? { ...real("(min-width: 99999px)"), media: q } : real(q));
    });
  }
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.goto(`${base}${lang === "he" ? "/he" : ""}${screen.path}`, { waitUntil: "load" });
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate((sel) => !!document.querySelector(sel) || !!document.querySelector("main table, main form"), screen.ready)) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
  return { page, close: () => ctx.close() };
}
async function shot(page, name, full = false) {
  const cdp = await page.context().newCDPSession(page);
  const params = { format: "png" };
  if (full) {
    const { cssContentSize } = await cdp.send("Page.getLayoutMetrics");
    params.captureBeyondViewport = true;
    params.clip = { x: 0, y: 0, width: cssContentSize.width, height: Math.min(cssContentSize.height, 6000), scale: 1 };
  }
  const { data } = await cdp.send("Page.captureScreenshot", params);
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

try {
  for (const screen of SCREENS) {
    for (const lang of ["en", "he"]) {
      for (const theme of ["light", "dark"]) {
        for (const w of [360, 390, 430]) {
          if (theme === "dark" && w !== 390 && !SHOTS) continue;
          if (lang === "he" && theme === "dark" && w !== 390 && !SHOTS) continue;
          const tag = `${screen.id} ${w} ${lang} ${theme}`;
          const { page, close } = await open(w, w === 390 ? 844 : 800, lang, theme, screen);
          if (screen.id === "settings") {
            /* The history is a closed section; open it so its rows are measured too. */
            await page.evaluate(() => { const d = document.querySelector("[data-testid=settings-history]"); if (d) d.open = true; });
            await page.waitForTimeout(300);
          }
          const m = await page.evaluate(measure);
          if (m.scroll > m.vw + 1) fail(`${tag}: page scrolls sideways (${m.scroll} > ${m.vw})`);
          if (!screen.rows(screen.id === "settings" ? 0 : m.rows) && screen.id !== "settings") fail(`${tag}: ${m.rows} phone rows`);
          m.perRow.forEach((r, i) => {
            if (r.buttons !== 1) fail(`${tag} row ${i} "${r.title}": ${r.buttons} controls in the item, expected exactly 1`);
            if (r.facts > 2) fail(`${tag} row ${i}: ${r.facts} text facts, at most 2`);
            if (r.overflow > 1) fail(`${tag} row ${i}: overflows by ${r.overflow}px`);
            if (r.h < 56) fail(`${tag} row ${i}: ${r.h}px high, needs at least 56`);
          });
          if (screen.id === "settings") {
            if (m.groups !== 5) fail(`${tag}: ${m.groups} setting groups, expected 5`);
            if (m.rows !== 8) fail(`${tag}: ${m.rows} history rows, expected 8 (the live version and 7 saved)`);
            if (m.cards > 0) fail(`${tag}: ${m.cards} full cards on the phone page`);
          }
          if (w === 390 && lang === "en" && theme === "light") density.push({ screen: screen.id, state: "after", heightVh: +(m.height / m.vh).toFixed(2), rows: m.rows, cards: m.cards });
          if (SHOTS) await shot(page, `${screen.id}-${w}-${lang === "he" ? "rtl" : "ltr"}-${theme}`, w === 390);

          if (screen.id === "connections" && theme === "light" && w !== 430) {
            await page.evaluate(() => document.querySelector("[data-record-row]")?.focus());
            await page.locator("[data-record-row]").first().dispatchEvent("click");
            if (!(await waitFor(page, () => !!document.querySelector("dialog[open]")))) fail(`${tag}: tapping a row did not open the sheet`);
            else {
              if ((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) > 1) fail(`${tag}: the open sheet makes the page scroll sideways`);
              if (SHOTS) await shot(page, `connections-sheet-${w}-${lang === "he" ? "rtl" : "ltr"}-${theme}`);
              await page.keyboard.press("Escape");
              if (!(await waitFor(page, () => !document.querySelector("dialog[open]")))) fail(`${tag}: Escape did not close the sheet`);
              else if (!(await waitFor(page, () => document.activeElement === document.querySelector("[data-record-row]"), undefined, 12))) fail(`${tag}: focus did not return to the row`);
            }
          }
          await close();
        }
      }
    }
  }

  /* Before: the desktop layout at 390, for the density numbers. */
  for (const screen of SCREENS) {
    const { page, close } = await open(390, 844, "en", "light", screen, { before: true });
    const m = await page.evaluate(measure);
    density.push({ screen: screen.id, state: "before", heightVh: +(m.height / m.vh).toFixed(2), rows: m.rows, cards: m.cards });
    if (SHOTS) await shot(page, `${screen.id}-before-390-ltr-light`, true);
    await close();
  }

  /* Desktop is unchanged. */
  for (const screen of SCREENS) {
    const wide = await open(1440, 900, "en", "light", screen);
    const wm = await wide.page.evaluate(measure);
    if (wm.rows !== 0 || wm.groups !== 0) fail(`${screen.id} 1440: phone rows or groups on a desktop screen`);
    if (SHOTS) await shot(wide.page, `${screen.id}-1440-ltr-light`);
    await wide.close();
  }
  if (SHOTS) {
    for (const screen of SCREENS) {
      for (const [lang, theme] of [["en", "dark"], ["he", "light"], ["he", "dark"]]) {
        const d = await open(1440, 900, lang, theme, screen);
        await shot(d.page, `${screen.id}-1440-${lang === "he" ? "rtl" : "ltr"}-${theme}`);
        await d.close();
      }
    }
    writeFileSync(`${SHOTS}/density.json`, JSON.stringify(density, null, 2));
  }
} finally {
  await browser.close();
  stop();
}

console.log(density.map((d) => `${d.screen} ${d.state}: ${d.heightVh} viewport-heights, ${d.rows} rows, ${d.cards} cards`).join("\n"));
if (fails.length) {
  console.log(`FAIL: ${fails.length}`);
  for (const f of fails.slice(0, 60)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("PASS: the four admin screens are rows and groups on a phone, fit the width, and leave the desktop alone.");
