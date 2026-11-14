/*
 * Fixtures shared by the admin measuring scripts (density-matrix, admin-density-phone):
 * bigger than a real site (10-20 records per list) because a list of 2 measures nothing.
 * `answer(path, method, search)` is the API stub; everything else answers from site-stub.mjs.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { createServer } = require("vite");
const { answer: baseAnswer } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);

/* ---------------------------------------------------------------- fixtures */
export const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const ago = (h) => new Date(NOW - h * 3_600_000).toISOString();
const vite = await createServer({ root: WEB, logLevel: "error", resolve: { preserveSymlinks: true }, server: { middlewareMode: true }, appType: "custom" });
const { seedBundle } = await vite.ssrLoadModule("/src/content/convert.ts");
const { DEFAULT_SENDER } = await vite.ssrLoadModule("/src/components/admin/announce/sender/defaults.ts");
const { DEFAULT_NOTIFY } = await vite.ssrLoadModule("/src/components/admin/announce/notify/defaults.ts");
const { DEFAULT_SETTINGS: SITE_DEFAULTS } = await vite.ssrLoadModule("/src/settings/schema.ts");
export const SEED = seedBundle();
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

export const unanswered = new Set();
export function answer(path, method, search) {
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
  if (p === "/admin/signature") return { body: { ok: true, show: { email: false, posts: false, cards: false }, slots: { en: null, he: null } } };
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
export const tint = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#3a6f8f"/></svg>';
