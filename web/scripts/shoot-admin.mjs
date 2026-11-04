/*
 * Every admin screen (#288), in both themes, at 1440 and 390, into
 * `docs/admin-redesign/<stage>/`.
 *
 *   npm run build
 *   xvfb-run -a node scripts/shoot-admin.mjs before   # or: after
 *
 * Starts `vite preview` itself (BASE overrides). Every /api/ request is
 * answered here from fixtures, so the shots need no API and no login; the
 * content editors are fed the site's own built-in content, loaded through
 * Vite so the fixture is the real seed and not a copy of it. The clock is
 * fixed, so "3h ago" is the same in every run. Waits poll on a timer, never
 * on rAF: headless Chromium on this box has almost no frame clock.
 *
 * ONLY=posts,media narrows a run to some screens; WIDTHS=1440 to one width.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { startPreview } from "./a11y/site-stub.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");
const STAGE = process.argv[2] ?? "after";
const OUT = resolve(WEB, "../docs/admin-redesign", STAGE);
mkdirSync(OUT, { recursive: true });

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);
const ago = (h) => new Date(NOW - h * 3_600_000).toISOString();

/* ------------------------------------------------------------- the seed */

const vite = await createServer({ root: WEB, logLevel: "error", server: { middlewareMode: true }, appType: "custom" });
const { seedBundle } = await vite.ssrLoadModule("/src/content/convert.ts");
const SEED = seedBundle();
await vite.close();

const contentView = (key, published, draft = null, h = 30) => ({
  ok: true,
  key,
  exists: true,
  _rev: "3-shot",
  published,
  draft,
  updatedAt: ago(h),
  publishedAt: ago(h + 20),
  source: "admin",
});
const CONTENT = {
  projects: contentView("projects", SEED.projects, SEED.projects, 5),
  story: contentView("story", SEED.story, null, 70),
  "site-copy": contentView("site-copy", SEED.siteCopy, null, 140),
};

/* ------------------------------------------------------------ fixtures */

const SEO = { title: null, description: null, canonical: null, noindex: false };
const BODY = `The admin is a tool somebody works in every day, so it should read like one.

## What changed

- A top bar with the way back to the site.
- Lists you can scan down.

\`\`\`ts
const dense = true;
\`\`\`

### Why a fixed bar

Save has one home at every width, so the hand learns where it is. The page is
padded by the bar's measured height, and nothing scrolls out from under it.

> A tool you open every day should not need reading twice.

The lists are tables, the editors are boxes, and the status is a word.

The preview uses the reader's own type, so what you see is what a reader gets.

Closing paragraph.`;

function post(slug, title, status, h, extra = {}) {
  const content = {
    title,
    subtitle: null,
    excerpt: `${title}, in a sentence.`,
    body: BODY,
    tags: extra.tags ?? ["process"],
    collection: extra.collection ?? "site",
    coverImage: null,
    links: [],
    featured: null,
    publishedAt: status === "draft" ? null : ago(h + 48),
    seo: SEO,
    he: null,
  };
  return {
    _id: `post:${slug}`,
    _rev: "2-shot",
    slug,
    status,
    updatedAt: ago(h),
    readingMinutes: extra.minutes ?? 4,
    changeNote: null,
    draft: extra.draft ? { ...content, body: `${BODY}\n\nOne more paragraph, not yet published.` } : null,
    draftSavedAt: extra.draft ? ago(h) : null,
    ...content,
  };
}

const POSTS = [
  post("admin-redesign", "Rebuilding the admin as a tool", "published", 2, { draft: true, tags: ["design", "admin"], minutes: 6 }),
  post("notes-editor", "An editor for notes", "draft", 9, { tags: ["admin"], minutes: 5 }),
  post("theme-wave", "The theme change, as a wave", "published", 50, { tags: ["motion"], minutes: 3 }),
  post("contrast-controls", "Text size and contrast controls", "published", 74, { tags: ["accessibility"], minutes: 7 }),
  post("bothy-portal", "Bothy: one page for the whole box", "published", 160, { collection: "bothy", tags: ["bothy", "infra"], minutes: 9 }),
  post("hebrew-part-two", "Hebrew, part two", "draft", 200, { tags: ["i18n"], minutes: 2 }),
  post("old-stack", "The stack, before the move", "archived", 900, { tags: ["infra"], minutes: 4 }),
];

const area = (slug, title, kind, order, status = "published", extra = {}) => ({
  _id: `collection:${slug}`,
  _rev: "1-shot",
  slug,
  title,
  tagline: `${title}, in a line.`,
  kind,
  repo: kind === "project" ? { owner: "example", name: slug, branch: "main", docPaths: ["README.md"] } : null,
  stats: kind === "project" ? { stars: 12, language: "TypeScript", license: "MIT", pushedAt: ago(30), fetchedAt: ago(3), error: null } : null,
  description: `What ${title} is about.`,
  coverImage: null,
  icon: null,
  links: [],
  order,
  status,
  ...extra,
});
const AREAS = [area("site", "The site", "site", 0), area("bothy", "Bothy", "project", 1), area("windom", "WindoM", "project", 2), area("lab", "Lab notes", "site", 3, "hidden")];

const tint = (hex) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex}"/><stop offset="1" stop-color="#1c1a16"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/></svg>`;
const SWATCHES = { "aurora-cabin": "#3a6f8f", "coastal-car": "#c2562b", "desk-setup": "#6b8e5a", "leaf-icon": "#2f6b4f", tour: "#5a4a8f", "night-city": "#30405f" };
const img = (id) => `/api/images/media/${id}/preview.svg`;
const mediaItem = (id, alt, h, usedBy, extra = {}) => ({
  id,
  _rev: "1-shot",
  name: `${id}.jpg`,
  alt,
  caption: "",
  credit: "",
  kind: "image",
  format: "jpeg",
  mime: "image/jpeg",
  file: null,
  width: 1600,
  height: 1200,
  bytes: 184_000,
  createdAt: ago(h),
  updatedAt: ago(h),
  url: img(id),
  preview: img(id),
  srcset: { avif: "", webp: "" },
  largest: { avif: null, webp: img(id) },
  usedBy,
  ...extra,
});
const MEDIA = [
  mediaItem("aurora-cabin", "A cabin under the aurora, with a clock over it.", 20, [
    { id: "collection:site", type: "collection", title: "The site", slug: "site", field: "coverImage" },
  ]),
  mediaItem("coastal-car", "An orange sports car on a coastal highway.", 44, [], { bytes: 412_000 }),
  mediaItem("desk-setup", "A desk with two monitors and a plant.", 120, [], { bytes: 268_000, format: "webp", mime: "image/webp" }),
  mediaItem("night-city", "A city at night from a hill.", 300, [], { bytes: 520_000 }),
  mediaItem("leaf-icon", "A leaf.", 400, [], { kind: "icon", format: "svg", mime: "image/svg+xml", file: img("leaf-icon"), monochrome: true, width: 24, height: 24, bytes: 412 }),
  mediaItem("tour", "A walk through the dashboard, from the list to one item.", 8, [], {
    kind: "video",
    format: "mp4",
    mime: "video/mp4",
    file: "/api/images/m/tour/video-aaaaaaaaaaaaaaaa.mp4",
    durationMs: 12_000,
    hasAudio: false,
    bytes: 3_400_000,
    captions: null,
  }),
];

const GRANTS = [
  { id: "g1", client: "Claude", scopes: ["mcp:read", "mcp:write"], login: "owner", createdAt: ago(240), lastUsedAt: ago(1), expiresAt: ago(-24 * 60), revokedAt: null, revokedReason: null, status: "active" },
  { id: "g2", client: "Claude Code", scopes: ["mcp:read"], login: "owner", createdAt: ago(600), lastUsedAt: ago(96), expiresAt: ago(-24 * 30), revokedAt: null, revokedReason: null, status: "active" },
  { id: "g3", client: "A test client", scopes: ["mcp:read"], login: "owner", createdAt: ago(1500), lastUsedAt: null, expiresAt: ago(200), revokedAt: ago(400), revokedReason: "owner", status: "revoked" },
];

const DEFAULT_SETTINGS = {
  home: { sections: ["work", "approach", "city", "notes", "stack", "contact"].map((id) => ({ id, visible: true })) },
  visuals: { theme: "system", motion: "on", accent: "ink" },
};
const SETTINGS = {
  ok: true,
  exists: true,
  _rev: "2-shot",
  version: 2,
  updatedAt: ago(26),
  settings: DEFAULT_SETTINGS,
  history: [
    { version: 1, at: ago(80), settings: DEFAULT_SETTINGS },
    { version: 0, at: ago(300), settings: DEFAULT_SETTINGS },
  ],
};

function answer(path, method) {
  const p = path.replace(/^\/api/, "");
  if (p.startsWith("/images/")) return { svg: tint(SWATCHES[p.split("/")[3]] ?? "#555") };
  if (method !== "GET") return { status: 503, body: { error: "The shots do not save." } };
  if (p === "/admin/me") return { body: { ok: true, login: "owner", email: null } };
  if (p === "/admin/posts") return { body: { ok: true, items: POSTS } };
  if (p.startsWith("/admin/posts/")) {
    const hit = POSTS.find((x) => x.slug === decodeURIComponent(p.split("/")[3]));
    return hit ? { body: { ok: true, post: hit } } : { status: 404, body: { error: "Not found" } };
  }
  if (p === "/admin/collections") return { body: { ok: true, items: AREAS } };
  if (p === "/admin/media") return { body: { ok: true, items: MEDIA } };
  if (p === "/admin/mcp/grants") return { body: { ok: true, items: GRANTS } };
  if (p === "/admin/settings") return { body: SETTINGS };
  if (p.startsWith("/admin/content/")) {
    const v = CONTENT[p.split("/")[3]];
    return v ? { body: v } : { status: 404, body: {} };
  }
  if (p === "/content") return { body: { ok: true, ...SEED } };
  if (p === "/settings") return { body: { ok: true, settings: DEFAULT_SETTINGS } };
  return { status: 404, body: {} };
}

/* ------------------------------------------------------------- screens */

/* [file name, path, optional step after load] */
/* A fixed bar is drawn where the first viewport ends in a full-page capture,
   over whatever is there, so the screens with an editor bar are shot as a
   person sees them: one viewport. */
const VIEWPORT_ONLY = new Set(["review", "editor", "editor-preview", "editor-scrolled", "new-post", "area", "projects", "story", "site-copy"]);

const SCREENS = [
  ["overview", "/admin"],
  ["posts", "/admin/posts"],
  ["posts-filtered", "/admin/posts?status=draft"],
  ["editor", "/admin/posts/admin-redesign"],
  ["editor-preview", "/admin/posts/admin-redesign", async (page) => {
    await page.keyboard.press("Control+Shift+P").catch(() => {});
    const btn = page.getByRole("button", { name: /^Preview/ }).first();
    if ((await btn.getAttribute("aria-pressed").catch(() => null)) !== "true") await btn.click().catch(() => {});
  }],
  /* The viewport, scrolled into the body: where a bar that floats over the
     content would show it (#288). */
  ["editor-scrolled", "/admin/posts/admin-redesign", async (page) => {
    await page.evaluate(() => window.scrollTo(0, 480));
  }],
  ["review", "/admin/posts/admin-redesign", async (page) => {
    await page.getByRole("button", { name: "Review and publish" }).last().click();
    await page.getByRole("dialog").waitFor({ timeout: 10000 });
  }],
  ["new-post", "/admin/posts/new"],
  ["areas", "/admin/areas"],
  ["area", "/admin/areas/bothy"],
  ["projects", "/admin/projects"],
  ["story", "/admin/story"],
  ["site-copy", "/admin/site-copy"],
  ["media", "/admin/media"],
  ["media-item", "/admin/media?id=aurora-cabin"],
  ["settings", "/admin/settings"],
  ["connections", "/admin/connections"],
];
const ONLY = (process.env.ONLY ?? "").split(",").filter(Boolean);
const WIDTHS = (process.env.WIDTHS ?? "1440,390").split(",").map(Number);

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--font-render-hinting=none"] });

async function settle(page) {
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = "eager")));
  for (let i = 0; i < 24; i += 1) {
    const busy = await page.evaluate(
      () =>
        /Loading/.test(document.querySelector("main")?.textContent ?? "Loading") ||
        ![...document.images].filter((im) => im.getAttribute("src")).every((im) => im.complete),
    );
    if (!busy) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 3; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
}

for (const theme of ["light", "dark"]) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: width > 600 ? 900 : 844 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      colorScheme: theme,
    });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("yb-theme", t);
      } catch {
        /* colorScheme carries it */
      }
    }, theme);
    await ctx.route("**/api/**", (route) => {
      const u = new URL(route.request().url());
      const a = answer(u.pathname, route.request().method());
      if (a.svg) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: a.svg });
      return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body) });
    });
    for (const [name, path, step] of SCREENS) {
      if (ONLY.length && !ONLY.includes(name)) continue;
      const page = await ctx.newPage();
      await page.clock.setFixedTime(new Date(NOW));
      page.on("pageerror", (e) => console.log("pageerror", name, e.message));
      await page.goto(`${base}${path}`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("main"), null, { polling: 500, timeout: 20000 });
      await settle(page);
      if (step) {
        try {
          await step(page);
        } catch (e) {
          console.log("step failed", name, e.message.split("\n")[0]);
        }
        await settle(page);
      }
      const file = `${OUT}/${name}-${theme}-${width}.png`;
      await page.screenshot({ path: file, fullPage: width > 600 && !VIEWPORT_ONLY.has(name) });
      console.log("shot", name, theme, width);
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
stop();
