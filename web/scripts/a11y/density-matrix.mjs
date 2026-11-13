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
 *
 * Metrics (all light/en; "fold" = what intersects the first viewport at scroll 0;
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
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const TMP = resolve(tmpdir(), "density-matrix");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { createServer } = require("vite");
const { answer: baseAnswer, startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

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
const CONTACTS = ["ada.lovelace@example.com", "a-very-long-address-for-wrapping-checks@subdomain.example-company.co.il", "בדיקה@example.com", "grace@example.org"].map((email, i) => ({ hash: `h${i}`, email, name: i === 0 ? "Ada Lovelace" : i === 2 ? "שרה כהן" : null, lang: i === 2 ? "he" : "en", groups: i === 3 ? [] : ["subscribers"], status: ["active", "pending", "active", "unsubscribed"][i], source: "site", consentAt: ago(500), consentNote: "Signed up on the site", consent: CONSENT, consentHistory: [CONSENT], topics: { blog: true, releases: i % 2 === 0 }, createdAt: ago(500), confirmedAt: ago(499), unsubscribedAt: null }));
const SENDER = { ...DEFAULT_SENDER, fromName: "Yehuda", fromAddress: "news@example.com", footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.com", testRecipients: ["me@example.com"] };
const ANNOUNCE_SETTINGS = { enabled: true, email: { enabled: true, events: ["post", "release"] }, hashtags: ["web", "design"], signature: "-- Y", channels: ["linkedin", "x", "email"], templates: { en: { x: "Hi {title}" }, he: {} }, snippets: [{ id: "s1", name: "Tags", kind: "hashtags", text: "#one #two" }], library: [{ id: "t1", name: "Launch", channel: "linkedin", lang: "en", text: "{title} {url}" }], advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } }, sender: SENDER, notify: DEFAULT_NOTIFY };
const BUDGET = { today: { used: 12, usable: 72, reserve: 18, room: 60 }, month: { used: 300, usable: 2430, room: 2130 }, capacity: 72, waiting: null, resumeAt: null, thresholds: [70, 90] };


/* ------------------------------------------- bigger fixtures (10-20 records) */
const TITLES = ["Why the admin has one list per screen", "Hebrew, right to left, all the way down", "A settings page that remembers", "The week the build went green", "Notes on a box under the desk", "Backups, and the day I tested one", "Tailnet performance: measure the peer", "What a status pill is for", "Campaigns without a mailing-list vendor", "Reading a diff before you publish", "Media: alt text is not optional", "The story page, rewritten", "A small design system, honestly", "Why there is no dashboard", "Moving the stack to a new disk", "Three kinds of empty state"];
TITLES.forEach((t, i) => POSTS.push(post(`gen-${i}`, t, ["published", "draft", "published", "archived"][i % 4], 24 * (i + 3), { draft: i % 3 === 0, tags: [["design", "admin"], ["process"], ["hebrew", "i18n", "rtl"], ["ops"]][i % 4], collection: ["site", "bothy", "windom"][i % 3] })));
["Lab notes", "Reading list", "Home lab", "Open source", "Talks"].forEach((t, i) => AREAS.push(area(`gen-${i}`, t, i % 2 ? "project" : "site", 4 + i, i === 4 ? "hidden" : "published")));
["Cursor", "Claude desktop", "A script", "Zed", "VS Code"].forEach((c, i) => GRANTS.push({ id: `gx${i}`, client: c, scopes: i % 2 ? ["mcp:read"] : ["mcp:read", "mcp:write"], login: "owner", createdAt: ago(300 + i * 90), lastUsedAt: i % 3 ? ago(i * 7) : null, expiresAt: ago(-1000 + i * 400), revokedAt: i === 3 ? ago(20) : null, revokedReason: i === 3 ? "owner" : null, status: i === 3 ? "revoked" : i === 4 ? "expired" : "active" }));
["Bothy v1.8.2", "Notes on tailscale", "Spring update", "WindoM 0.4", "A talk at the meetup", "Site v1.4.2", "Hebrew part three", "The backups note"].forEach((t, i) => INBOX.push(EVT(`post:g${i}`, ["post", "release", "custom"][i % 3], t, 100 + i * 30, { read: i > 1, done: i % 3 === 1 ? { linkedin: ago(90) } : {} })));
["Autumn notes", "Bothy 1.8 release", "Monthly digest", "WindoM beta", "Hebrew launch", "Meetup invite", "Year in review", "Quiet week"].forEach((n, i) => CAMPS.push(CAMP(`cg${i}`, n, ["sent", "draft", "sent", "scheduled", "sent", "draft", "failed", "sent"][i], { counters: { queued: 40 + i, sent: 38 + i, failed: i % 3, suppressed: i % 2 }, finishedAt: ago(200 + i * 40), sendAt: i === 3 ? ago(-48) : null })));
const CGEN = ["noam", "tamar", "lior", "dana", "omer", "yael", "eyal", "maya", "gal", "shira", "amit", "roni"];
CGEN.forEach((n, i) => CONTACTS.push({ ...CONTACTS[3], hash: `hg${i}`, email: `${n}@example.${["com", "org", "co.il"][i % 3]}`, name: i % 2 ? `${n[0].toUpperCase()}${n.slice(1)} Levi` : null, lang: i % 4 === 0 ? "he" : "en", status: ["active", "active", "pending", "active", "unsubscribed"][i % 5], groups: i % 3 === 0 ? ["friends"] : ["subscribers"] }));

const SWATCH = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#3a6f8f"/></svg>')}`;
const mediaItem = (id, alt, usedBy, extra = {}) => ({ id, _rev: "1-a", name: `${id}.jpg`, alt, caption: "", credit: "", kind: "image", format: "jpeg", mime: "image/jpeg", file: null, width: 1600, height: 1200, bytes: 184_000, createdAt: ago(72), updatedAt: ago(72), url: `https://example.com/api/images/media/${id}`, preview: SWATCH, srcset: { avif: "", webp: "" }, largest: { avif: null, webp: SWATCH }, usedBy, ...extra });
const MEDIA = [
  mediaItem("fixture-media", "A cabin under the aurora, with a clock and a greeting over it.", [{ id: "collection:site", type: "collection", title: "The site", slug: "site", field: "coverImage" }], { he: { alt: "בקתה תחת זוהר הצפון", caption: "" } }),
  mediaItem("unused-media", "An orange sports car on a coastal highway.", []),
  mediaItem("fixture-icon", "A leaf.", [], { kind: "icon", format: "svg", mime: "image/svg+xml", file: SWATCH, monochrome: true, width: 24, height: 24, bytes: 412 }),
  mediaItem("fixture-video", "A walk through the dashboard, from the list to one item.", [], { kind: "video", format: "mp4", mime: "video/mp4", file: "/api/images/m/fixture-video/video-aaaaaaaaaaaaaaaa.mp4", durationMs: 12_000, hasAudio: false, captions: { url: "/api/images/m/fixture-video/captions-b.vtt", lang: "en", label: "English" }, tracks: [{ url: "/api/images/m/fixture-video/captions-b.vtt", lang: "en", label: "English" }, { url: "/api/images/m/fixture-video/captions-c.vtt", lang: "he", label: "עברית" }] }),
];
["A desk with two monitors", "The box under the desk", "A diagram of the tailnet", "A screenshot of the portal", "Tel Aviv at dusk", "A terminal, mid-deploy", "A hand-drawn sketch of the admin", "The cabin, in winter", "A cover for the backups note", "A leaf, larger"].forEach((a, i) => MEDIA.push(mediaItem(`gen-media-${i}`, a, i % 3 ? [{ id: `post:gen-${i}`, type: "post", title: TITLES[i], slug: `gen-${i}`, field: "coverImage" }] : [])));

const SETTINGS_VIEW = { ok: true, exists: true, _rev: "7-m", version: 7, updatedAt: ago(5), settings: SITE_DEFAULTS, history: [0, 1, 2, 3, 4, 5, 6].map((v) => ({ version: v, at: ago(24 * (8 - v)), settings: SITE_DEFAULTS })) };

const tu = (path, status, primary = true) => ({ path, status, primary, en: path, he: status === "missing" || status === "draft" ? null : "עברית", draftHe: status === "draft" ? "טיוטה" : null });
const TSTAT = ["missing", "stale", "unverified", "translated", "draft", "missing", "translated", "stale"];
const TRANS_ITEMS = [];
["Home · hero", "Home · approach", "Home · city", "Home · contact", "Footer", "Nav"].forEach((t, i) => TRANS_ITEMS.push({ type: "site-copy", id: `sc${i}`, title: t, route: "/", rank: i, visibility: "public", status: TSTAT[i], units: [tu("title", TSTAT[i]), tu("phrases.0", TSTAT[(i + 1) % 8]), tu("phrases.1", "translated")] }));
SEED.projects.items.slice(0, 5).forEach((p, i) => TRANS_ITEMS.push({ type: "project", id: p.slug, title: p.title, route: `/projects/${p.slug}`, rank: 10 + i, visibility: "public", status: TSTAT[(i + 2) % 8], units: [tu("fact", TSTAT[(i + 2) % 8]), tu("description", "translated"), tu("decisions.0.body", "missing", false)] }));
["Story · start", "Story · middle", "Story · now"].forEach((t, i) => TRANS_ITEMS.push({ type: "story", id: `st${i}`, title: t, route: "/story", rank: 30 + i, visibility: "public", status: TSTAT[(i + 4) % 8], units: [tu("title", TSTAT[(i + 4) % 8]), tu("lines.0", "translated")] }));
POSTS.slice(0, 6).forEach((p, i) => TRANS_ITEMS.push({ type: "post", id: p.slug, title: p.title, route: `/blog/${p.slug}`, rank: 100 + i, visibility: p.status === "draft" ? "private" : "public", status: TSTAT[i], units: [tu("title", TSTAT[i]), tu("body", TSTAT[i])] }));
const count = (s) => TRANS_ITEMS.filter((x) => x.status === s).length;
const TRANSLATIONS = { ok: true, counts: { missing: count("missing"), draft: count("draft"), stale: count("stale"), unverified: count("unverified"), translated: count("translated") }, coverage: 42, items: TRANS_ITEMS };

const unanswered = new Set();
function answer(path, method, search) {
  const p = path.replace(/^\/api/, "");
  if (method !== "GET" && !/\/(preview|audience)$/.test(p)) return { status: 503, body: { error: "The audit does not save." } };
  if (p === "/admin/posts") return { body: { ok: true, items: POSTS } };
  if (p.startsWith("/admin/posts/")) { const h = POSTS.find((x) => x.slug === decodeURIComponent(p.split("/")[3])); return h ? { body: { ok: true, post: h } } : { status: 404, body: { error: "Not found" } }; }
  if (p === "/admin/collections") return { body: { ok: true, items: AREAS } };
  if (p === "/admin/mcp/grants") return { body: { ok: true, items: GRANTS } };
  if (p === "/admin/media") return { body: { ok: true, items: MEDIA } };
  if (p === "/admin/translations") return { body: TRANSLATIONS };
  if (p === "/admin/settings") return { body: SETTINGS_VIEW };
  if (p.startsWith("/admin/content/")) { const v = CONTENT[p.split("/")[3]]; return v ? { body: v } : { status: 404, body: {} }; }
  if (p === "/content") return { body: { ok: true, ...SEED } };
  if (p === "/settings") return { body: { ok: true, settings: SITE_DEFAULTS } };
  if (p === "/admin/announce") return { body: { ok: true, unread: 3, items: INBOX } };
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
  if (p === "/admin/audience/suppression") return { body: { ok: true, items: [{ hash: "s1", email: "blocked@example.com", since: ago(300) }, { hash: "s2", email: "bounced@example.org", since: ago(900) }] } };
  if (p === "/admin/audience/ledger") return { body: { ok: true, ready: true, counts: { unsubscribed: 3, suppressed: 1, erased: 0 }, report: null } };
  if (p === "/admin/audience/sweep") return { body: { ok: true, pendingTtlDays: 7, report: { at: ago(30), lastPurged: 2, totalPurged: 9, since: ago(900) } } };
  const b = baseAnswer(`http://x${path}${search}`, false);
  if (b.status === 404) unanswered.add(`${method} ${p}`);
  return { status: b.status, body: b.body };
}
const tint = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#3a6f8f"/></svg>';

/* ------------------------------------------------------------------ screens */
/* [name, group, route, step?]  A step returns "skip" when the state does not exist on this screen. */
const click = (sel, n = 0) => async (page) => { await page.locator(sel).nth(n).click({ force: true, timeout: 20000 }); };
const openAll = async (page) => { const n = await page.evaluate(() => { const c = [...document.querySelectorAll("details:not([open])")]; c.forEach((d) => (d.open = true)); return c.length; }); return n ? undefined : "skip"; };
const byName = (re) => async (page) => { await page.getByRole("button", { name: re }).first().click({ force: true, timeout: 20000 }); };
const tabN = (n) => click('[role="tablist"] [role="tab"]', n);
const mkTab = (t) => async (page) => { await page.getByRole("tab", { name: t }).first().click({ force: true, timeout: 20000 }); };
const SCREENS = [
  ["overview", "Overview", "/admin"],
  ["nav-drawer", "Shell", "/admin", async (page) => { await page.getByRole("button", { name: "Menu", exact: true }).first().click({ force: true, timeout: 20000 }); }],
  ["display-menu", "Shell", "/admin", async (page) => { await page.locator('button[aria-haspopup="dialog"]').first().click({ force: true, timeout: 20000 }); }],
  ["posts", "Posts", "/admin/posts"],
  ["posts-draft", "Posts", "/admin/posts?status=draft"],
  ["posts-published", "Posts", "/admin/posts?status=published"],
  ["posts-archived", "Posts", "/admin/posts?status=archived"],
  ["post-editor", "Posts", "/admin/posts/admin-redesign"],
  ["post-editor-expanded", "Posts", "/admin/posts/admin-redesign", openAll],
  ["post-editor-he", "Posts", "/admin/posts/admin-redesign", byName(/^Hebrew$/)],
  ["post-editor-both", "Posts", "/admin/posts/admin-redesign", click('[class*="toggleGroup"] button', 2)],
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
  ["marketing-campaign-expanded", "Marketing", "/admin/marketing?tab=campaigns", async (page) => { await page.getByRole("button", { name: /^(Open|פתיחת) Spring/ }).first().click({ force: true, timeout: 20000 }); await page.waitForTimeout(600); return openAll(page); }],
  ["marketing-audience", "Marketing", "/admin/marketing?tab=audience"],
  ["marketing-contact-sheet", "Marketing", "/admin/marketing?tab=audience", click("table tbody tr button")],
  ["marketing-add-contact", "Marketing", "/admin/marketing?tab=audience", click("button.a-btn-primary")],
  ["marketing-import", "Marketing", "/admin/marketing?tab=audience", click("div.flex.flex-wrap.gap-2 > button:not(.a-btn-primary)")],
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
  const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].filter(vis);
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
  const ctl = [...root.querySelectorAll(CTL)].filter((el) => vis(el) && !el.closest(".sr-only"));
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
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce", colorScheme: "light", locale: "en-US" });
  await ctx.addInitScript(() => { try { localStorage.setItem("yb-theme", "light"); } catch { /* colorScheme carries it */ } });
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
  await page.goto(`${base}${path}`, { waitUntil: "load" });
  for (let i = 0; i < 40; i++) { const ok = await page.evaluate(() => { const m = document.querySelector("main"); return !!m && !/Loading|טוען/.test(m.textContent ?? "") && [...document.images].every((im) => im.complete || !im.getAttribute("src")); }); if (ok) break; await page.waitForTimeout(250); }
  if (step) { try { const r = await step(page); if (r === "skip") rec.skip = true; await page.waitForTimeout(600); } catch (e) { rec.stepFailed = e.message.split("\n")[0]; } }
  await page.evaluate(() => document.fonts.ready);
}
const results = [];
const todo = SCREENS.filter((s) => !ONLY.length || ONLY.includes(s[0]));
for (const v of VPS) {
  const { ctx, page } = await newPage(v);
  for (const s of todo) {
    const rec = { screen: s[0], group: s[1], route: s[2], viewport: v.id };
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
