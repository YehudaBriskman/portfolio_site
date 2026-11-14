#!/usr/bin/env node
/*
 * Admin density matrix: every admin route and modal/sheet/tab state at phone
 * widths (390x844 and 360x740, light, en), measured for density, scored and
 * ranked. Companion of admin-matrix.mjs (same harness: `vite preview` of the
 * built site + site-stub.mjs fixtures, no API, no login, no network; anything
 * not on 127.0.0.1 is aborted). Fixtures here are bigger (10-20 records per
 * list) because a list with 2 rows measures nothing.
 *
 *   cd web && npx vite build
 *   npm run a11y:density -- [--out dir] [--json file] [--table file] [--top 25] [--shots top|none]
 *   Output goes to a temp folder (printed at the end), never into the repo; it is a measuring tool, not a CI gate.
 *   ONLY=media,marketing-inbox   VPS=390x844,360x740   CHROME=/path/to/chrome
 *   LANGS=he     Hebrew, right to left (default en); the steps match both languages' button names
 *   THEMES=dark  the dark theme (default light)
 *   A run measures one language and one theme, so a before/after is two runs with the same flags.
 *
 * Metrics (en/light unless LANGS / THEMES say otherwise; "fold" = what intersects the first viewport at scroll 0;
 * with a dialog open, the dialog is the screen):
 *   chars/nodes        visible text characters / visible text nodes (page, fold)
 *   runs               longest unbroken run of >=3 consecutive sibling rows/cards (same tag+class,
 *                      height within 35%, each >= 32px tall); rowsInFold = members of the biggest run
 *                      (by area) visible above the fold; rowH = its median height
 *   scrollVH           scroll height in viewport heights
 *   controls           button/input/select/textarea/[role=button|tab|switch]/summary visible in fold
 *   pills              short (<=28 chars) non-interactive labels that look like a pill/badge/chip
 *   small%             share of visible characters set under 15px
 *   empty%             share of characters that are placeholder/empty text ("-", "None", "No x yet",
 *                      "Not set", input placeholders)
 * score (0-100) = 100 * sum(w * min(1, x/cap)):
 *   foldChars/1200 .18, foldNodes/120 .14, foldControls/20 .14, foldPills/12 .09, small% /0.5 .10,
 *   scrollVH/8 .10, longestRun/12 .10, empty%/0.25 .05, rowCost .10 where rowCost =
 *   1 - min(rowsInFold,6)/6 when a run exists (records that cost a lot of screen), else 0.
 * Waits poll on a timer, never rAF (headless Chromium here has ~1 rAF / 40 s).
 */
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { NOW, SEED, answer, tint, unanswered } from "./admin-fixtures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const TMP = mkdtempSync(resolve(tmpdir(), "density-matrix-")); // a private 0700 folder, never a predictable path
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const OUT = resolve(arg("--out", resolve(TMP, "shots")));
const JSON_OUT = arg("--json", resolve(TMP, "results.json"));
const DIAG = arg("--diagnoses", resolve(TMP, "diagnoses.json"));
const TOP = +arg("--top", 25);
const SHOTS = arg("--shots", "top");
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const env = (n) => (process.env[n] ?? "").split(",").filter(Boolean);
const VPS = (env("VPS").length ? env("VPS") : ["390x844", "360x740"]).map((s) => { const [w, h] = s.split("x").map(Number); return { id: s, w, h }; });
const ONLY = env("ONLY");
const LANG = env("LANGS")[0] ?? "en";
const THEME = env("THEMES")[0] ?? "light";
if (!["en", "he"].includes(LANG) || !["light", "dark"].includes(THEME)) throw new Error(`LANGS is en or he and THEMES is light or dark (got ${LANG}, ${THEME})`);

/* ------------------------------------------------------------------ screens */
/* [name, group, route, step?]  A step returns "skip" when the state does not exist on this screen. */
/* A phone's audience list is RecordRow rows (no table), and Add / Import sit behind the + sheet; wide, they are toolbar buttons. dispatchEvent, not click(): Playwright's click waits for a stable box, which needs animation frames. */
const addPeople = (item, wide) => async (page) => {
  const plus = page.getByRole("button", { name: /^(Add people|הוספת אנשים)$/ });
  if (await plus.count()) {
    await plus.dispatchEvent("click", {}, { timeout: 20000 });
    await page.getByRole("button", { name: item }).dispatchEvent("click", {}, { timeout: 8000 });
  } else await page.locator(wide).first().dispatchEvent("click", {}, { timeout: 20000 });
};
const click = (sel, n = 0) => async (page) => { await page.locator(sel).nth(n).click({ force: true, timeout: 20000 }); };
/* Every collapsed section: <details>, and the Disclosure / DisclosureButton pattern (an aria-expanded button over a region). The top bar's menus are not sections. */
const openAll = async (page) => {
  const n = await page.evaluate(() => {
    const c = [...document.querySelectorAll("details:not([open])")];
    c.forEach((d) => (d.open = true));
    const b = [...document.querySelectorAll('[aria-expanded="false"][aria-controls]')].filter((el) => !el.closest("header, nav") && !el.hasAttribute("aria-haspopup"));
    b.forEach((el) => el.click());
    return c.length + b.length;
  });
  if (n) await page.waitForTimeout(400);
  return n ? undefined : "skip";
};
const byName = (re) => async (page) => { await page.getByRole("button", { name: re }).first().click({ force: true, timeout: 20000 }); };
const tabN = (n) => click('[role="tablist"] [role="tab"]', n);
const mkTab = (t) => async (page) => { await page.getByRole("tab", { name: t }).first().click({ force: true, timeout: 20000 }); };
/* The editor's language is a select on a phone and three toggles before that: take whichever the build has. */
const editingLang = (value, toggles) => async (page) => {
  const sel = page.locator("select[data-editing-language]");
  if (await sel.count()) await sel.selectOption(value); else await toggles(page);
};
const SCREENS = [
  ["overview", "Overview", "/admin"],
  ["nav-drawer", "Shell", "/admin", async (page) => { await page.getByRole("button", { name: /^(Menu|תפריט)$/ }).first().click({ force: true, timeout: 20000 }); }],
  ["display-menu", "Shell", "/admin", async (page) => { await page.locator('button[aria-haspopup="dialog"]').first().click({ force: true, timeout: 20000 }); }],
  ["posts", "Posts", "/admin/posts"],
  ["posts-draft", "Posts", "/admin/posts?status=draft"],
  ["posts-published", "Posts", "/admin/posts?status=published"],
  ["posts-archived", "Posts", "/admin/posts?status=archived"],
  ["post-editor", "Posts", "/admin/posts/admin-redesign"],
  ["post-editor-expanded", "Posts", "/admin/posts/admin-redesign", openAll],
  ["post-editor-he", "Posts", "/admin/posts/admin-redesign", editingLang("he", byName(/^Hebrew$/))],
  ["post-editor-both", "Posts", "/admin/posts/admin-redesign", editingLang("both", click('[class*="toggleGroup"] button', 2))],
  ["post-editor-nopreview", "Posts", "/admin/posts/notes-editor"],
  ["post-review-dialog", "Posts", "/admin/posts/admin-redesign", async (page) => { await page.locator('button.a-btn-primary[aria-haspopup="dialog"]').first().click({ force: true, timeout: 20000 }); await page.getByRole("dialog").waitFor({ timeout: 20000 }); }],
  ["post-new", "Posts", "/admin/posts/new"],
  ["post-new-expanded", "Posts", "/admin/posts/new", openAll],
  ["areas", "Areas", "/admin/areas"],
  ["area-edit", "Areas", "/admin/areas/bothy"],
  ["area-edit-expanded", "Areas", "/admin/areas/bothy", openAll],
  ["area-new", "Areas", "/admin/areas/new"],
  ["projects", "Projects", "/admin/projects"],
  ["projects-item-3", "Projects", "/admin/projects?project=" + (SEED.projects.items[2]?.slug ?? "x")],
  ["projects-expanded", "Projects", "/admin/projects", openAll],
  ["story", "Story", "/admin/story"],
  ["story-expanded", "Story", "/admin/story", openAll],
  ["site-copy", "Site copy", "/admin/site-copy"],
  ["site-copy-expanded", "Site copy", "/admin/site-copy", openAll],
  ["media", "Media", "/admin/media"],
  ["media-item", "Media", "/admin/media?id=fixture-media"],
  ["media-item-used", "Media", "/admin/media?id=gen-media-1"],
  ["media-video", "Media", "/admin/media?id=fixture-video"],
  ["media-icon", "Media", "/admin/media?id=fixture-icon"],
  ["media-item-expanded", "Media", "/admin/media?id=fixture-media", openAll],
  ["settings", "Settings", "/admin/settings"],
  ["settings-expanded", "Settings", "/admin/settings", openAll],
  ["connections", "Connections", "/admin/connections"],
  ["connections-expanded", "Connections", "/admin/connections", openAll],
  ["translations", "Translations", "/admin/translations"],
  ["translations-stale", "Translations", "/admin/translations?status=stale"],
  ["translations-done", "Translations", "/admin/translations?status=done&visibility=all"],
  ["translations-expanded", "Translations", "/admin/translations", openAll],
  ["marketing-inbox", "Marketing", "/admin/marketing"],
  ["marketing-composer", "Marketing", "/admin/marketing", click(".mk-row-main, [data-record-row]")],
  ["marketing-composer-tab2", "Marketing", "/admin/marketing", async (page) => { await page.locator(".mk-row-main, [data-record-row]").first().click({ force: true, timeout: 20000 }); await page.waitForTimeout(600); await page.locator(".mk-tab, .mk-emb-tab").nth(1).click({ force: true, timeout: 20000 }); }],
  ["marketing-composer-tab3", "Marketing", "/admin/marketing", async (page) => { await page.locator(".mk-row-main, [data-record-row]").first().click({ force: true, timeout: 20000 }); await page.waitForTimeout(600); await page.locator(".mk-tab, .mk-emb-tab").nth(2).click({ force: true, timeout: 20000 }); }],
  ["marketing-composer-expanded", "Marketing", "/admin/marketing", async (page) => { await page.locator(".mk-row-main, [data-record-row]").first().click({ force: true, timeout: 20000 }); await page.waitForTimeout(600); return openAll(page); }],
  ["marketing-new", "Marketing", "/admin/marketing", click("button.a-btn-primary.mk-btn")],
  ["marketing-campaigns", "Marketing", "/admin/marketing?tab=campaigns"],
  ["marketing-campaign-new", "Marketing", "/admin/marketing?tab=campaigns", click("button.a-btn-primary")],
  ["marketing-campaign-draft", "Marketing", "/admin/marketing?tab=campaigns", async (page) => { await page.getByRole("button", { name: /^(Open|פתיחת) Spring/ }).first().click({ force: true, timeout: 20000 }); }],
  ["marketing-campaign-progress", "Marketing", "/admin/marketing?tab=campaigns", async (page) => { await page.getByRole("button", { name: /^(Open|פתיחת) Release/ }).first().click({ force: true, timeout: 20000 }); }],
  ["marketing-campaign-sent", "Marketing", "/admin/marketing?tab=campaigns", async (page) => { await page.getByRole("button", { name: /^(Open|פתיחת) Sent one/ }).first().click({ force: true, timeout: 20000 }); }],
  /* The open campaign is a sheet over the list; its primary action opens the composer, where the collapsed sections are. */
  ["marketing-campaign-expanded", "Marketing", "/admin/marketing?tab=campaigns", async (page) => { await page.getByRole("button", { name: /^(Open|פתיחת) Spring/ }).first().dispatchEvent("click", {}, { timeout: 20000 }); await page.waitForTimeout(600); await page.locator('[aria-modal="true"] .a-btn-primary').first().dispatchEvent("click", {}, { timeout: 20000 }); await page.waitForTimeout(800); return openAll(page); }],
  ["marketing-audience", "Marketing", "/admin/marketing?tab=audience"],
  ["marketing-contact-sheet", "Marketing", "/admin/marketing?tab=audience", click("[data-record-row]")],
  ["marketing-add-contact", "Marketing", "/admin/marketing?tab=audience", addPeople(/^(Add contact|הוספת איש קשר)$/, "button.a-btn-primary")],
  ["marketing-import", "Marketing", "/admin/marketing?tab=audience", addPeople(/^(Import CSV|ייבוא CSV)$/, "div.flex.flex-wrap.gap-2 > button:not(.a-btn-primary)")],
  ["marketing-audience-expanded", "Marketing", "/admin/marketing?tab=audience", openAll],
  ["marketing-library", "Marketing", "/admin/marketing?tab=library"],
  ["marketing-library-expanded", "Marketing", "/admin/marketing?tab=library", openAll],
  ["marketing-settings", "Marketing", "/admin/marketing?tab=settings"],
  ["marketing-settings-expanded", "Marketing", "/admin/marketing?tab=settings", openAll],
  ["not-found-admin", "Shell", "/admin/does-not-exist"],
];

/* ------------------------------------------------------ in-page measurement */
function measureDensity() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    const cs = getComputedStyle(el);
    return !(cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0 || cs.clipPath === "inset(50%)");
  };
  /* A sheet that just opened can still be at opacity 0: this box's headless Chromium has no frame clock, so its enter transition has not run. It is on screen for a reader, so it is the screen here; only its box and display are checked. */
  const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.display !== "none" && cs.visibility !== "hidden"; };
  const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].filter(shown);
  const area = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
  const root = dialogs.length ? dialogs.sort((a, b) => area(b) - area(a))[0] : document.body;
  const inDialog = !!dialogs.length;
  const sy = window.scrollY;
  const sel = (el) => `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;
  const PLACE = /^(?:[-–—.…·•?]+|none|n\/a|nothing|empty|not set|unset|untitled|no [a-z ]{2,40}(?: yet)?\.?|nothing [a-z ]{2,40}\.?|אין [^ ]+.*|לא הוגדר|ללא)$/i;

  /* text nodes */
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "OPTION", "TEXTAREA"].includes(el.tagName) || el.closest(".sr-only, [hidden]")) continue;
    if (!vis(el)) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    nodes.push({ t, fs, fold: r.top < vh && r.bottom > 0, ph: PLACE.test(t), top: r.top + sy });
  }
  /* input placeholders count as text a person reads */
  for (const el of root.querySelectorAll("input[placeholder], textarea[placeholder]")) {
    if (!vis(el) || el.value) continue;
    const r = el.getBoundingClientRect();
    nodes.push({ t: el.getAttribute("placeholder").trim(), fs: parseFloat(getComputedStyle(el).fontSize), fold: r.top < vh && r.bottom > 0, ph: true, top: r.top + sy, input: true });
  }
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const chars = sum(nodes, (x) => x.t.length), foldNodes = nodes.filter((x) => x.fold);
  const foldChars = sum(foldNodes, (x) => x.t.length);
  const small = sum(nodes.filter((x) => x.fs < 15), (x) => x.t.length);
  const foldSmall = sum(foldNodes.filter((x) => x.fs < 15), (x) => x.t.length);
  const ph = sum(nodes.filter((x) => x.ph), (x) => x.t.length);

  /* scroll height: the page, or (dialog) the dialog's own scroller */
  let scrollH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  if (inDialog) {
    scrollH = vh;
    for (const el of [root, ...root.querySelectorAll("*")]) { const o = getComputedStyle(el).overflowY; if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight) scrollH = Math.max(scrollH, el.scrollHeight + (vh - el.clientHeight)); }
  }

  /* controls and links in the fold */
  const CTL = 'button, input:not([type=hidden]), select, textarea, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], summary';
  const inFold = (el) => { const r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0; };
  /* Not what a person can reach: inside an inert subtree, or in a <details> that is closed (its summary still counts). */
  const reachable = (el) => !el.closest("[inert]") && !(el.closest("details:not([open])") && !(el.tagName === "SUMMARY" && el.parentElement?.matches("details:not([open])") && !el.parentElement.parentElement?.closest("details:not([open])")));
  const ctl = [...root.querySelectorAll(CTL)].filter((el) => vis(el) && !el.closest(".sr-only") && reachable(el));
  const controls = ctl.length, foldControls = ctl.filter(inFold).length;
  const links = [...root.querySelectorAll("a[href]")].filter((el) => vis(el) && !el.closest(".sr-only"));
  const foldLinks = links.filter(inFold).length;

  /* pills / badges / chips */
  const pills = [...root.querySelectorAll("span, strong, em, b, small, time, div, li, p")].filter((el) => {
    if (!vis(el) || el.closest("button, a, input, select, summary, [role=tab], .sr-only")) return false;
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 28 || el.querySelector("div, p, ul, li, table")) return false;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const cls = typeof el.className === "string" ? el.className : "";
    const named = /pill|badge|chip|tag|counter|status/i.test(cls);
    const looks = parseFloat(cs.borderTopLeftRadius) >= 6 && (cs.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(cs.borderTopWidth) > 0) && r.height <= 34 && /inline/.test(cs.display);
    return named || looks;
  });
  /* keep the outermost (a pill holding a dot or a nested span is one pill) */
  const outer = pills.filter((el) => !pills.some((o) => o !== el && o.contains(el)));
  const nPills = outer.length, foldPills = outer.filter(inFold).length;

  /* runs of similar sibling rows / cards */
  const runs = [];
  const parents = new Set();
  for (const el of root.querySelectorAll("*")) { if (el.parentElement) parents.add(el.parentElement); }
  const sig = (el) => `${el.tagName}|${typeof el.className === "string" ? el.className.replace(/\b(is-|aria-)\S*/g, "").trim() : ""}`;
  for (const p of parents) {
    const kids = [...p.children].filter((c) => vis(c) && c.getBoundingClientRect().height >= 32 && (c.textContent || "").trim().length > 0 && getComputedStyle(c).position !== "fixed");
    let run = [];
    const flush = () => { if (run.length >= 3) runs.push({ p, els: run }); run = []; };
    for (const c of kids) {
      const h = c.getBoundingClientRect().height;
      if (run.length && sig(run[0]) === sig(c) && Math.abs(h - run[0].getBoundingClientRect().height) <= 0.35 * Math.max(h, run[0].getBoundingClientRect().height)) run.push(c); else { flush(); run = [c]; }
    }
    flush();
  }
  let best = null, repeated = 0, longest = 0;
  for (const r of runs) {
    const hs = r.els.map((e) => e.getBoundingClientRect().height).sort((a, b) => a - b);
    const med = hs[Math.floor(hs.length / 2)];
    r.med = med; r.area = med * r.els.length;
    repeated += r.els.length; longest = Math.max(longest, r.els.length);
    if (!best || r.area > best.area) best = r;
  }
  const rowsInFold = best ? best.els.filter((e) => { const b = e.getBoundingClientRect(); return b.top + b.height * 0.5 < vh && b.bottom > 0; }).length : 0;
  const foldTextStr = foldNodes.map((x) => x.t).join(" | ");
  const h1 = (root.querySelector("h1, h2") || {}).textContent;
  const mainText = ((document.querySelector("main") || document.body).textContent || "").replace(/\s+/g, " ").trim();
  const suspect = /something went wrong|couldn.t load|could not load|failed to load|unavailable|try again|error/i.test(foldTextStr.slice(0, 800)) || mainText.length < 120;
  return {
    inDialog, chars, nodes: nodes.length, foldChars, foldNodes: foldNodes.length,
    smallShare: chars ? small / chars : 0, foldSmallShare: foldChars ? foldSmall / foldChars : 0,
    emptyShare: chars ? ph / chars : 0, emptyNodes: nodes.filter((x) => x.ph).length,
    scrollVH: +(scrollH / vh).toFixed(2), controls, foldControls, links: links.length, foldLinks,
    pills: nPills, foldPills, repeatedRows: repeated, longestRun: longest, rowsInFold,
    rowH: best ? Math.round(best.med) : null, rowsPerScreen: best ? +(vh / best.med).toFixed(1) : null, runSel: best ? `${sel(best.p)} > ${sel(best.els[0])}` : null,
    h1: (h1 || "").trim().slice(0, 80), foldText: foldTextStr.slice(0, 700), mainChars: mainText.length, suspect,
    details: { open: root.querySelectorAll("details[open]").length, closed: root.querySelectorAll("details:not([open])").length },
  };
}
const clamp = (x) => Math.max(0, Math.min(1, x));
function score(m) {
  const rowCost = m.longestRun >= 3 ? 1 - Math.min(m.rowsInFold, 6) / 6 : 0;
  const parts = { chars: .18 * clamp(m.foldChars / 1200), nodes: .14 * clamp(m.foldNodes / 120), controls: .14 * clamp(m.foldControls / 20), pills: .09 * clamp(m.foldPills / 12), small: .10 * clamp(m.smallShare / 0.5), scroll: .10 * clamp(m.scrollVH / 8), run: .10 * clamp(m.longestRun / 12), empty: .05 * clamp(m.emptyShare / 0.25), rowCost: .10 * rowCost };
  return +(100 * Object.values(parts).reduce((a, b) => a + b, 0)).toFixed(1);
}

/* --------------------------------------------------------------------- run */
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });
async function newPage(v) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce", colorScheme: THEME, locale: LANG === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, THEME);
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/api/images/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: tint });
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  page.on("pageerror", (e) => console.log("pageerror", e.message.split("\n")[0]));
  return { ctx, page };
}
async function open(page, [name, , path, step], rec) {
  await page.goto(`${base}${LANG === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
  for (let i = 0; i < 40; i++) { const ok = await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? "") && [...document.images].every((im) => im.complete || !im.getAttribute("src")); }); if (ok) break; await page.waitForTimeout(250); }
  if (step) { try { const r = await step(page); if (r === "skip") rec.skip = true; await page.waitForTimeout(600); } catch (e) { rec.stepFailed = e.message.split("\n")[0]; } }
  await page.evaluate(() => document.fonts.ready);
}
const results = [];
const todo = SCREENS.filter((s) => !ONLY.length || ONLY.includes(s[0]));
for (const v of VPS) {
  const { ctx, page } = await newPage(v);
  for (const s of todo) {
    const rec = { screen: s[0], group: s[1], route: s[2], viewport: v.id, lang: LANG, theme: THEME };
    try {
      await open(page, s, rec);
      Object.assign(rec, await page.evaluate(measureDensity));
      rec.score = score(rec);
    } catch (e) { rec.error = e.message.split("\n")[0]; }
    results.push(rec);
    console.log(`${v.id} ${s[0]}: ${rec.error ? "ERR " + rec.error : `score ${rec.score} chars ${rec.foldChars}/${rec.chars} ctl ${rec.foldControls} pills ${rec.foldPills} run ${rec.longestRun} vh ${rec.scrollVH}${rec.suspect ? " SUSPECT" : ""}${rec.skip ? " SKIP" : ""}${rec.stepFailed ? " STEPFAIL " + rec.stepFailed : ""}`}`);
  }
  await ctx.close();
}

/* ranking is on the first viewport; the screens a step could not reach or that duplicate their base are marked */
const primary = VPS[0].id;
const byScreen = (id) => results.find((r) => r.screen === id && r.viewport === VPS[1]?.id);
const ranked = results.filter((r) => r.viewport === primary && !r.error && !r.skip && !r.stepFailed).sort((a, b) => b.score - a.score);
ranked.forEach((r, i) => { r.rank = i + 1; const o = byScreen(r.screen); if (o) r.score360 = o.score; });
if (SHOTS === "top") {
  const v = VPS[0];
  const { ctx, page } = await newPage(v);
  for (const r of ranked.slice(0, TOP)) {
    const s = SCREENS.find((x) => x[0] === r.screen);
    const tmp = {};
    try {
      await open(page, s, tmp);
      const file = `${String(r.rank).padStart(2, "0")}-${r.screen}.png`; r.shot = `shots/${file}`;
      const full = !r.inDialog;
      const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      await page.screenshot({ path: resolve(OUT, file), fullPage: full, clip: full ? { x: 0, y: 0, width: v.w, height: Math.min(h, v.h * 4) } : undefined, timeout: 60000 }).catch((e) => { r.shotFailed = e.message.split("\n")[0]; });
    } catch (e) { r.shotFailed = e.message.split("\n")[0]; }
  }
  await ctx.close();
}
await browser.close();
stop();
writeFileSync(JSON_OUT, JSON.stringify({ unanswered: [...unanswered], ranked: ranked.map((r) => r.screen), results }, null, 1));
if (unanswered.size) console.log("API paths the fixtures do not answer:", [...unanswered].join(", "));

/* ---------------------------------------------------------------- markdown */
const diag = existsSync(DIAG) ? JSON.parse(readFileSync(DIAG, "utf8")) : {};
const f = (x, d = 0) => (x == null ? "-" : (+x).toFixed(d));
const pct = (x) => `${Math.round(x * 100)}%`;
const lines = [];
lines.push("| # | Screen | Route | Score | 360 | foldChars/chars | foldNodes/nodes | rows (run/fold/rowH) | scrollVH | ctl fold | pills fold/all | <15px | empty | Diagnosis | Shot |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of ranked) {
  lines.push(`| ${r.rank} | ${r.screen}${r.inDialog ? " (dialog)" : ""} | \`${r.route}\` | **${f(r.score, 1)}** | ${f(r.score360, 1)} | ${r.foldChars}/${r.chars} | ${r.foldNodes}/${r.nodes} | ${r.longestRun}/${r.rowsInFold}/${r.rowH ?? "-"} | ${f(r.scrollVH, 1)} | ${r.foldControls} | ${r.foldPills}/${r.pills} | ${pct(r.smallShare)} | ${pct(r.emptyShare)} | ${diag[r.screen] ?? ""} | ${r.shot ? `[png](${r.shot})` : ""} |`);
}
writeFileSync(arg("--table", resolve(TMP, "table.md")), lines.join("\n") + "\n");
console.log(`\n${ranked.length} ranked screens; table in ${arg("--table", resolve(TMP, "table.md"))}`);
