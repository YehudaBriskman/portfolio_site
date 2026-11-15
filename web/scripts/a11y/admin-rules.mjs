/*
 * The measurable admin rules, as guards with shrink-only baselines (#833, part of #830).
 * docs/admin-design-guide.md section 0 (A1 to A34) and docs/admin-motion-and-behavior.md (M1 to M12)
 * say what a screen must be; this script measures what can be measured in a real browser:
 *
 *   sticky     A11  a table of 10+ rows (or taller than the page) keeps its header (position: sticky)
 *   h1         A2   exactly one h1 on every admin page
 *   dup-head   A2   no two visible headings with the same text
 *   dup-text   A5   no two visible text nodes over 12 characters alike (a list that is the screen's job is exempt)
 *   overflow   A8   text that overflows its box ends in an ellipsis, a line clamp or wraps; never clipped
 *   gap        A7   two interactive boxes are at least 8px (--a-s-2) apart, unless one group joins them on purpose
 *   overlap    A7   no two interactive boxes intersect
 *   target     A33  a primary control on a phone is 44px on both sides
 *   icon-label A9   an icon-only control has an accessible name
 *   destructive A1/A12  a danger button is never drawn at rest on every row of a list
 *   hebrew     A34  no English word of 4+ letters on a /he/admin screen outside identifiers, user content and the allow-list
 *   motion     M6   under prefers-reduced-motion: reduce nothing transitions or animates
 *
 * (The static rules, reduced-motion CSS, the animationend/transitionend allow-list and the keyframes list,
 * are read off the source by web/src/components/admin/__tests__/adminMotionRules.guard.test.ts.)
 *
 *   npm run build && npm run a11y:admin-rules
 *   ONLY=/admin/posts  WIDTHS=1280  LANGS=en  PROBE=1 (print every finding)  --update-baseline (removes fixed lines only)
 *
 * Every finding is a line `rule|route|...`. admin-rules-baseline.json holds the lines that exist today; it may only
 * SHRINK: a finding that is not in it fails, a line that no longer reproduces prints a notice (delete it, and lower
 * the cap in adminRules.guard.test.ts). The pure half (evaluate, compare, allowlist) is exported and unit-tested
 * with synthetic offenders; the browser half only collects facts. Polls on a timer, never rAF or animationend
 * (headless Chromium here has about one frame per 40 s). Reuses admin-fixtures.mjs: no network, no login.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
export const BASELINE_FILE = resolve(HERE, "admin-rules-baseline.json");

/** The spacing token --a-s-2, the least gap between two interactive boxes (A7). */
export const MIN_GAP = 8;
/** The touch target for a primary control (A33). */
export const TOUCH = 44;
/** A table this long has a header that must stick even if the fixture is short (A11). */
export const STICKY_ROWS = 10;
/** Text shorter than this may repeat (a label, a unit). */
export const DUP_MIN = 13;

export const RULES = ["sticky", "h1", "dup-head", "dup-text", "overflow", "gap", "overlap", "target", "icon-label", "destructive", "hebrew", "motion"];

/* Words that are brand, product or code names, not English leaking into the Hebrew UI. Lower case. */
export const HEBREW_ALLOW = new Set([
  "bothy", "windom", "claude", "linkedin", "github", "gitlab", "google", "gmail", "cloudflare", "tailscale", "docker", "traefik", "grafana",
  "markdown", "html", "json", "csv", "mcp", "url", "urls", "api", "seo", "rss", "smtp", "dns", "ssl", "tls", "http", "https", "oauth", "pdf", "svg", "png", "jpeg", "jpg", "webp", "avif", "mp4",
  "rubik", "mailto", "noindex", "canonical", "cursor", "zed", "vscode", "slug", "ctrl", "shift", "alt", "enter", "escape", "tab",
]);

/* ------------------------------------------------------ pure: facts to findings */

const phoneOf = (f) => (f.w < 600 ? "phone" : "desktop");
const clip = (s, n) => s.replace(/\s+/g, " ").trim().slice(0, n);

/** Words of 4+ letters in `text` that are English chrome: not identifiers, not user content, not allowed. */
export function hebrewWords(text, { corpus = "", allow = HEBREW_ALLOW } = {}) {
  const out = [];
  for (const raw of text.split(/\s+/)) {
    /* an identifier (path, address, id, code) is isolated, not translated */
    if (/[@/\\._:=#()<>{}[\]]|\d/.test(raw.replace(/[.,;:!?'"()]+$/, "")) && !/^[A-Za-z]{4,}[.,;:!?]*$/.test(raw)) continue;
    for (const m of raw.matchAll(/[A-Za-z]{4,}/g)) {
      const w = m[0].toLowerCase();
      if (allow.has(w) || (corpus && corpus.includes(w))) continue;
      out.push(w);
    }
  }
  return out;
}

/**
 * Facts of one page (one route, one width, one language) to a list of finding lines.
 * facts: { route, w, lang, coarse, vh, h1, headings, dup, tables, overflow, controls, texts, corpus, motion }
 * Pure: the unit tests feed it synthetic facts.
 */
export function evaluate(f) {
  const out = [];
  const add = (rule, ...rest) => out.push([rule, f.route, ...rest].join("|"));
  const ph = phoneOf(f);

  /* A2: one h1, and no heading says what another says */
  if ((f.h1 ?? []).length !== 1) add("h1", String(f.h1.length));
  const seen = new Map();
  for (const h of f.headings ?? []) seen.set(clip(h, 60), (seen.get(clip(h, 60)) ?? 0) + 1);
  for (const [t, n] of seen) if (n > 1 && f.lang === "en") add("dup-head", t);

  /* A5: the same sentence twice */
  if (f.lang === "en") for (const t of f.dup ?? []) add("dup-text", clip(t, 48));

  /* A11: a long table keeps its header */
  for (const t of f.tables ?? []) if ((t.rows >= STICKY_ROWS || t.h > f.vh) && !t.sticky && f.lang === "en") add("sticky", ph, t.sel);

  /* A8: clipped text */
  for (const o of f.overflow ?? []) add("overflow", ph, f.lang, o.sel);

  /* A9, A12, A33: per control */
  for (const c of f.controls ?? []) {
    if (c.iconOnly && !c.named && f.lang === "en") add("icon-label", ph, c.sel);
    if (f.coarse && c.primary && (c.w < TOUCH || c.h < TOUCH) && f.lang === "en") add("target", c.sel);
  }
  /* A12: a danger button on two or more rows of one list */
  const rowsWith = new Map();
  for (const c of f.controls ?? []) {
    if (!c.danger || c.row < 0) continue;
    const k = `${c.rowParent}|${c.kind ?? c.sel}`;
    (rowsWith.get(k) ?? rowsWith.set(k, new Set()).get(k)).add(c.row);
  }
  if (f.lang === "en") for (const [k, rows] of rowsWith) if (rows.size >= 2) add("destructive", ph, k.split("|").slice(1).join("|"));

  /* A7: gap and intersection of every pair of interactive boxes */
  const cs = f.controls ?? [];
  const pairs = new Set();
  for (let i = 0; i < cs.length && f.lang === "en"; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      if (a.layer !== b.layer || a.nested?.includes?.(j) || b.nested?.includes?.(i) || a.holds?.includes?.(j) || b.holds?.includes?.(i)) continue;
      const dx = Math.max(a.l - b.r, b.l - a.r);
      const dy = Math.max(a.t - b.b, b.t - a.b);
      let kind = null;
      if (dx < -1 && dy < -1) kind = "overlap";
      else if (a.group !== -1 && a.group === b.group) continue; /* a menu, tab strip or segmented control joins its items */
      else if (dx >= -1 && dx < MIN_GAP && dy < -1) kind = "gap";
      else if (dy >= -1 && dy < MIN_GAP && dx < -1) kind = "gap";
      if (!kind) continue;
      pairs.add(`${kind}|${a.shell && b.shell ? "*" : f.route}|${ph}|${[a.sel, b.sel].sort().join(" ~ ")}`);
    }
  }
  for (const p of pairs) out.push(p);

  /* A34 */
  if (f.lang === "he") {
    const words = new Set();
    for (const t of f.texts ?? []) for (const w of hebrewWords(t, { corpus: f.corpus ?? "" })) words.add(w);
    for (const w of words) add("hebrew", w);
  }

  /* M6 */
  for (const m of f.motion ?? []) add("motion", ph, m);

  return [...new Set(out)];
}

/** Findings against the baseline: `added` fail the run, `stale` are lines to delete. */
export function compare(findings, baseline) {
  const base = new Set(baseline);
  const have = new Set(findings);
  return { added: [...have].filter((k) => !base.has(k)).sort(), stale: [...base].filter((k) => !have.has(k)).sort() };
}

/** A baseline update may only remove lines; returns the new list or throws when it would add one. */
export function shrink(baseline, findings, { scope = () => true } = {}) {
  const { added } = compare(findings, baseline);
  if (added.length) throw new Error(`baseline is shrink-only; ${added.length} new finding(s) must be fixed, not listed: ${added[0]}`);
  const have = new Set(findings);
  return baseline.filter((k) => have.has(k) || !scope(k));
}

/* ------------------------------------------------------ in-page: facts */
/* Self-contained: it runs inside the page, so it closes over nothing from this module. */
export function collect({ coarse, motion }) {
  const vh = innerHeight;
  const ok = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    if (el.closest("[inert], [hidden], [aria-hidden='true'], .sr-only, script, style")) return false;
    return typeof el.checkVisibility === "function" ? el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true }) : true;
  };
  const UTIL = /^(min-|max-|w-|h-|p[xytblrse]?-|m[xytblrse]?-|-m|gap|flex|inline|items|justify|text-|font-|truncate|grow|shrink|rounded|border|bg-|hidden|block|grid|self-|order-|whitespace|overflow|leading|tracking|opacity|transition|cursor|select|relative|absolute|sticky|fixed|z-|top-|left-|right-|bottom-|inset|size-|col-|row-|space-|ring|shadow|\[)/;
  const sel = (el) => {
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter((c) => c && !UTIL.test(c)).map((c) => c.replace(/^(_[A-Za-z0-9-]+?)_[a-z0-9]{5,}_\d+$/, "$1")).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[${el.getAttribute("role")}]` : ""}${cls ? "." + cls : ""}`;
  };
  const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
  const withLabel = (el, s) => {
    const t = (el.getAttribute("aria-label") || text(el)).slice(0, 24);
    return t ? `${s} "${t}"` : s;
  };
  /* A computed colour to 0-255 sRGB. No canvas: its first use waits for a GPU frame, 90 s on a box with one frame per 40 s. */
  const lin = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
  const rgb = (c) => {
    const n = (c.match(/-?[\d.]+(?:e-?\d+)?%?/g) || []).map((x) => (x.endsWith("%") ? parseFloat(x) / 100 : parseFloat(x)));
    if (/^rgba?\(/.test(c)) return { r: n[0], g: n[1], b: n[2], a: n[3] ?? 1 };
    if (/^color\(srgb/.test(c)) return { r: n[0] * 255, g: n[1] * 255, b: n[2] * 255, a: n[3] ?? 1 };
    if (/^oklch\(/.test(c) || /^oklab\(/.test(c)) {
      let [L, x, y, a] = n;
      if (/^oklch/.test(c)) { const h = (y * Math.PI) / 180; [x, y] = [x * Math.cos(h), x * Math.sin(h)]; }
      const l_ = (L + 0.3963377774 * x + 0.2158037573 * y) ** 3, m_ = (L - 0.1055613458 * x - 0.0638541728 * y) ** 3, s_ = (L - 0.0894841775 * x - 1.291485548 * y) ** 3;
      return { r: 255 * lin(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_), g: 255 * lin(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_), b: 255 * lin(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_), a: a ?? 1 };
    }
    return { r: 0, g: 0, b: 0, a: 0 };
  };
  const reddish = (c) => c.a > 0.15 && c.r >= 130 && c.r - c.g >= 55 && c.r - c.b >= 45;

  const out = { h1: [], headings: [], dup: [], tables: [], overflow: [], controls: [], texts: [], motion: [], vh };

  /* headings */
  for (const h of document.querySelectorAll("h1, h2, h3, h4, h5, h6, [role=heading]")) {
    if (!ok(h)) continue;
    const level = h.tagName.length === 2 && h.tagName[0] === "H" ? +h.tagName[1] : +h.getAttribute("aria-level") || 2;
    if (level === 1) out.h1.push(text(h));
    out.headings.push(text(h));
  }

  /* text: duplicates, overflow, Hebrew words */
  const counts = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const own = new Map();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "OPTION", "TEXTAREA"].includes(el.tagName) || !n.nodeValue.trim()) continue;
    own.set(el, (own.get(el) ?? "") + " " + n.nodeValue);
  }
  for (const [el, raw] of own) {
    if (!ok(el)) continue;
    const t = raw.replace(/\s+/g, " ").trim();
    if (!el.closest("pre, code, kbd, [dir=ltr], bdi, [translate=no], .a-path, .mono")) out.texts.push(t);
    if (t.length >= 13 && !el.closest("table, ul, ol, [role=list], [role=row], [role=listbox], [role=menu], [data-record-row], pre, code, textarea, [contenteditable], select")) {
      (counts.get(t) ?? counts.set(t, []).get(t)).push(el);
    }
    /* clipped: overflow hidden or clip, content wider (or taller) than the box, no ellipsis, no line clamp */
    const cs = getComputedStyle(el);
    const clipX = /hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
    const clipY = /hidden|clip/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== "none";
    const ellipsis = cs.textOverflow === "ellipsis";
    let clipper = null;
    if (!clipX && !clipY) {
      const er = el.getBoundingClientRect();
      let a = el.parentElement;
      for (let d = 0; a && d < 4 && !clipper; d++, a = a.parentElement) {
        const ac = getComputedStyle(a);
        if (!/hidden|clip/.test(ac.overflowX) || a === document.body || a.matches("main, #root, .a-main, .a-shell")) continue;
        const ar = a.getBoundingClientRect();
        const aclamp = ac.webkitLineClamp && ac.webkitLineClamp !== "none";
        if ((er.right > ar.right + 1 || er.left < ar.left - 1) && ac.textOverflow !== "ellipsis" && !aclamp && ar.width > 1) clipper = a;
      }
    }
    if (clipper) out.overflow.push({ sel: sel(clipper) });
    else if ((clipX && !ellipsis && !clamp) || (clipY && !clamp && !clipX)) {
      if (el.clientWidth > 0 && el.clientHeight > 0 && !el.closest("select, .a-skip")) out.overflow.push({ sel: sel(el) });
    }
  }
  for (const [t, els] of counts) if (els.length > 1) out.dup.push(t);

  /* tables */
  for (const t of document.querySelectorAll("table")) {
    if (!ok(t) || !t.tHead) continue;
    const th = t.tHead.querySelector("th") ?? t.tHead;
    const sticky = [th, t.tHead, t.tHead.rows[0]].some((e) => e && getComputedStyle(e).position === "sticky");
    out.tables.push({ sel: sel(t), rows: t.tBodies[0]?.rows.length ?? 0, h: Math.round(t.getBoundingClientRect().height), sticky });
  }

  /* interactive boxes */
  const T = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [role=radio]';
  const els = [...document.querySelectorAll(T)].filter((el) => ok(el) && !el.disabled && !el.closest(".a-skip"));
  const JOIN = "[role=menu], [role=menubar], [role=listbox], [role=tablist], [role=radiogroup], [role=toolbar][data-joined], [data-joined], ul, ol, table, nav";
  const joins = new Map();
  const groupOf = (el) => { const g = el.parentElement?.closest(JOIN); if (!g) return -1; if (!joins.has(g)) joins.set(g, joins.size); return joins.get(g); };
  const layerOf = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === "fixed" || p === "sticky") return p; } return "flow"; };
  const ROW = "tr, li, [data-record-row], [role=row], [role=listitem]";
  const rows = new Map();
  const PRIMARY = ".a-btn-primary, .a-btn, .a-icon-btn";
  els.forEach((el) => {
    let r = el.getBoundingClientRect();
    if (el.tagName === "INPUT" && /checkbox|radio/.test(el.type)) {
      const l = el.closest("label");
      if (l && l.getBoundingClientRect().width * l.getBoundingClientRect().height > r.width * r.height) r = l.getBoundingClientRect();
    }
    const clone = el.cloneNode(true);
    const named = !!(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || [...el.querySelectorAll("img[alt]")].some((i) => i.alt) || [...clone.querySelectorAll(".sr-only")].some((s) => s.textContent.trim()));
    clone.querySelectorAll("svg, .sr-only").forEach((n) => n.remove());
    const visibleText = (clone.textContent || "").trim();
    const iconOnly = /^(BUTTON|A)$/.test(el.tagName) || el.getAttribute("role") === "button" ? !visibleText && !!el.querySelector("svg, img") : false;
    const cs = getComputedStyle(el);
    const tone = el.getAttribute("data-tone") || "";
    const danger = /danger|destructive/.test(tone) || /(^|[\s_-])(danger|destructive)/.test(typeof el.className === "string" ? el.className : "") || reddish(rgb(cs.color)) || reddish(rgb(cs.backgroundColor));
    const rowEl = el.closest(ROW);
    let row = -1, rowParent = -1;
    if (rowEl) {
      if (!rows.has(rowEl)) rows.set(rowEl, rows.size);
      row = rows.get(rowEl);
      const p = rowEl.parentElement;
      if (p) { if (!rows.has(p)) rows.set(p, rows.size); rowParent = rows.get(p); }
    }
    out.controls.push({
      kind: sel(el), sel: withLabel(el, sel(el)), shell: !el.closest("main, [role=dialog], dialog"), l: Math.round(r.left * 10) / 10, t: Math.round(r.top * 10) / 10, r: Math.round(r.right * 10) / 10, b: Math.round(r.bottom * 10) / 10,
      w: Math.round(r.width), h: Math.round(r.height), layer: layerOf(el), group: groupOf(el), iconOnly, named, danger: danger && /^(BUTTON|A)$/.test(el.tagName), row, rowParent,
      primary: el.matches(PRIMARY), el,
    });
  });
  /* a control that holds another (a card link around a button) is not a pair */
  els.forEach((a, i) => { out.controls[i].holds = []; els.forEach((b, j) => { if (i !== j && a.contains(b)) out.controls[i].holds.push(j); }); });
  out.controls.forEach((c) => { delete c.el; });

  /* reduced motion: nothing transitions or animates */
  if (motion) {
    const secs = (s) => Math.max(0, ...String(s).split(",").map((x) => parseFloat(x) * (/ms/.test(x) ? 0.001 : 1) || 0));
    const seen = new Set();
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none") continue;
      const tr = secs(cs.transitionDuration) > 0.001 && cs.transitionProperty !== "none" ? "transition" : "";
      const an = cs.animationName !== "none" && secs(cs.animationDuration) > 0.001 ? `animation ${cs.animationName.split(",")[0]}` : "";
      const m = tr || an;
      if (m) seen.add(`${sel(el)} ${m}`);
    }
    out.motion = [...seen];
  }
  return out;
}

/* Walks a JSON value and appends every string, lower case: the user content a page shows (not UI). */
export function corpusOf(value, acc = []) {
  if (typeof value === "string") acc.push(value.toLowerCase());
  else if (Array.isArray(value)) for (const v of value) corpusOf(v, acc);
  else if (value && typeof value === "object") for (const v of Object.values(value)) corpusOf(v, acc);
  return acc;
}

/* ------------------------------------------------------ the run */
const ROUTES = [
  "/admin", "/admin/posts", "/admin/posts/admin-redesign", "/admin/areas", "/admin/areas/bothy", "/admin/projects", "/admin/story",
  "/admin/site-copy", "/admin/media", "/admin/translations", "/admin/connections", "/admin/settings",
  "/admin/marketing?tab=inbox", "/admin/marketing?tab=audience", "/admin/marketing?tab=campaigns", "/admin/marketing?tab=library", "/admin/marketing?tab=settings",
];

async function main() {
  const { NOW, answer } = await import(pathToFileURL(resolve(HERE, "admin-fixtures.mjs")).href);
  const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);
  const require = createRequire(resolve(WEB, "package.json"));
  const { chromium } = require("playwright-core");
  const env = (n, d) => (process.env[n] ? process.env[n].split(",") : d);
  const routes = env("ONLY", ROUTES);
  const only = env("PASSES", ["1280en", "390en", "1280he"]);
  const PASSES = [
    { id: "1280en", w: 1280, lang: "en" },
    { id: "390en", w: 390, lang: "en" },
    { id: "1280he", w: 1280, lang: "he" },
  ].filter((p) => only.includes(p.id));
  const WIDTHS = env("WIDTHS", null)?.map(Number);
  const LANGS = env("LANGS", null);

  const { base, stop } = await startPreview();
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });
  const findings = new Set();
  /* The passes share nothing, so they run side by side: about a third of the wall time. */
  const runPass = async (p) => {
    const coarse = p.w < 600;
    const ctx = await browser.newContext({ viewport: { width: p.w, height: coarse ? 844 : 900 }, isMobile: coarse, hasTouch: coarse, reducedMotion: "reduce", locale: p.lang === "he" ? "he-IL" : "en-US" });
    await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (r) => r.abort());
    let corpus = "";
    await ctx.route("**/api/**", (route) => {
      const u = new URL(route.request().url());
      const a = answer(u.pathname, route.request().method(), u.search);
      if (p.lang === "he") corpus += "\n" + corpusOf(a.body ?? {}).join("\n");
      return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
    });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(NOW));
    for (const route of routes) {
      await page.goto(`${base}${p.lang === "he" ? "/he" : ""}${route}`, { waitUntil: "load" });
      for (let i = 0; i < 60; i++) {
        if (await page.evaluate(() => !!document.querySelector("main") && !/Loading|טוען/.test(document.querySelector("main").textContent))) break;
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(300);
      const facts = await page.evaluate(collect, { coarse, motion: true });
      for (const k of evaluate({ ...facts, route, w: p.w, lang: p.lang, coarse, corpus })) findings.add(k);
    }
    await ctx.close();
  };
  await Promise.all(PASSES.filter((p) => !((WIDTHS && !WIDTHS.includes(p.w)) || (LANGS && !LANGS.includes(p.lang)))).map(runPass));
  await browser.close();
  await stop?.();

  const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
  const partial = !!(process.env.ONLY || process.env.PASSES || process.env.WIDTHS || process.env.LANGS);
  const list = [...findings].sort();
  if (process.env.PROBE) for (const k of list) console.log(`FINDING ${k}`);
  if (process.argv.includes("--write-initial")) {
    if (partial) throw new Error("--write-initial needs a full run");
    writeFileSync(BASELINE_FILE, JSON.stringify(list, null, 1) + "\n");
    console.log(`wrote ${list.length} lines`);
    process.exit(0);
  }
  const { added, stale } = compare(list, baseline);
  if (process.argv.includes("--update-baseline") && !partial) {
    const next = shrink(baseline, list);
    writeFileSync(BASELINE_FILE, JSON.stringify(next, null, 1) + "\n");
    console.log(`baseline: ${baseline.length} -> ${next.length} lines`);
    process.exit(0);
  }
  for (const k of added) console.log(`NEW ${k}`);
  if (!partial) for (const k of stale) console.log(`NOTICE fixed, delete the line (and lower the cap in adminRules.guard.test.ts): ${k}`);
  const per = Object.fromEntries(RULES.map((r) => [r, list.filter((k) => k.startsWith(r + "|")).length]));
  console.log(`counts ${JSON.stringify(per)}`);
  if (added.length) { console.error(`FAIL: ${added.length} finding(s) not in admin-rules-baseline.json. Fix them; the baseline only shrinks.`); process.exit(1); }
  console.log(`PASS: ${list.length} known finding(s), none new, on ${routes.length} screens.`);
  process.exit(0);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
