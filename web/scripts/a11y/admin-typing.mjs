#!/usr/bin/env node
/*
 * Typing never throws the user out of a field. Every text, email, url, number
 * and textarea reachable in Marketing > Settings and the site Settings is typed
 * into, one character at a time, with the awkward ones ( @ . + - _ / ? # & ' " !
 * space , ; : ) and Hebrew letters. After EVERY character:
 *  - the field is still the focused element (it was not remounted or hidden);
 *  - its value is exactly what was typed so far (a controlled field did not eat or
 *    rewrite a character; email/url trim outer spaces, maxLength cuts, as the browser does);
 *  - every <details> that held the field is still open, and on a phone so is the
 *    group page or sheet around it.
 * The first report was an address typed into Sender identity: the expander
 * closed the moment the address became valid, and focus went with it.
 *
 *   npm run build
 *   npm run a11y:admin-typing
 *
 * 390 wide (groups open as a sheet or page, one reload per group) and 1280
 * (every <details> opened, the way a person would). Polls on a timer, never
 * rAF: headless Chromium here emits about one frame per 40 s. CHROME overrides
 * the browser binary; ONLY=substring limits the screens.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NOW, answer } from "./admin-fixtures.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const AWKWARD = `yehuda+tag_1@example.com ?#&'"!,;:/ -.@ שלום`;
const NUMBERS = "-1.5e+3";
const ONLY = process.env.ONLY || "";

const SCREENS = [
  { id: "marketing-settings", path: "/admin/marketing?tab=settings", ready: "[data-testid=sender-section], [data-settings-group]" },
  { id: "site-settings", path: "/admin/settings", ready: "[data-settings-group], main form, main input" },
  /* Pages with expanders but no groups: auto-open is fine, auto-close under the cursor is not. */
  { id: "area-editor", path: "/admin/areas/bothy", ready: "main input", plain: true },
  { id: "post-editor", path: "/admin/posts/admin-redesign", ready: "main input", plain: true },
].filter((s) => s.id.includes(ONLY));

/* Fields that turn what is typed into something else on purpose: a tag chip is made at the comma, an order takes digits only. */
const TRANSFORMS = /^(Tags|Featured order)/;
const fails = [];
const fail = (m) => fails.push(m);
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });

async function open(w, screen) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: w < 600, hasTouch: w < 600, reducedMotion: "reduce" });
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    if (route.request().method() !== "GET") return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    const a = answer(u.pathname, "GET", u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  page.on("pageerror", (e) => fail(`${screen.id} ${w}: pageerror ${e.message.split("\n")[0]}`));
  await page.goto(`${base}${screen.path}`, { waitUntil: "load" });
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate((sel) => !!document.querySelector(sel), screen.ready)) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
  return { page, close: () => ctx.close() };
}

/* In the page: the typeable fields inside `root`, each given a stable label. */
const FIELDS = `
  const root = document.querySelector(rootSel) || document.querySelector("main");
  const SKIP = /^(checkbox|radio|range|file|hidden|color|submit|button|reset|image|date|time|datetime-local|month|week)$/;
  const seen = new Map();
  const out = [];
  for (const el of root.querySelectorAll("input, textarea")) {
    const t = (el.getAttribute("type") || "text").toLowerCase();
    if (el.tagName === "INPUT" && SKIP.test(t)) continue;
    if (el.matches(":disabled") || el.readOnly || el.closest("[inert]") || el.closest(".sr-only")) continue;
    const label = (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute("aria-label") || el.closest("[data-setting-id]")?.getAttribute("data-setting-id") || el.name || el.id;
    const key = String(label || "field").replace(/\\s+/g, " ").trim().slice(0, 40) + " [" + t + "]";
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    el.setAttribute("data-sweep-index", String(out.length));
    out.push({ index: out.length, key: n > 1 ? key + " #" + n : key, type: t, tag: el.tagName, max: el.maxLength > 0 ? el.maxLength : 0 });
  }
  return out;
`;
const fieldsIn = (page, rootSel) => page.evaluate(new Function("rootSel", FIELDS), rootSel);
/* Every closed expander is opened first: a person opens it, then types. */
const openAll = (page, rootSel) => page.evaluate((sel) => { for (const d of (document.querySelector(sel) || document).querySelectorAll("details")) d.open = true; }, rootSel);

async function sweepField(page, tag, f, rootSel) {
  const sel = `[data-sweep-index="${f.index}"]`;
  const ok = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== "hidden";
  }, sel);
  if (!ok) return "skipped";
  const original = await page.evaluate((s) => document.querySelector(s).value, sel);
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    el.focus();
    if (el.select) el.select();
    window.__sweep = { el, details: [], surface: el.closest("dialog, [data-open=true], [class*=_page_]") };
    for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) window.__sweep.details.push(d);
  }, sel);
  if (!(await page.evaluate(() => document.activeElement === window.__sweep.el))) {
    const why = await page.evaluate(() => {
      const e = window.__sweep.el;
      const r = e.getBoundingClientRect();
      const closed = e.closest("details:not([open])");
      return `connected=${e.isConnected} size=${Math.round(r.width)}x${Math.round(r.height)} inClosedDetails=${!!closed} inert=${!!e.closest("[inert]")} hiddenAncestor=${(function () { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden") return n.tagName + "." + String(n.className).slice(0, 30); } return "none"; })()} active=${document.activeElement?.tagName}`;
    });
    fail(`${tag} "${f.key}": the field could not take focus (${why})`);
    return "failed";
  }
  await page.keyboard.press("Backspace");
  const isNum = f.type === "number";
  const text = isNum ? NUMBERS : f.type === "email" || f.type === "url" || f.type === "tel" ? AWKWARD : AWKWARD;
  let typed = "";
  for (const ch of text) {
    if (!isNum && (f.type === "email" || f.type === "url") && ch === " " && typed === "") continue;
    typed += ch;
    await page.keyboard.type(ch);
    const expected = isNum ? null : (f.max ? typed.slice(0, f.max) : typed);
    const trimmed = !isNum && (f.type === "email" || f.type === "url") && expected !== null ? expected.trim() : expected;
    const s = await page.evaluate(() => {
      const w = window.__sweep;
      const a = document.activeElement;
      return {
        focused: a === w.el && w.el.isConnected,
        connected: w.el.isConnected,
        value: w.el.value,
        closed: w.details.filter((d) => !d.isConnected || !d.open).length,
        surfaceGone: w.surface ? !w.surface.isConnected : false,
        active: a ? `${a.tagName.toLowerCase()}${a.id ? "#" + a.id : ""}` : "none",
      };
    });
    const skipValue = TRANSFORMS.test(f.key);
    const why = !s.connected ? "the field was removed from the page (remounted)" : !s.focused ? `focus left the field (now ${s.active})` : s.closed ? `${s.closed} expander(s) around it closed` : s.surfaceGone ? "the group sheet closed" : !skipValue && trimmed !== null && s.value !== trimmed && s.value !== expected ? `value is ${JSON.stringify(s.value)}, expected ${JSON.stringify(trimmed)}` : "";
    if (why) {
      fail(`${tag} "${f.key}": after typing ${JSON.stringify(ch)} (${JSON.stringify(typed)}): ${why}`);
      return "failed";
    }
  }
  /* Put the draft back so one field's text cannot change what the next one shows. */
  await page.evaluate((s) => { const el = document.querySelector(s); if (el && el.isConnected) { el.focus(); el.select?.(); } }, sel);
  if (original === "") await page.keyboard.press("Backspace");
  else await page.keyboard.insertText(original);
  return "ok";
}

let swept = 0;
for (const screen of SCREENS) {
  /* ---------------------------------------------------------- desktop */
  {
    const tag = `${screen.id} 1280`;
    const { page, close } = await open(1280, screen);
    await openAll(page, "main");
    const fields = await fieldsIn(page, "main");
    if (fields.length < 5) fail(`${tag}: found only ${fields.length} fields, the sweep is not reaching the page`);
    for (const f of fields) if ((await sweepField(page, tag, f, "main")) !== "skipped") swept++;
    await close();
  }
  /* ------------------------------------------------------------ phone */
  {
    const tag = `${screen.id} 390`;
    if (screen.plain) {
      const { page, close } = await open(390, screen);
      await openAll(page, "main");
      for (const f of await fieldsIn(page, "main")) if ((await sweepField(page, tag, f, "main")) !== "skipped") swept++;
      await close();
      continue;
    }
    const probe = await open(390, screen);
    const groups = await probe.page.evaluate(() => [...document.querySelectorAll("[data-settings-group]")].map((g) => g.getAttribute("data-settings-group")));
    await probe.close();
    if (groups.length < 3) fail(`${tag}: found ${groups.length} setting groups`);
    for (const g of groups) {
      const { page, close } = await open(390, screen);
      await page.locator(`[data-settings-group="${g}"] button`).first().dispatchEvent("click");
      await page.waitForTimeout(1200);
      const rootSel = "dialog[open], [class*=_page_]";
      await openAll(page, rootSel);
      const fields = await fieldsIn(page, rootSel);
      for (const f of fields) if ((await sweepField(page, `${tag} group ${g}`, f, rootSel)) !== "skipped") swept++;
      await close();
    }
  }
}

await browser.close();
stop();
if (fails.length) {
  console.error(`FAIL: ${fails.length} problem(s) while typing:\n- ${fails.join("\n- ")}`);
  process.exit(1);
}
console.log(`PASS: typed into ${swept} fields at 390 and 1280; focus, value and expanders held after every character.`);
