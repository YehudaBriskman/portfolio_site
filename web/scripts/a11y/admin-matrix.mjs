#!/usr/bin/env node
/*
 * Admin viewport matrix, held as a check (#660). Every admin route and key
 * state at 320 / 360 / 390 / 768 wide, in light and dark, en (LTR) and he (RTL)
 * on a reduced set of combinations. It exits 1 on:
 *   - horizontal overflow of the page (document wider than the viewport)
 *   - an interactive target under 24x24 CSS px (WCAG 2.2 AA 2.5.8), inline
 *     links in running text excepted
 *   - a primary control (button, nav item, tab, icon button, field) under
 *     44x44 on a coarse pointer (the phone widths)
 *   - readable text under 14px, outside the allowlist below
 *   - the fixed bottom bar taller than one 64px row
 * A finding listed in admin-matrix-baseline.json is known and does not fail;
 * a new one does. A screen that cannot load (error boundary, blank page) fails
 * too, so a broken fixture cannot pass as an empty report.
 *
 * Reuses site-stub.mjs (vite preview of the built site plus API fixtures);
 * the extra fixtures for marketing, audience, campaigns and the content
 * editors are below. No network: every request that is not localhost is
 * aborted.
 *
 *   npm run build
 *   npm run a11y:admin-matrix
 *   SHARD=1/2            run every 2nd combination (CI runs two legs)
 *   ONLY=media,settings  WIDTHS=320,390  THEMES=light  LANGS=en
 *   SHOTS=dir            also save a screenshot of every screen (FULLPAGE=1 for the whole page)
 *   --write-baseline     record today's findings as known
 *   --json file          the raw measurements
 *
 * Waits poll on a timer, never rAF (headless Chromium here has ~1 rAF / 40 s).
 */
import { createRequire } from "node:module";
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { createServer } = require("vite");
const { answer: baseAnswer, startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const JSON_OUT = arg("--json", null);
const BASELINE = resolve(HERE, "admin-matrix-baseline.json");

/* ------------------------------------------------------------- the matrix */
const VIEWPORTS = [
  { id: "320x568", w: 320, h: 568, mobile: true },
  { id: "360x740", w: 360, h: 740, mobile: true },
  { id: "390x844", w: 390, h: 844, mobile: true },
  { id: "768x1024", w: 768, h: 1024, mobile: false },
];
const vp = (id) => VIEWPORTS.find((x) => x.id === id);
/* Every width in light/en; the other axes where they differ. */
const COMBOS = [];
for (const v of VIEWPORTS) COMBOS.push({ v, theme: "light", lang: "en" });
for (const id of ["320x568", "390x844"]) COMBOS.push({ v: vp(id), theme: "dark", lang: "en" }, { v: vp(id), theme: "light", lang: "he" });
COMBOS.push({ v: vp("390x844"), theme: "dark", lang: "he" });
const env = (n) => (process.env[n] ?? "").split(",").filter(Boolean);
const [shardK, shardN] = (process.env.SHARD ?? "1/1").split("/").map(Number);
const combos = COMBOS.filter((_, i) => i % shardN === shardK - 1).filter((c) => (!env("WIDTHS").length || env("WIDTHS").includes(String(c.v.w)) || env("WIDTHS").includes(c.v.id)) && (!env("THEMES").length || env("THEMES").includes(c.theme)) && (!env("LANGS").length || env("LANGS").includes(c.lang)));

/* ---------------------------------------------------------------- fixtures */
const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const ago = (h) => new Date(NOW - h * 3_600_000).toISOString();
const vite = await createServer({ root: WEB, logLevel: "error", resolve: { preserveSymlinks: true }, server: { middlewareMode: true }, appType: "custom" });
const { seedBundle } = await vite.ssrLoadModule("/src/content/convert.ts");
const { DEFAULT_SENDER } = await vite.ssrLoadModule("/src/components/admin/announce/sender/defaults.ts");
const { DEFAULT_NOTIFY } = await vite.ssrLoadModule("/src/components/admin/announce/notify/defaults.ts");
const { DEFAULT_SETTINGS: SITE_DEFAULTS } = await vite.ssrLoadModule("/src/settings/schema.ts");
const SEED = seedBundle();
await vite.close();

const view = (key, published, draft = null, h = 30) => ({ ok: true, key, exists: true, _rev: "3-m", published, draft, updatedAt: ago(h), publishedAt: ago(h + 20), source: "admin" });
const CONTENT = { projects: view("projects", SEED.projects, SEED.projects, 5), story: view("story", SEED.story, null, 70), "site-copy": view("site-copy", SEED.siteCopy, null, 140) };
const SEO = { title: null, description: null, canonical: null, noindex: false };
const BODY = "A paragraph with a [link](/projects) and `code`.\n\n## Section\n\n- one\n- two\n\n```ts\nconst reallyLongIdentifierName = someFunction(argumentNumberOne, argumentNumberTwo, argumentNumberThree);\n```\n\n> quote\n\nClosing.";
const post = (slug, title, status, h, extra = {}) => {
  const c = { title, subtitle: null, excerpt: `${title}, in a sentence.`, body: BODY, tags: extra.tags ?? ["process"], collection: extra.collection ?? "site", coverImage: null, links: [], featured: null, publishedAt: status === "draft" ? null : ago(h + 48), seo: SEO, he: null };
  return { _id: `post:${slug}`, _rev: "2-m", slug, status, updatedAt: ago(h), readingMinutes: 4, changeNote: null, draft: extra.draft ? { ...c, body: `${BODY}\n\nUnpublished paragraph.` } : null, draftSavedAt: extra.draft ? ago(h) : null, ...c };
};
const POSTS = [
  post("admin-redesign", "Rebuilding the admin as a tool with a deliberately long title that has to wrap on a phone", "published", 2, { draft: true, tags: ["design", "admin", "a-rather-long-tag-name"] }),
  post("notes-editor", "An editor for notes", "draft", 9),
  post("theme-wave", "The theme change, as a wave", "published", 50),
  post("bothy-portal", "Bothy: one page for the whole box", "published", 160, { collection: "bothy" }),
  post("hebrew-part-two", "Hebrew, part two", "draft", 200),
  post("old-stack", "The stack, before the move", "archived", 900),
];
const area = (slug, title, kind, order, status = "published") => ({ _id: `collection:${slug}`, _rev: "1-m", slug, title, tagline: `${title}, in a line.`, kind, repo: kind === "project" ? { owner: "example", name: slug, branch: "main", docPaths: ["README.md"] } : null, stats: kind === "project" ? { stars: 12, language: "TypeScript", license: "MIT", pushedAt: ago(30), fetchedAt: ago(3), error: null } : null, description: `What ${title} is about.`, coverImage: null, icon: null, links: [], order, status });
const AREAS = [area("site", "The site", "site", 0), area("bothy", "Bothy", "project", 1), area("windom", "WindoM", "project", 2), area("lab", "Lab notes", "site", 3, "hidden")];
const GRANTS = [
  { id: "g1", client: "Claude", scopes: ["mcp:read", "mcp:write"], login: "owner", createdAt: ago(240), lastUsedAt: ago(1), expiresAt: ago(-1440), revokedAt: null, revokedReason: null, status: "active" },
  { id: "g3", client: "A test client", scopes: ["mcp:read"], login: "owner", createdAt: ago(1500), lastUsedAt: null, expiresAt: ago(200), revokedAt: ago(400), revokedReason: "owner", status: "revoked" },
];

/* Marketing */
const EVT = (id, kind, title, h, o = {}) => ({ id, kind, ref: id, title, url: `https://example.com/${id}`, langs: ["en", "he"], createdAt: ago(h), readAt: o.read ? ago(h - 1) : null, done: o.done ?? {}, dismissed: null });
const INBOX = [
  EVT("post:a", "post", "Rebuilding the admin as a tool with a deliberately long title that has to wrap on a phone", 2),
  EVT("release:b", "release", "Bothy v1.9.0", 20, { read: true, done: { linkedin: ago(5) } }),
  EVT("post:c", "post", "The theme change, as a wave", 60, { read: true }),
  EVT("custom:d", "custom", "A hand-made announcement", 90, { read: true }),
];
const KIT_ITEM = (t, limit) => ({ text: t, subject: "Subject line", limit, length: t.length, over: limit != null && t.length > limit });
const KIT = { en: { linkedin: KIT_ITEM("A new note is up: Rebuilding the admin. https://example.com/post-a #design", 3000), x: KIT_ITEM("New note: Rebuilding the admin https://example.com/post-a", 280), email: KIT_ITEM("Hello,\n\nA new note is up.", null) }, he: { linkedin: KIT_ITEM("נוספה רשומה חדשה: בניית הניהול מחדש", 3000) } };
const CAMP = (id, name, status, o = {}) => ({ id, _rev: "1-a", name, subject: `Subject of ${name}`, preheader: "", bodyText: "Hi\n\nthere", blocks: null, groups: ["subscribers"], lang: "all", topic: null, status, sendAt: null, counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, eventId: null, pausedReason: null, testedAt: null, capOverride: null, startedAt: null, finishedAt: null, createdAt: ago(100), updatedAt: ago(50), ...o });
const CAMPS = [
  CAMP("c1", "Spring news", "draft"),
  CAMP("c2", "Release announcement for Bothy 1.9 (a name long enough to wrap)", "sending", { counters: { queued: 120, sent: 80, failed: 2, suppressed: 1 }, startedAt: ago(2) }),
  CAMP("c3", "Sent one", "sent", { counters: { queued: 10, sent: 9, failed: 1, suppressed: 0 }, finishedAt: ago(70) }),
  CAMP("c4", "Paused by the sender", "paused", { pausedReason: "failure-rate" }),
];
const GROUPS = [{ slug: "subscribers", name: "Subscribers", kind: "system", count: 42, total: 42, active: 38 }, { slug: "friends", name: "Friends", kind: "manual", count: 5, total: 5, active: 5 }];
const CONSENT = { textId: "t1", textHash: "h", lang: "en", at: ago(500), confirmedAt: ago(499), source: "site" };
/* A dozen people: a list of four measures nothing. The first four are the awkward ones (long, Hebrew, no name, not mailable). */
const PEOPLE = ["ada.lovelace@example.com", "a-very-long-address-for-wrapping-checks@subdomain.example-company.co.il", "בדיקה@example.com", "grace@example.org", ...Array.from({ length: 8 }, (_, k) => `reader${k + 1}@example.net`)];
const CONTACTS = PEOPLE.map((email, i) => ({ hash: `h${i}`, email, name: i === 0 ? "Ada Lovelace" : i === 2 ? "שרה כהן" : i > 3 && i % 3 === 0 ? `Reader ${i - 3}` : null, lang: i === 2 || i % 4 === 3 ? "he" : "en", groups: i === 3 ? [] : ["subscribers"], status: i < 4 ? ["active", "pending", "active", "unsubscribed"][i] : i === 6 ? "suppressed" : "active", source: ["site", "manual", "import"][i % 3], consentAt: ago(500), consentNote: "Signed up on the site", consent: CONSENT, consentHistory: [CONSENT], topics: { blog: true, releases: i % 2 === 0 }, createdAt: ago(500), confirmedAt: ago(499), unsubscribedAt: null }));
const SENDER = { ...DEFAULT_SENDER, fromName: "Yehuda", fromAddress: "news@example.com", footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.com", testRecipients: ["me@example.com"] };
const ANNOUNCE_SETTINGS = { enabled: true, email: { enabled: true, events: ["post", "release"] }, hashtags: ["web", "design"], signature: "-- Y", channels: ["linkedin", "x", "email"], templates: { en: { x: "Hi {title}" }, he: {} }, snippets: [{ id: "s1", name: "Tags", kind: "hashtags", text: "#one #two" }], library: [{ id: "t1", name: "Launch", channel: "linkedin", lang: "en", text: "{title} {url}" }], advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } }, sender: SENDER, notify: DEFAULT_NOTIFY };
const BUDGET = { today: { used: 12, usable: 72, reserve: 18, room: 60 }, month: { used: 300, usable: 2430, room: 2130 }, capacity: 72, waiting: null, resumeAt: null, thresholds: [70, 90] };

const unanswered = new Set();
const failed = [];
function answer(path, method, search) {
  const p = path.replace(/^\/api/, "");
  if (method !== "GET" && !/\/(preview|audience)$/.test(p)) return { status: 503, body: { error: "The audit does not save." } };
  if (p === "/admin/posts") return { body: { ok: true, items: POSTS } };
  if (p.startsWith("/admin/posts/")) { const h = POSTS.find((x) => x.slug === decodeURIComponent(p.split("/")[3])); return h ? { body: { ok: true, post: h } } : { status: 404, body: { error: "Not found" } }; }
  if (p === "/admin/collections") return { body: { ok: true, items: AREAS } };
  if (p === "/admin/mcp/grants") return { body: { ok: true, items: GRANTS } };
  if (p.startsWith("/admin/content/")) { const v = CONTENT[p.split("/")[3]]; return v ? { body: v } : { status: 404, body: {} }; }
  if (p === "/content") return { body: { ok: true, ...SEED } };
  if (p === "/settings") return { body: { ok: true, settings: SITE_DEFAULTS } };
  if (p === "/admin/announce") return { body: { ok: true, unread: 1, items: INBOX } };
  if (p === "/admin/announce/settings") return { body: { ok: true, exists: true, _rev: "1-a", updatedAt: ago(3), settings: ANNOUNCE_SETTINGS } };
  if (/^\/admin\/announce\/[^/]+\/preview$/.test(p)) return { body: { ok: true, title: "Rebuilding the admin", description: "A description that is long enough to show the card.", image: "/api/images/media/x/preview.svg", imageWidth: 1200, imageHeight: 630, siteName: "Yehuda", url: "https://example.com/post-a", lang: "en", issues: [{ code: "description-long", field: "description", severity: "warn", limit: 160, length: 190 }] } };
  if (/^\/admin\/announce\/[^/]+$/.test(p)) return { body: { ok: true, siteOrigin: "https://example.com", event: { ...INBOX[0], summary: "A summary of the note.", tags: ["design"], version: null, custom: null }, kit: KIT } };
  if (p === "/admin/campaigns") return { body: { ok: true, campaigns: CAMPS } };
  if (p === "/admin/campaigns/sending") return { body: { ok: true, paused: false, pausedAt: null, envDisabled: false, blocked: false } };
  if (p === "/admin/campaigns/budget") return { body: { ok: true, ...BUDGET } };
  if (p === "/admin/campaigns/audience") return { body: { ok: true, count: 12, samples: ["a***@e***.com", "b***@e***.com"] } };
  if (p === "/admin/campaigns/preview") return { body: { ok: true, subject: "Subject", html: "<p>Hello there</p>", text: "Hello there" } };
  if (/^\/admin\/campaigns\/[^/]+$/.test(p)) { const c = CAMPS.find((x) => x.id === p.split("/")[3]); return c ? { body: { ok: true, campaign: c } } : { status: 404, body: {} }; }
  if (p === "/admin/audience/groups") return { body: { ok: true, items: GROUPS } };
  if (p === "/admin/audience/contacts") return { body: { ok: true, items: CONTACTS, nextCursor: "next" } };
  if (p === "/admin/audience/suppression") return { body: { ok: true, items: [{ hash: "s1", email: "blocked@example.com", since: ago(300) }] } };
  if (p === "/admin/audience/ledger") return { body: { ok: true, ready: true, counts: { unsubscribed: 3, suppressed: 1, erased: 0 }, report: null } };
  if (p === "/admin/audience/sweep") return { body: { ok: true, pendingTtlDays: 7, report: { at: ago(30), lastPurged: 2, totalPurged: 9, since: ago(900) } } };
  const b = baseAnswer(`http://x${path}${search}`, false);
  if (b.status === 404) unanswered.add(`${method} ${p}`);
  return { status: b.status, body: b.body };
}
const tint = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#3a6f8f"/></svg>';

/* ------------------------------------------------------------------ screens */
/* dispatchEvent, not click(): Playwright's click waits for a stable box, which needs animation frames, and this box's headless Chromium emits about one per 40 s. */
/* Audience: on a phone Add and Import sit behind the + sheet; wide, they are buttons in the toolbar. */
const addPeople = (item, wide) => async (page) => {
  const plus = page.getByRole("button", { name: /^(Add people|הוספת אנשים)$/ });
  if (await plus.count()) {
    await plus.dispatchEvent("click", {}, { timeout: 20000 });
    await page.getByRole("button", { name: item }).dispatchEvent("click", {}, { timeout: 8000 });
  } else await page.locator(wide).first().dispatchEvent("click", {}, { timeout: 20000 });
};
const click = (sel, n = 0) => async (page) => { await page.locator(sel).nth(n).dispatchEvent("click", {}, { timeout: 20000 }); };
const SCREENS = [
  ["overview", "/admin"],
  ["nav-drawer", "/admin", async (page) => { const b = page.locator("button[aria-controls]").first(); if (await b.isVisible()) await b.dispatchEvent("click", {}, { timeout: 5000 }); }],
  ["display-menu", "/admin", async (page) => { await page.locator(".a-top-end button").first().dispatchEvent("click", {}, { timeout: 5000 }); }],
  ["posts", "/admin/posts"],
  ["posts-filtered", "/admin/posts?status=draft"],
  ["post-editor", "/admin/posts/admin-redesign"],
  ["post-editor-preview", "/admin/posts/admin-redesign", async (page) => { await page.keyboard.press("Control+Shift+P").catch(() => {}); }],
  ["post-review-dialog", "/admin/posts/admin-redesign", async (page) => { await page.locator(".a-bottom button.a-btn-primary, .a-bar button.a-btn-primary").last().dispatchEvent("click", {}, { timeout: 8000 }); await page.getByRole("dialog").waitFor({ timeout: 8000 }); }],
  ["post-new", "/admin/posts/new"],
  ["areas", "/admin/areas"],
  ["area-edit", "/admin/areas/bothy"],
  ["projects", "/admin/projects"],
  ["story", "/admin/story"],
  ["site-copy", "/admin/site-copy"],
  ["media", "/admin/media"],
  ["media-item", "/admin/media?id=fixture-media"],
  ["media-video", "/admin/media?id=fixture-video"],
  ["settings", "/admin/settings"],
  /* The bar at its fullest: unsaved changes (a status sentence beside Undo and Save). */
  ["settings-dirty", "/admin/settings", async (page) => { await page.evaluate(() => document.querySelector("#settings-sharing-enabled").click()); }],
  ["connections", "/admin/connections"],
  ["translations", "/admin/translations"],
  ["translations-filtered", "/admin/translations?status=done&visibility=all"],
  ["marketing-inbox", "/admin/marketing"],
  ["marketing-composer", "/admin/marketing", click(".mk-row-main, [data-record-row]")],
  ["marketing-new", "/admin/marketing", click("button.a-btn-primary.mk-btn")],
  ["marketing-campaigns", "/admin/marketing?tab=campaigns"],
  ["marketing-campaign-composer-new", "/admin/marketing?tab=campaigns", click("button.a-btn-primary")],
  ["marketing-campaign-composer-open", "/admin/marketing?tab=campaigns", async (page) => { await page.getByRole("button", { name: /^(Open|פתיחת) / }).first().dispatchEvent("click", {}, { timeout: 20000 }); }],
  ["marketing-audience", "/admin/marketing?tab=audience"],
  ["marketing-contact-sheet", "/admin/marketing?tab=audience", click("table tbody tr button, [data-record-row]")],
  ["marketing-add-contact", "/admin/marketing?tab=audience", addPeople(/^(Add contact|הוספת איש קשר)$/, "button.a-btn-primary")],
  ["marketing-import", "/admin/marketing?tab=audience", addPeople(/^(Import CSV|ייבוא CSV)$/, "div.flex.flex-wrap.gap-2 > button:not(.a-btn-primary)")],
  ["marketing-audience-select", "/admin/marketing?tab=audience", async (page) => { const b = page.getByRole("button", { name: /^(Select|בחירה)$/ }); if (await b.count()) { await b.dispatchEvent("click", {}, { timeout: 8000 }); await page.locator("[data-record-row]").nth(0).dispatchEvent("click", {}, { timeout: 8000 }); } }],
  ["marketing-audience-expanded", "/admin/marketing?tab=audience", async (page) => { await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true))); }],
  ["marketing-library", "/admin/marketing?tab=library"],
  ["marketing-settings", "/admin/marketing?tab=settings"],
  /* On a phone Settings is a list of groups: a sheet (two switches), and the heaviest pages with every section open. */
  ["marketing-settings-sheet", "/admin/marketing?tab=settings", async (page) => { const row = page.locator('[data-settings-group="mail"] button'); /* from 600px the form is the desktop one and has no group rows */ if (await row.count()) await row.dispatchEvent("click", {}, { timeout: 20000 }); }],
  ["marketing-settings-expanded", "/admin/marketing?tab=settings&section=sender", async (page) => { await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true))); }],
  ["marketing-settings-limits", "/admin/marketing?tab=settings&section=limits", async (page) => { await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true))); }],
  ["not-found-admin", "/admin/does-not-exist"],
];
const ONLY = env("ONLY");

/* ------------------------------------------------------ in-page measurement */
/* Text that may stay under 14px: key caps and code samples, never the only carrier of meaning. */
const ALLOW_TEXT = ["kbd", "pre"];
/* The controls a thumb has to hit: held to 44x44 on a coarse pointer. */
const PRIMARY = ".a-btn, .a-icon-btn, .a-nav-item, .a-tab, .a-input, .a-select";
function measure({ allowText, primary }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = { overflow: [], smallText: [], smallTargets: [], tinyTargets: [] };
  const coarse = matchMedia("(pointer: coarse)").matches;
  const sel = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter((c) => c && !/^(min-|w-|h-|px|py|mt|mb)/.test(c)).slice(0, 2).join(".") : "";
    const label = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${cls ? "." + cls : ""}${label ? ` "${label}"` : ""}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return false;
    if (cs.clipPath === "inset(50%)") return false;
    return true;
  };
  /* A box that scrolls or clips on purpose: an `auto`/`scroll` container, or a `hidden` one narrower than the page (a card). The shell clips at exactly the page width and is not one, or it would hide the very overflow this looks for. */
  const inScroller = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); const o = cs.overflowX; if (o === "auto" || o === "scroll") { if (a.scrollWidth > a.clientWidth) return a; } else if ((o === "hidden" || o === "clip") && a.getBoundingClientRect().width < vw - 1 && a.scrollWidth > a.clientWidth) return a; } return null; };
  const underFixed = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === "fixed") return true; return false; };

  /* 1. horizontal overflow: the document scrolls sideways, or something sits past an edge the shell clips (a clipped control is as lost as a scrolled one) */
  const de = document.documentElement;
  {
    const offenders = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (!(r.right > vw + 1 || r.left < -1)) continue;
      if (inScroller(el) || underFixed(el) || el.closest("[aria-hidden='true'], .sr-only")) continue;
      offenders.push({ el: sel(el), right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) });
    }
    if (offenders.length || de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1) out.overflow.push({ scrollWidth: de.scrollWidth, vw, offenders: offenders.slice(0, 6) });
  }

  /* 1b. the fixed bottom bar stays one row: at most 64px (a taller bar hides a quarter of a phone) */
  const bar = document.querySelector(".a-bottom");
  if (bar && visible(bar)) { const h = Math.round(bar.getBoundingClientRect().height); if (h > 64) out.bar = { h }; }

  /* 2. text under 14px (CSS px), one entry per element that directly holds text */
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const leaves = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || seen.has(el) || ["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(el.tagName)) continue;
    seen.add(el);
    if (!visible(el) || el.closest("[aria-hidden='true'], .sr-only")) continue;
    leaves.push(el);
  }
  for (const el of leaves) {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 14 && !el.closest(allowText)) out.smallText.push({ el: sel(el), px: +fs.toFixed(1) });
  }

  /* 3. interactive targets */
  const T = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=switch], [role=menuitem]';
  const targets = [...document.querySelectorAll(T)].filter((el) => visible(el) && !el.disabled && !el.closest(".a-skip"));
  const isInline = (el) => el.tagName === "A" && getComputedStyle(el).display === "inline" && !!el.closest("p, li, dd, td, label, small") && (el.parentElement?.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 3;
  for (const el of targets) {
    let r = el.getBoundingClientRect();
    if (el.tagName === "INPUT" && /checkbox|radio/.test(el.type)) {
      const l = el.closest("label") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
      if (l) { const lr = l.getBoundingClientRect(); if (lr.width * lr.height > r.width * r.height) r = lr; }
    }
    /* visually hidden controls (sr-only file/radio inputs, skip links until focused): judged by their visible label, or not at all */
    if (r.width <= 1 && r.height <= 1) { const l = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l && l.getBoundingClientRect().width > 1) r = l.getBoundingClientRect(); else continue; }
    const w = Math.round(r.width), h = Math.round(r.height);
    if (isInline(el)) continue;
    if (w < 24 || h < 24) out.tinyTargets.push({ el: sel(el), w, h });
    else if (coarse && (w < 44 || h < 44) && el.matches(primary)) out.smallTargets.push({ el: sel(el), w, h });
  }

  return out;
}

/* --------------------------------------------------------------------- run */
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none", "--disable-gpu"] });
const results = [];
for (const c of combos) {
  const ctx = await browser.newContext({ viewport: { width: c.v.w, height: c.v.h }, deviceScaleFactor: c.v.dsf ?? 1, isMobile: c.v.mobile, hasTouch: c.v.mobile, reducedMotion: "reduce", colorScheme: c.theme, locale: c.lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, c.theme);
  /* Never touch a live host: anything not on the preview server is dropped (also keeps `load` from waiting on a blocked font CDN). */
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/api/images/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: tint });
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  if (process.env.DEBUG) page.on("console", (m) => m.type() === "error" && console.log("  console:", m.text().slice(0, 400)));
  page.on("pageerror", (e) => console.log("pageerror", e.message.split("\n")[0]));
  for (const [name, path, step] of SCREENS) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const t0 = Date.now();
    const rec = { screen: name, viewport: c.v.id, theme: c.theme, lang: c.lang, path: (c.lang === "he" ? "/he" : "") + path };
    try {
      /* A step that fails is tried once more on a fresh load (the first page of a cold run can lose a race); failing twice fails the run. */
      for (let attempt = 0; attempt < 2; attempt++) {
        delete rec.stepFailed;
        await page.goto(`${base}${rec.path}`, { waitUntil: "load" });
        for (let i = 0; i < 40; i++) { const ok = await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? "") && [...document.images].every((im) => im.complete || !im.getAttribute("src")); }); if (ok) break; await page.waitForTimeout(250); }
        if (!step) break;
        try { await step(page); await page.waitForTimeout(500); break; } catch (e) { rec.stepFailed = e.message.split("\n")[0]; if (process.env.DEBUG) console.log(e.message.slice(0, 900)); }
      }
      await page.evaluate(() => document.fonts.ready);
      Object.assign(rec, await page.evaluate(measure, { allowText: ALLOW_TEXT.join(","), primary: PRIMARY }));
      /* A fixture that does not load is a failure, not an empty report: the error boundary, or a blank main. */
      rec.broken = await page.evaluate(() => { const m = document.querySelector("main"); const t = (m?.textContent ?? "").trim(); return !m ? "no main" : t.length < 20 ? "blank main" : /Something went wrong|משהו השתבש/.test(document.body.textContent ?? "") ? "error boundary" : ""; });
      if (rec.broken) console.log("  body:", (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 300));
      if (process.env.DEBUG) console.log("  main:", (await page.evaluate(() => document.querySelector("main")?.innerText ?? "")).replace(/\s+/g, " ").slice(0, 250));
      rec.dir = await page.evaluate(() => `${document.documentElement.lang}/${document.documentElement.dir}`);
      if (process.env.SHOTS) await page.screenshot({ path: resolve(process.env.SHOTS, `${name}-${c.v.w}-${c.theme}-${c.lang}.png`), fullPage: !!process.env.FULLPAGE, timeout: 120000 });
    } catch (e) { rec.error = e.message.split("\n")[0]; }
    rec.ms = Date.now() - t0; results.push(rec);
    console.log(`${rec.ms}ms ${name} ${c.v.id} ${c.theme} ${c.lang}: overflow ${rec.overflow?.length ?? "?"} tiny ${rec.tinyTargets?.length ?? "?"} small ${rec.smallTargets?.length ?? "?"} text ${rec.smallText?.length ?? "?"}${rec.broken ? " BROKEN " + rec.broken : ""}${rec.stepFailed ? " STEPFAIL " + rec.stepFailed : ""}${rec.error ? " ERR " + rec.error : ""}`);
  }
  await ctx.close();
}
await browser.close();
stop();
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ unanswered: [...unanswered], results }, null, 1));
if (unanswered.size) console.log("API paths the fixtures do not answer:", [...unanswered].join(", "));

/* ---------------------------------------------------------------- verdict */
/* A finding is keyed by kind, screen and element, not by viewport: one known fault is one line. */
const known = (() => { try { return new Set(JSON.parse(readFileSync(BASELINE, "utf8"))); } catch (e) { if (e.code === "ENOENT") return new Set(); throw e; } })();
/* The label, the generated id (useId) and hashed CSS-module classes are dropped: they change with the build, the element does not. */
const bk = (kind, screen, el) => `${kind}|${screen}|${(el ?? "").replace(/ ".*$/, "").replace(/#[^.\s]+/, "").replace(/\._[^.\s]+/g, "")}`;
const found = new Map();
const add = (key, msg) => { if (!found.has(key)) found.set(key, msg); };
for (const r of results) {
  const tag = `${r.screen} ${r.viewport} ${r.theme} ${r.lang}`;
  if (r.error) { add(`error|${r.screen}`, `${tag}: ERROR ${r.error}`); continue; }
  if (r.stepFailed) add(`step|${r.screen}`, `${tag}: the screen's step failed (${r.stepFailed})`);
  if (r.broken) add(`broken|${r.screen}`, `${tag}: screen did not load (${r.broken})`);
  if (r.bar) add(`bar|${r.screen}`, `${tag}: bottom bar is ${r.bar.h}px tall, more than one 64px row`);
  for (const o of r.overflow) add(bk("overflow", r.screen, o.offenders[0]?.el), `${tag}: horizontal overflow (${o.scrollWidth} > ${o.vw}) ${o.offenders.map((x) => x.el).slice(0, 3).join(" | ")}`);
  for (const t of r.tinyTargets) add(bk("tiny", r.screen, t.el), `${tag}: target ${t.w}x${t.h} < 24 ${t.el}`);
  for (const t of r.smallTargets) add(bk("coarse", r.screen, t.el), `${tag}: primary control ${t.w}x${t.h} < 44 at a coarse pointer ${t.el}`);
  for (const t of r.smallText) add(bk("text", r.screen, t.el), `${tag}: text ${t.px}px < 14 ${t.el}`);
}
if (process.argv.includes("--write-baseline")) {
  const keys = [...found.keys()].filter((k) => !/^(error|broken|bar|step)\|/.test(k)).sort();
  writeFileSync(BASELINE, JSON.stringify(keys, null, 1) + "\n");
  console.log(`baseline: ${keys.length} known findings`);
  process.exit(0);
}
const fails = [...found].filter(([k]) => !known.has(k)).map(([, m]) => m);
if (fails.length) { console.log(`\nFAIL: ${fails.length}`); for (const f of fails.slice(0, 80)) console.log(" ", f); process.exit(1); }
console.log(`\nPASS: ${results.length} page measurements, ${found.size} known finding(s) in the baseline.`);
