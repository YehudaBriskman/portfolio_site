#!/usr/bin/env node
/*
 * The desktop admin sidebar, measured in a real browser (#809).
 *
 * It exits 1 when, at 1280 and 1440, English and Hebrew, light and dark:
 *   - two sidebar rows start at a different inline edge (only a group inside a
 *     group may step in), or two rows have a different font-weight, or the
 *     current row is bolder than the rest;
 *   - a glyph is not 20px, or sits in a ring or circle;
 *   - the current row has no accent bar on its inline-start edge;
 *   - the owner's login or "Signed in as" is visible anywhere but the account
 *     menu, or the site name is visible beside the favicon;
 *   - the rail is not 4rem wide, a rail row has no accessible name, a tooltip
 *     does not follow focus, a group does not open a flyout, Ctrl+B does not
 *     toggle, or the choice is not remembered across a reload;
 *   - the page scrolls sideways in either state.
 *
 *   npm run build && npm run a11y:admin-sidebar
 *   WIDTHS=1280  LANGS=he  THEMES=dark  SHOTS=dir  (SHOTS also writes the screenshots)
 * Waits poll on a timer, never rAF or animationend (headless Chromium here has ~1 rAF / 40 s).
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { NOW, answer as baseAnswer, tint } from "./admin-fixtures.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const env = (n) => (process.env[n] ?? "").split(",").filter(Boolean);
const WIDTHS = (env("WIDTHS").length ? env("WIDTHS") : ["1280", "1440"]).map(Number);
const LANGS = env("LANGS").length ? env("LANGS") : ["en", "he"];
const THEMES = env("THEMES").length ? env("THEMES") : ["light", "dark"];
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const LOGIN = "owner-login";

const answer = (path, method, search) =>
  path.replace(/^\/api/, "") === "/admin/me" ? { body: { ok: true, login: LOGIN, email: null } } : baseAnswer(path, method, search);

/* ------------------------------------------------------ in-page measurement */
function sidebar() {
  const out = { rows: [], glyphs: [], bar: null, circles: [], overflow: null };
  const dir = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
  const edge = (el) => {
    const r = el.getBoundingClientRect();
    return Math.round((dir === "rtl" ? innerWidth - r.right : r.left) * 10) / 10;
  };
  const de = document.documentElement;
  if (de.scrollWidth > innerWidth + 1) out.overflow = de.scrollWidth;
  for (const el of document.querySelectorAll(".a-side-nav [data-nav-item]")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.closest("[hidden]")) continue;
    const cs = getComputedStyle(el);
    out.rows.push({
      name: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 28),
      kind: el.matches("a") ? "item" : "heading",
      edge: edge(el),
      nested: !!el.closest("ul ul"),
      weight: cs.fontWeight,
      current: el.getAttribute("aria-current") === "page",
      w: Math.round(r.width),
      h: Math.round(r.height),
      labelled: !!(el.getAttribute("aria-label") || (el.textContent || "").trim()),
    });
    const bar = getComputedStyle(el, "::before");
    if (el.getAttribute("aria-current") === "page") out.bar = { content: bar.content, w: bar.width, bg: bar.backgroundColor };
  }
  for (const svg of document.querySelectorAll(".a-side-nav svg")) {
    const r = svg.getBoundingClientRect();
    if (!r.width) continue;
    if (svg.closest("[class*=mark]")) out.glyphs.push(Math.round(r.width));
    const holder = svg.parentElement;
    const hs = getComputedStyle(holder);
    if (hs.borderRadius.includes("%") || hs.boxShadow !== "none" || (parseFloat(hs.borderTopWidth) > 0 && hs.borderTopStyle !== "none")) out.circles.push(holder.className);
    if (svg.closest(".a-side-nav") && svg.querySelector("circle[stroke-dasharray]")) out.circles.push("ring svg");
  }
  return out;
}

function identity(login) {
  const text = document.body.innerText;
  const header = document.querySelector("header.a-top")?.innerText ?? "";
  return {
    loginCount: text.split(login).length - 1,
    signedIn: /Signed in as|מחובר בתור/.test(text),
    siteNameBesideIcon: /Yehuda Briskman/.test(header) || /Yehuda Briskman/.test(document.querySelector(".a-side")?.innerText ?? ""),
    brandName: document.querySelector("header.a-top a.a-brand")?.getAttribute("aria-label") ?? "",
  };
}

/* --------------------------------------------------------------------- run */
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
const shot = (page, name, tag) => SHOTS && page.screenshot({ path: resolve(SHOTS, `${name}-${tag}.png`), timeout: 120000 });

for (const w of WIDTHS) for (const lang of LANGS) for (const theme of THEMES) {
  const tag = `${w}-${theme}-${lang}`;
  const at = (m) => `${m} @${w} ${theme} ${lang}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, theme);
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
    /* ---- expanded, Marketing open, a sub-page current */
    await page.goto(`${base}${prefix}/admin/marketing?tab=audience`, { waitUntil: "load" });
    await ready(page);
    const full = await page.evaluate(sidebar);
    n++;
    if (full.overflow) fails.push(at(`page scrolls sideways (${full.overflow})`));
    const top = full.rows.filter((r) => !r.nested);
    const edges = new Set(top.map((r) => r.edge));
    if (edges.size !== 1) fails.push(at(`rows start at ${[...edges].join(" / ")} px, not one edge: ${top.filter((r) => r.edge !== top[0].edge).map((r) => r.name).join(", ")}`));
    const weights = new Set(full.rows.map((r) => r.weight));
    if (weights.size !== 1) fails.push(at(`rows have weights ${[...weights].join(" / ")}, not one`));
    if (!full.rows.some((r) => r.current)) fails.push(at("no row is aria-current=page"));
    if (!full.bar || full.bar.content === "none" || parseFloat(full.bar.w) < 2 || parseFloat(full.bar.w) > 4) fails.push(at(`current row has no 2-4px accent bar (${JSON.stringify(full.bar)})`));
    if (full.glyphs.some((g) => g !== 20)) fails.push(at(`glyph sizes ${[...new Set(full.glyphs)].join("/")}, not 20`));
    if (full.circles.length) fails.push(at(`a ring or circle behind a glyph: ${full.circles.join(", ")}`));
    await shot(page, "expanded-marketing", tag);

    /* ---- identity once */
    let id = await page.evaluate(identity, LOGIN);
    if (id.loginCount !== 0) fails.push(at(`login visible ${id.loginCount}x with the account menu shut`));
    if (id.signedIn) fails.push(at('"Signed in as" is visible with the account menu shut'));
    if (id.siteNameBesideIcon) fails.push(at("the site name is drawn beside the favicon or in the sidebar"));
    if (id.brandName !== "Yehuda Briskman") fails.push(at(`brand link name is "${id.brandName}"`));
    await page.locator("header.a-top button.a-avatar").click({ force: true });
    await page.waitForSelector(".a-account", { timeout: 20000 });
    await page.waitForTimeout(300);
    id = await page.evaluate(identity, LOGIN);
    if (id.loginCount !== 1) fails.push(at(`login visible ${id.loginCount}x with the menu open, not once`));
    if (id.signedIn) fails.push(at('"Signed in as" is visible with the menu open'));
    await shot(page, "account-menu", tag);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    /* ---- the rest of the tree, other group open */
    await page.goto(`${base}${prefix}/admin/posts`, { waitUntil: "load" });
    await ready(page);
    const posts = await page.evaluate(sidebar);
    const pe = new Set(posts.rows.filter((r) => !r.nested).map((r) => r.edge));
    const pw = new Set(posts.rows.map((r) => r.weight));
    if (pe.size !== 1) fails.push(at(`/admin/posts rows start at ${[...pe].join(" / ")}`));
    if (pw.size !== 1) fails.push(at(`/admin/posts rows have weights ${[...pw].join(" / ")}`));
    await shot(page, "expanded-content-active", tag);

    /* ---- collapse by the button */
    await page.getByRole("button", { name: /^(Collapse|Expand|כווץ|הרחב) / }).last().click({ force: true });
    await page.waitForFunction(() => document.querySelector(".a-app")?.getAttribute("data-side") === "rail", null, { polling: 500, timeout: 20000 });
    await page.waitForTimeout(300);
    const rail = await page.evaluate(sidebar);
    n++;
    const sideW = await page.evaluate(() => Math.round(document.querySelector(".a-side").getBoundingClientRect().width));
    if (sideW < 63 || sideW > 66) fails.push(at(`rail is ${sideW}px wide, not 4rem (64)`));
    if (rail.overflow) fails.push(at(`rail: page scrolls sideways (${rail.overflow})`));
    for (const r of rail.rows) {
      if (!r.labelled) fails.push(at(`rail row has no accessible name (${r.kind})`));
      if (r.h < 44) fails.push(at(`rail row "${r.name}" is ${r.h}px tall`));
    }
    if (new Set(rail.rows.map((r) => r.edge)).size !== 1) fails.push(at(`rail rows do not share an edge: ${[...new Set(rail.rows.map((r) => r.edge))].join(" / ")}`));
    const stored = await page.evaluate(() => localStorage.getItem("admin-nav-collapsed"));
    if (stored !== "1") fails.push(at(`admin-nav-collapsed is ${stored}, not 1`));
    await shot(page, "collapsed", tag);

    /* ---- tooltip follows focus, group opens a flyout, Escape closes it */
    await page.locator('.a-side-nav a[data-nav-item]').first().focus();
    await page.waitForFunction(() => !!document.querySelector('[role="tooltip"], .pop-tip'), null, { polling: 500, timeout: 8000 }).catch(() => fails.push(at("no tooltip on focus of a rail item")));
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    const group = page.locator(".a-side-nav button[data-nav-group]").first();
    await group.click({ force: true });
    await page.waitForFunction(() => document.querySelector(".a-side-nav button[data-nav-group]")?.getAttribute("aria-expanded") === "true", null, { polling: 500, timeout: 20000 }).catch(() => fails.push(at("group did not open a flyout")));
    const fly = await page.evaluate(() => { const f = document.querySelector(".pop-panel"); if (!f) return null; const r = f.getBoundingClientRect(); return { links: f.querySelectorAll("a").length, inView: r.left >= 0 && r.right <= innerWidth }; });
    if (!fly || fly.links < 2) fails.push(at("flyout has no links"));
    else if (!fly.inView) fails.push(at("flyout runs off the screen"));
    await shot(page, "flyout", tag);
    await page.keyboard.press("Escape");

    /* ---- remembered, and Ctrl+B back */
    await page.reload({ waitUntil: "load" });
    await ready(page);
    if ((await page.evaluate(() => document.querySelector(".a-app")?.getAttribute("data-side"))) !== "rail") fails.push(at("collapse was not remembered across a reload"));
    await page.keyboard.press("Control+b");
    await page.waitForFunction(() => document.querySelector(".a-app")?.getAttribute("data-side") === "full", null, { polling: 500, timeout: 20000 }).catch(() => fails.push(at("Ctrl+B did not expand")));
  } catch (e) { fails.push(at(`ERROR ${e.message.split("\n")[0]}`)); }
  await ctx.close();
}
await browser.close();
stop();
if (fails.length) { console.log(`FAIL: ${fails.length} finding(s)`); for (const f of fails.slice(0, 60)) console.log(" ", f); process.exit(1); }
console.log(`PASS: ${n} sidebar states, one edge, one weight, identity once, rail and flyouts work.`);
