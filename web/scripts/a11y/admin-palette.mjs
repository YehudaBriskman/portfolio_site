#!/usr/bin/env node
/*
 * The admin command palette (Ctrl or Cmd + K, A32), measured in a real browser.
 *
 * At 390 and 1280, English and Hebrew, light and dark it exits 1 when:
 *   - the shortcut (1280) or the drawer's Search row (390) does not open a
 *     modal <dialog> holding a focused combobox, or Ctrl+K on a Hebrew key
 *     layout does not;
 *   - the box runs off the screen, the page scrolls sideways, or an option is
 *     under 44px tall;
 *   - nothing typed does not list Create then Go to, or a typed query finds no
 *     "Translations" page (the route list comes from adminNav.ts);
 *   - Down does not move aria-activedescendant, or Escape does not close it and
 *     give focus back to what had it;
 *   - Enter on a page opens that route;
 *   - at 1280 Ctrl+B still folds the sidebar with the palette closed.
 *
 *   npm run build && npm run a11y:admin-palette
 *   WIDTHS=1280  LANGS=he  THEMES=dark  SHOTS=dir  (SHOTS also writes the screenshots)
 * Waits poll on a timer, never rAF or animationend (headless Chromium here has ~1 rAF / 40 s).
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { NOW, answer, tint } from "./admin-fixtures.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const env = (n) => (process.env[n] ?? "").split(",").filter(Boolean);
const WIDTHS = (env("WIDTHS").length ? env("WIDTHS") : ["390", "1280"]).map(Number);
const LANGS = env("LANGS").length ? env("LANGS") : ["en", "he"];
const THEMES = env("THEMES").length ? env("THEMES") : ["light", "dark"];
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const WORDS = {
  en: { search: /^Search$/, translations: "Translations", create: "Create", go: "Go to" },
  he: { search: /^חיפוש$/, translations: "תרגומים", create: "יצירה", go: "מעבר אל" },
};

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });
const fails = [];
let n = 0;

async function ready(page) {
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? "") && !!document.querySelector(".a-side-nav a"); })) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}
const poll = (page, fn, arg) => page.waitForFunction(fn, arg, { polling: 500, timeout: 20000 });
const shot = (page, name, tag) => SHOTS && page.screenshot({ path: resolve(SHOTS, `${name}-${tag}.png`), timeout: 120000 });

const measure = () => {
  const d = document.querySelector("dialog[open]");
  if (!d) return null;
  const r = d.getBoundingClientRect();
  const box = document.querySelector("dialog[open] [role=combobox]");
  const opts = [...d.querySelectorAll("[role=option]")];
  return {
    modal: d.matches(":modal"),
    focused: document.activeElement === box,
    inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    short: opts.filter((o) => o.getBoundingClientRect().height < 44).length,
    count: opts.length,
    groups: [...d.querySelectorAll("[data-heading]")].map((h) => h.textContent),
    active: box?.getAttribute("aria-activedescendant") ?? null,
  };
};

for (const w of WIDTHS) for (const lang of LANGS) for (const theme of THEMES) {
  const tag = `${w}-${theme}-${lang}`;
  const at = (m) => `${m} @${w} ${theme} ${lang}`;
  const t = WORDS[lang];
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((th) => { try { localStorage.setItem("yb-theme", th); localStorage.removeItem("admin-palette-recent"); } catch { /* colorScheme carries it */ } }, theme);
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/api/images/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: tint });
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  const prefix = lang === "he" ? "/he" : "";
  try {
    await page.goto(`${base}${prefix}/admin/posts`, { waitUntil: "load" });
    await ready(page);

    /* ---- open: the shortcut where there is a keyboard, the drawer row on a phone */
    if (w >= 1024) {
      await page.locator("main").focus();
      await page.keyboard.press("Control+k");
    } else {
      await page.getByRole("button", { name: /^(Menu|תפריט)/ }).first().click({ force: true });
      await page.locator(".a-side-foot button.a-nav-item", { hasText: t.search }).click({ force: true });
    }
    await poll(page, () => !!document.querySelector("dialog[open] [role=combobox]")).catch(() => fails.push(at("palette did not open")));
    let m = await page.evaluate(measure);
    n++;
    if (!m) { fails.push(at("no open dialog")); await ctx.close(); continue; }
    if (!m.modal) fails.push(at("dialog is not modal"));
    if (!m.focused) fails.push(at("the combobox does not have focus on open"));
    if (!m.inView) fails.push(at("the box runs off the screen"));
    if (m.overflow) fails.push(at("page scrolls sideways"));
    if (m.short) fails.push(at(`${m.short} option(s) under 44px tall`));
    if (m.groups.join("|") !== `${t.create}|${t.go}`) fails.push(at(`groups are "${m.groups.join(" | ")}", not Create then Go to`));
    await shot(page, "palette-open", tag);

    /* ---- the keys */
    await page.keyboard.press("ArrowDown");
    const m2 = await page.evaluate(measure);
    if (!m2.active || m2.active === m.active) fails.push(at("ArrowDown did not move the active option"));
    await page.keyboard.type(t.translations.slice(0, 4));
    await poll(page, (name) => [...document.querySelectorAll("dialog[open] [role=option]")].some((o) => o.textContent.includes(name)), t.translations)
      .catch(() => fails.push(at(`typing "${t.translations.slice(0, 4)}" finds no ${t.translations}`)));
    await shot(page, "palette-query", tag);
    await page.keyboard.press("Escape");
    await poll(page, () => !document.querySelector("dialog[open]")).catch(() => fails.push(at("Escape did not close it")));
    const back = await page.evaluate(() => document.activeElement?.tagName);
    if (back === "BODY" && w >= 1024) fails.push(at("focus was not given back after Escape"));

    /* ---- Enter on a page opens its route, and Hebrew key layout still opens it */
    if (w >= 1024) {
      await page.keyboard.press("Control+k");
      await poll(page, () => !!document.querySelector("dialog[open] [role=combobox]"));
      await page.keyboard.type(t.translations.slice(0, 4));
      await page.keyboard.press("Enter");
      await poll(page, () => location.pathname.endsWith("/admin/translations")).catch(() => fails.push(at(`Enter on ${t.translations} stayed on ${new URL(page.url()).pathname}`)));
      await ready(page);
      await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ל", code: "KeyK", ctrlKey: true, bubbles: true, cancelable: true })));
      await poll(page, () => !!document.querySelector("dialog[open] [role=combobox]")).catch(() => fails.push(at("Ctrl+K on a Hebrew key layout did not open it")));
      await page.keyboard.press("Escape");
      await poll(page, () => !document.querySelector("dialog[open]"));
      const before = await page.evaluate(() => document.querySelector(".a-app")?.getAttribute("data-side"));
      await page.keyboard.press("Control+b");
      await poll(page, (b) => document.querySelector(".a-app")?.getAttribute("data-side") !== b, before).catch(() => fails.push(at("Ctrl+B no longer folds the sidebar")));
      await page.keyboard.press("Control+b");
    }
  } catch (e) { fails.push(at(`ERROR ${e.message.split("\n")[0]}`)); }
  await ctx.close();
}
await browser.close();
stop();
if (fails.length) { console.log(`FAIL: ${fails.length} finding(s)`); for (const f of fails.slice(0, 60)) console.log(" ", f); process.exit(1); }
console.log(`PASS: ${n} palette states: opens, focused, in view, 44px rows, keys, Escape returns focus, Enter routes, Ctrl+B intact.`);
