#!/usr/bin/env node
/*
 * The dynamic half of the English-on-Hebrew audit (docs/i18n/english-on-hebrew-audit.md).
 *
 * Crawls every route under /he of a running build and records every Latin
 * run a visitor (or the owner, in admin) can meet: visible text, the
 * accessible-name attributes, the document head. Each record carries the
 * language and direction it is rendered in, so a correctly marked English
 * fallback (`lang="en" dir="ltr"`) is told apart from an unmarked leak.
 *
 *   BASE=http://127.0.0.1:15173 OUT=/tmp/audit xvfb-run -a node scripts/i18n-audit/crawl.mjs
 *
 * BASE must serve web/dist with the API behind /api (a seeded local backend,
 * not the fixture stub, so content-store, GitHub and settings text appear).
 * Interactions are generic: every closed disclosure on the page
 * (`aria-haspopup`, `aria-expanded="false"`) is opened in turn, read, and
 * closed with Escape. Error and loading states are reached by failing or
 * stalling /api from the browser.
 *
 * Polling is by hand throughout: this box's Chromium barely fires rAF.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:15173";
const OUT = process.env.OUT ?? resolve(process.cwd(), "i18n-audit-out");
const SHOTS = resolve(OUT, "shots");
mkdirSync(SHOTS, { recursive: true });

const api = async (p) => (await fetch(BASE + p)).json();
const projects = (await api("/api/content")).projects.items.map((p) => p.slug);
const areas = (await api("/api/areas")).items.map((a) => a.slug);
const notes = (await api("/api/blog/posts")).items
  .map((p) => p.slug)
  .filter((s) => !s.startsWith("fixture-") || s === "fixture-rendering");
const adminNotes = ["windom-1-0-first-release"];

const PUBLIC = [
  "/",
  "/story",
  "/projects",
  ...projects.map((s) => `/projects/${s}`),
  "/blog",
  "/blog/log",
  ...areas.map((s) => `/blog/area/${s}`),
  ...notes.map((s) => `/blog/${s}`),
  "/accessibility",
  "/developers/mcp",
  "/a-page-that-does-not-exist",
  "/blog/a-note-that-does-not-exist",
  "/projects/a-project-that-does-not-exist",
  "/blog/area/an-area-that-does-not-exist",
];
const ADMIN = [
  "/admin/posts",
  ...adminNotes.map((s) => `/admin/posts/${s}`),
  "/admin/areas",
  "/admin/areas/windom",
  "/admin/connections",
  "/admin/media",
  "/admin/projects",
  "/admin/story",
  "/admin/site-copy",
  "/admin/settings",
];
/* Error and loading states: a representative page per data source. */
const STATE_ROUTES = ["/", "/projects", "/projects/windom", "/blog", "/blog/area/windom", "/blog/log", `/blog/${notes[0]}`, "/story"];

const he = (r) => (r === "/" ? "/he" : `/he${r}`);
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

/* desktop-dark and phone-light were crawled once (2026-11-03) and added no
   string the two runs below did not already find; they stay for a full sweep. */
const RUNS = [
  { name: "desktop-light-motion", size: "desktop", theme: "light", motion: "no-preference", routes: [...PUBLIC, ...ADMIN] },
  { name: "phone-dark", size: "phone", theme: "dark", motion: "reduce", routes: [...PUBLIC, ...ADMIN] },
  { name: "desktop-dark", size: "desktop", theme: "dark", motion: "reduce", routes: PUBLIC },
  { name: "phone-light", size: "phone", theme: "light", motion: "no-preference", routes: PUBLIC },
  { name: "api-error", size: "desktop", theme: "light", motion: "reduce", routes: STATE_ROUTES, api: "fail" },
  { name: "api-loading", size: "desktop", theme: "light", motion: "reduce", routes: STATE_ROUTES, api: "stall" },
];
const ONLY = process.env.ONLY?.split(",");

/* ------------------------------------------------------------ in the page */

function extract(state) {
  const out = [];
  const LATIN = /[A-Za-z]/;
  const path = (el) => {
    const parts = [];
    for (let e = el, i = 0; e && e !== document.body && i < 5; e = e.parentElement, i++) {
      let s = e.tagName.toLowerCase();
      if (e.id) s += `#${e.id}`;
      else if (e.getAttribute("data-section")) s += `[data-section=${e.getAttribute("data-section")}]`;
      else if (e.classList[0]) s += `.${e.classList[0].replace(/_[A-Za-z0-9-]{5,}$/, "")}`;
      parts.unshift(s);
    }
    return parts.join(">");
  };
  const meta = (el) => {
    const langEl = el.closest("[lang]");
    const dirEl = el.closest("[dir]");
    const cs = getComputedStyle(el);
    return {
      lang: langEl?.getAttribute("lang") ?? null,
      langOwn: langEl === el || (langEl && langEl.contains(el) && langEl !== document.documentElement),
      dir: dirEl?.getAttribute("dir") ?? null,
      direction: cs.direction,
      bidi: cs.unicodeBidi,
      bdi: !!el.closest("bdi,bdo"),
      code: !!el.closest("code,pre,kbd,samp"),
      ariaHidden: !!el.closest('[aria-hidden="true"]'),
      visible: el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : true,
      sel: path(el),
      landmark: el.closest("header,nav,main,footer,aside,dialog,[role=dialog],[role=menu]")?.tagName?.toLowerCase() ?? null,
    };
  };
  /* Text is recorded per block, not per text node: several sections split a
     sentence into one span per word for their arrival, and a finding is a
     sentence. The block's marking is "true" when every Latin text node in it
     sits inside lang="en" + LTR, "false" when none does, "mixed" otherwise. */
  const INLINE = new Set(["inline", "contents"]);
  const blockOf = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (/^(A|BUTTON|LABEL|SUMMARY|LEGEND|OPTION|TH|TD|LI|FIGCAPTION|DT|DD|H[1-6]|P|CODE|PRE|BLOCKQUOTE)$/.test(e.tagName)) return e;
      if (!INLINE.has(getComputedStyle(e).display)) return e;
    }
    return el;
  };
  const blocks = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue;
    if (!t || !LATIN.test(t)) continue;
    const el = n.parentElement;
    if (!el || el.closest("script,style,noscript,template,svg")) continue;
    const b = blockOf(el);
    const m = meta(el);
    const isEn = String(m.lang ?? "").startsWith("en") && m.direction === "ltr";
    let rec = blocks.get(b);
    if (!rec) {
      rec = { kind: "text", block: true, text: (b.innerText || b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400), state, ...meta(b), latin: [], en: 0, notEn: 0, anyVisible: false };
      blocks.set(b, rec);
    }
    rec.latin.push(t.trim());
    if (isEn) rec.en++;
    else rec.notEn++;
    if (m.visible) rec.anyVisible = true;
    if (m.code) rec.code = true;
  }
  for (const r of blocks.values()) {
    r.marked = r.notEn === 0 ? "true" : r.en === 0 ? "false" : "mixed";
    r.visible = r.anyVisible;
    r.latin = r.latin.join(" ").replace(/\s+/g, " ").slice(0, 400);
    out.push(r);
  }
  const ATTRS = ["aria-label", "title", "alt", "placeholder", "aria-description", "aria-roledescription", "aria-valuetext"];
  for (const el of document.body.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(","))) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && LATIN.test(v)) out.push({ kind: `attr:${a}`, text: v.slice(0, 400), state, ...meta(el) });
    }
  }
  for (const el of document.body.querySelectorAll("input[type=submit][value],input[type=button][value]")) {
    if (LATIN.test(el.value)) out.push({ kind: "attr:value", text: el.value, state, ...meta(el) });
  }
  const head = [];
  head.push({ kind: "head:title", text: document.title });
  for (const m of document.head.querySelectorAll("meta[name=description],meta[property^='og:'],meta[name^='twitter:']")) {
    head.push({ kind: `head:${m.getAttribute("name") ?? m.getAttribute("property")}`, text: m.getAttribute("content") ?? "" });
  }
  for (const l of document.head.querySelectorAll("link[hreflang]")) head.push({ kind: `head:hreflang-${l.hreflang}`, text: l.href });
  return { items: out, head, doc: `${document.documentElement.lang}/${document.documentElement.dir}` };
}

/* --------------------------------------------------------------- driving */

const settle = async (page) => {
  await page.waitForFunction(() => document.querySelector("h1, main") !== null, null, { polling: 500, timeout: 20_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  // Scroll the whole page in steps so every in-view arrival fires.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
};

const browser = await chromium.launch({ headless: !process.env.DISPLAY, args: ["--no-sandbox"] });
const records = [];
const apiSeen = {};
const problems = [];

for (const run of RUNS.filter((r) => !ONLY || ONLY.includes(r.name))) {
  // PART=i/n splits a run across processes (every nth route), for a wall-clock that fits.
  const [pi, pn] = (process.env.PART ?? "0/1").split("/").map(Number);
  for (const route of run.routes.filter((_, i) => i % pn === pi)) {
    const context = await browser.newContext({ viewport: SIZES[run.size], deviceScaleFactor: 1, reducedMotion: run.motion, locale: "he-IL" });
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("yb-theme", t);
        localStorage.setItem("yb-lang", "he");
      } catch {}
    }, run.theme);
    if (run.api === "fail") await context.route("**/api/**", (r) => r.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
    if (run.api === "stall") await context.route("**/api/**", () => {}); // never answered: the loading state stays
    const page = await context.newPage();
    page.on("pageerror", (e) => problems.push(`${run.name} ${route}: ${e.message}`));
    page.on("response", async (r) => {
      const u = new URL(r.url());
      if (!u.pathname.startsWith("/api/") || apiSeen[u.pathname]) return;
      try {
        if ((r.headers()["content-type"] ?? "").includes("json")) apiSeen[u.pathname] = await r.json();
      } catch {}
    });
    const t0 = Date.now();
    const url = BASE + he(route);
    try {
      await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    } catch (e) {
      problems.push(`${run.name} ${route}: goto ${e.message}`);
      await context.close();
      continue;
    }
    if (run.api === "stall") await page.waitForTimeout(1500);
    else await settle(page);
    const finalPath = new URL(page.url()).pathname;
    const base = await page.evaluate(extract, "page");
    const push = (res, state) => {
      for (const it of res.items) records.push({ ...it, state, run: run.name, route: he(route), finalPath, doc: res.doc });
    };
    push(base, "page");
    for (const h of base.head) records.push({ ...h, state: "head", run: run.name, route: he(route), finalPath, doc: base.doc });

    if (!run.api) {
      // Open every closed disclosure, one at a time.
      const triggers = await page.$$eval('button[aria-haspopup]:not([disabled]), button[aria-expanded="false"]:not([disabled]), [role=button][aria-expanded="false"]', (els) =>
        els
          .filter((e) => e.checkVisibility?.({ visibilityProperty: true }) && e.getBoundingClientRect().width > 0)
          .map((e, i) => {
            e.setAttribute("data-audit-trigger", String(i));
            return { i, label: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 60) };
          }),
      );
      for (const t of triggers.slice(0, 12)) {
        try {
          const before = page.url();
          const loc = page.locator(`[data-audit-trigger="${t.i}"]`);
          await loc.click({ timeout: 3000 }).catch(() => loc.evaluate((e) => e.click()));
          await page.waitForTimeout(700);
          push(await page.evaluate(extract, `open:${t.label}`), `open:${t.label}`);
          if (run.size === "desktop" && run.name.includes("light") && /theme|language|שפה|ערכת|תצוגה|menu|תפריט/i.test(t.label)) {
            await page.screenshot({ path: resolve(SHOTS, `${run.name}${he(route).replaceAll("/", "_")}--open-${t.i}.png`) }).catch(() => {});
          }
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
          if (page.url() !== before) await page.goto(url, { waitUntil: "load" }).then(() => settle(page));
        } catch (e) {
          problems.push(`${run.name} ${route}: trigger "${t.label}" ${e.message.split("\n")[0]}`);
        }
      }
      // Note images open a lightbox; open the first.
      if (route.startsWith("/blog/") && !route.includes("area") && !route.includes("log")) {
        const img = page.locator("article img, main figure img").first();
        if (await img.count()) {
          try {
            await img.click({ timeout: 3000 });
            await page.waitForTimeout(700);
            push(await page.evaluate(extract, "open:lightbox"), "open:lightbox");
            await page.keyboard.press("Escape");
          } catch {}
        }
      }
      // The contact form's errors: submit it empty, then with a bad address.
      if (route === "/") {
        const form = page.locator("form").first();
        if (await form.count()) {
          try {
            await form.locator('button[type="submit"]').click({ timeout: 3000 });
            await page.waitForTimeout(700);
            push(await page.evaluate(extract, "contact:empty-submit"), "contact:empty-submit");
            await form.locator("input").nth(0).fill("Test");
            await form.locator('input[type="email"], input[name*=mail]').first().fill("not-an-address");
            await form.locator('button[type="submit"]').click({ timeout: 3000 });
            await page.waitForTimeout(700);
            push(await page.evaluate(extract, "contact:bad-email"), "contact:bad-email");
            await form.scrollIntoViewIfNeeded();
            if (run.name === "desktop-light-motion") await page.screenshot({ path: resolve(SHOTS, `contact-errors.png`) });
          } catch (e) {
            problems.push(`contact: ${e.message.split("\n")[0]}`);
          }
        }
      }
    }
    // A shot of every page in the two main runs, top of page; the doc keeps only the ones that illustrate problems.
    if (run.name === "desktop-light-motion" || run.name === "phone-dark" || run.api) {
      await page.screenshot({ path: resolve(SHOTS, `${run.name}${he(route).replaceAll("/", "_")}.png`), fullPage: false }).catch(() => {});
    }
    console.log(run.name, route, "→", finalPath, base.items.length, Math.round((Date.now() - t0) / 1000) + "s");
    await context.close();
  }
}
await browser.close();

writeFileSync(resolve(OUT, "records.json"), JSON.stringify(records));
writeFileSync(resolve(OUT, "api.json"), JSON.stringify(apiSeen));
writeFileSync(resolve(OUT, "problems.json"), JSON.stringify(problems, null, 2));
console.log(`records ${records.length}, api paths ${Object.keys(apiSeen).length}, problems ${problems.length}`);
