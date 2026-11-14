#!/usr/bin/env node
/*
 * Side-by-side boxes are one size (docs/admin-design-guide.md, "Equal siblings").
 * In every grid or flex row of two or more sibling cards, tiles, stat boxes or
 * buttons, the heights agree within 1px: a missing second line must not change a
 * box. Measured in a real browser against a build:
 *
 *   npm run build && npm run a11y:admin-equal
 *   ONLY=/admin  WIDTHS=390  LANGS=he  PROBE=1 (prints every unequal row)
 *
 * Boxes taller than 360px are page panels (a main column beside a side column), not tiles: not compared.
 * 390 and 1280, English and Hebrew, light. KNOWN is a shrink-only allow-list of rows that
 * are still unequal: remove a line when you fix one, never add one.
 * Reuses admin-fixtures.mjs (`vite preview` plus API fixtures; no network). Polls on a
 * timer, never rAF. CHROME overrides the browser binary.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NOW, answer } from "./admin-fixtures.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const env = (n, d) => (process.env[n] ? process.env[n].split(",") : d);
const ROUTES = env("ONLY", [
  "/admin", "/admin/posts", "/admin/posts/admin-redesign", "/admin/areas", "/admin/areas/bothy", "/admin/projects", "/admin/story",
  "/admin/site-copy", "/admin/media", "/admin/translations", "/admin/connections", "/admin/settings",
  "/admin/marketing?tab=inbox", "/admin/marketing?tab=audience", "/admin/marketing?tab=campaigns", "/admin/marketing?tab=library", "/admin/marketing?tab=settings",
]);
const WIDTHS = env("WIDTHS", ["390", "1280"]).map(Number);
const LANGS = env("LANGS", ["en", "he"]);
const PROBE = !!process.env.PROBE;

/* Shrink-only: "route|selector-of-the-container" of rows still unequal. */
const KNOWN = [];

function measure() {
  const box = (el) => {
    const cs = getComputedStyle(el);
    const border = ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none");
    const bg = cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
    return border || bg || cs.boxShadow !== "none";
  };
  /* A list item or wrapper that draws nothing stands for the one box inside it. */
  const unwrap = (el) => {
    let cur = el;
    while (!box(cur) && cur.children.length === 1 && cur.children[0].getBoundingClientRect().height > 0) cur = cur.children[0];
    return box(cur) ? cur : el;
  };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const sel = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;
  const out = [];
  for (const c of document.querySelectorAll("main *, header *")) {
    const cs = getComputedStyle(c);
    if (!/grid|flex/.test(cs.display) || c.closest("table, [inert], dialog:not([open])") || c.closest("details:not([open])")) continue;
    if (cs.flexDirection === "column") continue;
    const kids = [...c.children].filter(vis).map((k) => ({ k, b: unwrap(k) })).filter(({ b }) => box(b) && b.getBoundingClientRect().height >= 32 && b.getBoundingClientRect().height <= 360);
    if (kids.length < 2) continue;
    /* Rows: boxes that start on the same line. */
    const rows = new Map();
    for (const { b } of kids) { const r = b.getBoundingClientRect(); const key = Math.round(r.top / 4); (rows.get(key) ?? rows.set(key, []).get(key)).push(b); }
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      const hs = row.map((b) => b.getBoundingClientRect().height);
      if (Math.max(...hs) - Math.min(...hs) > 1) out.push({ at: sel(c), heights: hs.map((h) => Math.round(h * 10) / 10), kids: row.map(sel) });
    }
  }
  return out;
}

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });
const found = new Map();
for (const lang of LANGS) for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 600, hasTouch: w < 600, reducedMotion: "reduce", locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (r) => r.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  for (const route of ROUTES) {
    await page.goto(`${base}${lang === "he" ? "/he" : ""}${route}`, { waitUntil: "load" });
    for (let i = 0; i < 24; i++) {
      if (await page.evaluate(() => !!document.querySelector("main") && !/Loading|טוען/.test(document.querySelector("main").textContent))) break;
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(500);
    for (const f of await page.evaluate(measure)) {
      const key = `${route.split("?")[0]}${route.includes("?") ? "?" + route.split("?")[1] : ""}|${f.at}`;
      if (!found.has(key)) found.set(key, { ...f, where: [] });
      found.get(key).where.push(`${w}${lang}`);
    }
  }
  await ctx.close();
}
await browser.close();
await stop?.();

const bad = [...found.entries()].filter(([k]) => !KNOWN.includes(k));
const stale = KNOWN.filter((k) => !found.has(k));
for (const [k, f] of found) if (PROBE || !KNOWN.includes(k)) console.log(`UNEQUAL ${k} [${f.where.join(" ")}] heights ${f.heights.join("/")} in ${f.kids.join(" , ")}`);
for (const k of stale) console.log(`STALE allow-list entry (fixed, remove it): ${k}`);
if (bad.length || stale.length) { console.error(`FAIL: ${bad.length} unequal row(s), ${stale.length} stale allow-list line(s)`); process.exit(1); }
console.log(`PASS: side-by-side boxes are one size on ${ROUTES.length} screens at ${WIDTHS.join(", ")}, ${LANGS.join("+")}.`);
process.exit(0);
