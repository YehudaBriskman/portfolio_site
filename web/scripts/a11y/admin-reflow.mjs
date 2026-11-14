#!/usr/bin/env node
/*
 * Reflow and device edge cases of the admin, held as a check. jsdom cannot see
 * layout, so this measures a real browser against a build:
 *
 *   npm run build
 *   npm run a11y:admin-reflow
 *   SHOTS=docs/design npm run a11y:admin-reflow     (also saves screenshots)
 *   ONLY=B-h5-3 npm run a11y:admin-reflow            (one case)
 *
 * Cases: the bulk bar at 320 wide and at 200% text keeps a readable count and a
 * short bar; public /story headings do not overflow at 320 and 280; every Switch
 * draws a border under forced-colors; 200% text at 320 and 390 pushes no control
 * off screen; a landscape notch (safe-area insets) is cleared by the top bar and
 * main; Hebrew mirrors the back chevron and the campaign editor's Back has no
 * literal arrow; headings never skip a level in Marketing Library and Sender.
 *
 * 200% text is the `--text-scale` token, the same one the Settings text size
 * sets. Polls on a timer, never rAF (headless Chromium here: about one frame per
 * 40 s). CHROME overrides the browser binary.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { answer, NOW, tint } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/admin-fixtures.mjs")).href);
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const SHOTS = process.env.SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });

async function open(path, o = {}) {
  const { w = 390, h = 844, lang = "en", forced = "none", fontPct, insets, touch = w < 700 } = o;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, reducedMotion: "reduce", colorScheme: "light",
    forcedColors: forced, locale: lang === "he" ? "he-IL" : "en-US",
  });
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (r) => r.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/api/images/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: tint });
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  if (insets) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets });
  }
  await page.goto(`${base}${lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() => {
      const m = document.querySelector("main");
      return !!m && !/Loading|טוען/.test(m.textContent ?? "") && [...document.images].every((im) => im.complete || !im.getAttribute("src"));
    });
    if (ok) break;
    await page.waitForTimeout(250);
  }
  if (fontPct) {
    await page.addStyleTag({ content: `:root:root:root{--text-scale:${fontPct / 100} !important}` });
    // headless Chromium here needs one frame before a root font change reaches computed style
    await page.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 }, timeout: 120000 });
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(400);
  return { ctx, page };
}
const shot = (page, name) => (SHOTS ? page.screenshot({ path: resolve(SHOTS, name), timeout: 120000 }) : null);
const tap = (page, sel) => page.locator(sel).first().dispatchEvent("click", {}, { timeout: 15000 });

/** every control must sit inside the viewport sideways */
const offscreen = (page, scope) =>
  page.evaluate((s) => [...document.querySelectorAll(`${s} input, ${s} select, ${s} textarea, ${s} button, ${s} a.a-btn, ${s} .a-pill`)]
    .filter((e) => e.getBoundingClientRect().width > 0 && !e.closest("[hidden],[inert]"))
    .map((e) => ({ n: (e.getAttribute("aria-label") || e.textContent || e.name || e.tagName).trim().slice(0, 24), l: Math.round(e.getBoundingClientRect().left), r: Math.round(e.getBoundingClientRect().right) }))
    .filter((x) => x.r > innerWidth + 1 || x.l < -1), scope);

async function selectRow(page) {
  await page.getByRole("button", { name: /^Select$/ }).dispatchEvent("click");
  await page.locator("[data-record-row]").nth(0).dispatchEvent("click");
  await page.waitForTimeout(400);
}
const barMetrics = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector('[role=toolbar][aria-label="Bulk actions"]');
    const c = bar.querySelector("[role=status]");
    const r = c.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return { barH: b.height, vh: innerHeight, countW: r.width, countH: r.height, off: b.right > innerWidth + 1 || b.left < -1 };
  });

const cases = [
  ["B-h5-1 bulk bar at 320 keeps its count and stays short", async () => {
    const { ctx, page } = await open("/admin/posts", { w: 320, h: 568 });
    await selectRow(page);
    const m = await barMetrics(page);
    await shot(page, "reflow-selection-bar-320.png");
    await ctx.close();
    return [m.countH < 60 && m.countW >= 60, `count ${m.countW}x${m.countH}`, m.barH <= 0.3 * m.vh, `bar ${m.barH}px of ${m.vh}`, !m.off, "bar off screen"];
  }],
  ["B-h5-1b bulk bar at 390 and 200% text keeps its count and stays under 40% of the screen", async () => {
    const { ctx, page } = await open("/admin/posts", { w: 390, h: 800, fontPct: 200 });
    await selectRow(page);
    const m = await barMetrics(page);
    await shot(page, "reflow-selection-bar-390-200.png");
    await ctx.close();
    return [m.countH < 100 && m.countW >= 60, `count ${m.countW}x${m.countH}`, m.barH <= 0.4 * m.vh, `bar ${m.barH}px of ${m.vh}`];
  }],
  ["B-h5-2 /story headings are not cut off at 320 and 280", async () => {
    const out = [];
    for (const w of [320, 280]) {
      const { ctx, page } = await open("/story", { w, h: 700 });
      const bad = await page.evaluate(() => [...document.querySelectorAll("h1, h2, h3")].filter((h) => h.getBoundingClientRect().width > 0)
        .map((h) => ({ t: h.textContent.trim().slice(0, 24), r: Math.round(h.getBoundingClientRect().right), s: h.scrollWidth - h.clientWidth }))
        .filter((x) => x.r > innerWidth + 0.5 || x.s > 1));
      if (w === 320) await shot(page, "reflow-story-320.png");
      await ctx.close();
      out.push(bad.length === 0, `headings overflow at ${w}: ${JSON.stringify(bad)}`);
    }
    return out;
  }],
  ["B-h5-3 Switch draws a border under forced-colors", async () => {
    const { ctx, page } = await open("/admin/settings", { w: 390, h: 800, forced: "active" });
    await page.evaluate(() => document.querySelector("[data-settings-group=sharing] button")?.click());
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => {
      const sw = [...document.querySelectorAll('[class*="_track_"]')];
      const t = sw[0];
      return { n: sw.length, track: t ? parseFloat(getComputedStyle(t).borderTopWidth) : 0, forced: matchMedia("(forced-colors: active)").matches };
    });
    await shot(page, "reflow-switch-forced-colors.png");
    await ctx.close();
    return [m.forced && m.n > 0, "no switch found", m.track > 0, `track border ${m.track}px`];
  }],
  ["B-h5-3b Switch state is not colour alone under forced-colors (thumb moves)", async () => {
    const { ctx, page } = await open("/admin/settings", { w: 390, h: 800, forced: "active" });
    await page.evaluate(() => document.querySelector("[data-settings-group=sharing] button")?.click());
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => {
      const sw = [...document.querySelectorAll("[role=switch]")];
      const x = (s) => { const t = s.querySelector('[class*="_track_"]'); const th = s.querySelector('[class*="_thumb_"]') ?? t.firstElementChild; return Math.round(th.getBoundingClientRect().left - t.getBoundingClientRect().left); };
      const on = sw.find((s) => s.getAttribute("aria-checked") === "true");
      const off = sw.find((s) => s.getAttribute("aria-checked") === "false");
      return { on: on ? x(on) : null, off: off ? x(off) : null };
    });
    await ctx.close();
    return [m.on !== null && m.off !== null && m.on !== m.off, `thumb offsets ${JSON.stringify(m)}`];
  }],
  ["B-h5-4 landscape notch: top bar and main clear the safe-area insets", async () => {
    const { ctx, page } = await open("/admin/posts", { w: 844, h: 390, touch: true, insets: { top: 0, left: 47, bottom: 21, right: 47 } });
    const m = await page.evaluate(() => {
      const p = document.createElement("div");
      p.style.cssText = "padding-left:env(safe-area-inset-left);position:absolute";
      document.body.append(p);
      const env = parseFloat(getComputedStyle(p).paddingLeft);
      const b = document.querySelector(".a-top button, .a-top a").getBoundingClientRect();
      const end = document.querySelector(".a-top-end").getBoundingClientRect();
      const kids = [...document.querySelector(".a-main").children].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
      return { env, left: b.left, endRight: end.right, vw: innerWidth, mainL: Math.min(...kids.map((r) => r.left)), mainR: Math.max(...kids.map((r) => r.right)) };
    });
    await shot(page, "reflow-landscape-notch.png");
    await ctx.close();
    return [m.env === 47, "harness: safe-area override must be live", m.left >= 47 && m.endRight <= m.vw - 47, `top bar ${m.left}..${m.endRight} of ${m.vw}`, m.mainL >= 47 && m.mainR <= m.vw - 47, `main ${m.mainL}..${m.mainR}`];
  }],
  ["B-h5-5 Hebrew editor: back chevron mirrors, the crumb isolates an English title", async () => {
    const { ctx, page } = await open("/admin/posts/admin-redesign", { w: 390, h: 700, lang: "he" });
    const m = await page.evaluate(() => {
      const a = document.querySelector(".a-top a.a-icon-btn");
      const last = document.querySelector(".a-crumbs")?.lastElementChild;
      return { dir: document.documentElement.dir, t: getComputedStyle(a.querySelector("svg")).transform, bidi: last ? getComputedStyle(last).unicodeBidi : "" };
    });
    await shot(page, "reflow-he-editor-390.png");
    await ctx.close();
    return [m.dir === "rtl", "page is not rtl", /^matrix\(-/.test(m.t), `chevron transform ${m.t}`, /isolate|plaintext/.test(m.bidi), `crumb title unicode-bidi ${m.bidi}`];
  }],
  ["B-h5-6 Hebrew campaign editor: no literal arrow in Back, icon mirrors", async () => {
    const { ctx, page } = await open("/admin/marketing?tab=campaigns", { w: 1024, h: 900, lang: "he" });
    await tap(page, "button.a-btn-primary");
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const bs = [...document.querySelectorAll('[data-testid="campaign-editor"] button')];
      const t = bs.map((b) => b.textContent.trim()).find((x) => /^[←→]/.test(x)) ?? null;
      const back = bs.find((b) => b.querySelector("svg"));
      return { t, svg: back ? getComputedStyle(back.querySelector("svg")).transform : null };
    });
    await ctx.close();
    return [m.t === null, `literal arrow: ${m.t}`, m.svg !== null && /^matrix\(-/.test(m.svg), `back icon transform ${m.svg}`];
  }],
  ["B-h5-7 New post at 200% text: no field is pushed past the edge (390, 320)", async () => {
    const out = [];
    for (const w of [390, 320]) {
      const { ctx, page } = await open("/admin/posts/new", { w, h: 800, fontPct: 200 });
      const bad = await offscreen(page, "main");
      if (w === 390) await shot(page, "reflow-new-post-390-200.png");
      await ctx.close();
      out.push(bad.length === 0, `past the edge at ${w}: ${JSON.stringify(bad)}`);
    }
    return out;
  }],
  ["B-h5-8 Posts at 200% text: New post stays on screen, titles, search and top bar stay readable (320, 390)", async () => {
    const out = [];
    for (const w of [320, 390]) {
      const { ctx, page } = await open("/admin/posts", { w, h: 700, fontPct: 200 });
      const m = await page.evaluate(() => {
        const t = document.querySelector('button[class*="_row_"] [class*="_title_"]');
        const s = document.querySelector(".a-main input[type=search], .a-main input[type=text]");
        const c = document.querySelector(".a-crumbs");
        return { titleW: Math.round(t.getBoundingClientRect().width), searchW: s ? Math.round(s.getBoundingClientRect().width) : 999, crumbW: c ? Math.round(c.getBoundingClientRect().width) : 999 };
      });
      const bad = await offscreen(page, ".a-main, .a-top");
      if (w === 320) await shot(page, "reflow-posts-320-200.png");
      await ctx.close();
      out.push(bad.length === 0, `controls off screen at ${w}: ${JSON.stringify(bad)}`, m.titleW >= 80, `row title ${m.titleW}px at ${w}`, m.searchW >= 120, `search ${m.searchW}px at ${w}`, m.crumbW >= 60, `top bar title ${m.crumbW}px at ${w}`);
    }
    return out;
  }],
  ["B-h5-9 headings do not skip levels (Marketing Library and Sender)", async () => {
    const out = [];
    for (const [p, n] of [["/admin/marketing?tab=library", "library"], ["/admin/marketing?tab=settings&section=sender", "sender"]]) {
      const { ctx, page } = await open(p, { w: 390, h: 800 });
      const seq = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((h) => h.getBoundingClientRect().width > 0).map((h) => +h.tagName[1]));
      await ctx.close();
      out.push(seq.length > 1 && !seq.some((x, i) => i > 0 && x > seq[i - 1] + 1), `${n} heading levels ${seq.join("")}`);
    }
    return out;
  }],
];

let failed = 0;
for (const [name, fn] of cases) {
  if (only && !only.test(name)) continue;
  let res;
  try { res = await fn(); } catch (e) { res = [false, `threw: ${String(e.message).split("\n")[0]}`]; }
  const bad = [];
  for (let i = 0; i < res.length; i += 2) if (!res[i]) bad.push(res[i + 1]);
  if (bad.length) { failed++; console.log(`FAIL ${name}\n     ${bad.join("\n     ")}`); } else console.log(`ok   ${name}`);
}
await browser.close();
stop?.();
console.log(failed ? `\n${failed} failing` : "\nall reflow checks pass");
process.exit(failed ? 1 : 0);
