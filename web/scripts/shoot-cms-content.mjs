/*
 * The content store switch (#163): the public pages before and after, and
 * the three admin editors, into `docs/cms-content/`.
 *
 *   node scripts/shoot-cms-content.mjs before    pages, the build before the switch
 *   node scripts/shoot-cms-content.mjs after     pages, API down (the offline fallback)
 *   node scripts/shoot-cms-content.mjs served    pages, /api/content answering the seed
 *   node scripts/shoot-cms-content.mjs admin     the three editors
 *
 * Every page is shot with reduced motion, so a frame is a state and not a
 * moment, and with every other /api/ request refused, so the two builds see
 * the same world. `served` answers /api/content with the backend's own seed
 * (backend/src/content/seed.ts), which is the store's first state after the
 * seed runs. The `diff` step compares each pair pixel by pixel.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4399 --strictPort`, then this.
 * Waits poll on a timer, never on rAF: headless Chromium on this box has
 * almost no frame clock.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../docs/cms-content");
const BASE = process.env.BASE ?? "http://localhost:4399";
const MODE = process.argv[2] ?? "after";
mkdirSync(OUT, { recursive: true });

function seed() {
  const src = readFileSync(resolve(HERE, "../../backend/src/content/seed.ts"), "utf8");
  return JSON.parse(src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1));
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

async function settle(page, n = 4) {
  for (let i = 0; i < n; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
}

const PAGES = [
  ["home", "/"],
  ["story", "/story"],
  ["projects", "/projects"],
  ["project-windom", "/projects/windom"],
];

if (MODE === "admin") {
  const s = seed();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await ctx.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
    const m = p.match(/^\/api\/admin\/content\/(projects|story|site-copy)$/);
    if (m) {
      return json({
        ok: true,
        key: m[1],
        exists: true,
        _rev: "1-seed",
        published: s[m[1] === "site-copy" ? "siteCopy" : m[1]],
        draft: null,
        updatedAt: "2026-11-03T08:00:00.000Z",
        publishedAt: "2026-11-03T08:00:00.000Z",
      });
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  for (const [name, path, wait] of [
    ["admin-projects", "/admin/projects", "#project-fact-en"],
    ["admin-story", "/admin/story", "#story-start-title-en"],
    ["admin-site-copy", "/admin/site-copy", "#site-hero-title-en"],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "load" });
    await page.waitForSelector(wait, { timeout: 20000 });
    await settle(page, 2);
    await page.screenshot({ path: `${OUT}/${name}-1440.png`, fullPage: true });
    console.log("shot", name);
  }
  /* A validation message, as the editor shows one: the fact emptied. */
  await page.goto(`${BASE}/admin/projects`, { waitUntil: "load" });
  await page.waitForSelector("#project-fact-en", { timeout: 20000 });
  await page.fill("#project-fact-en", "");
  await page.click("button:has-text(\"Publish\") >> visible=true");
  await page.waitForSelector(".a-error", { timeout: 10000 });
  await settle(page, 2);
  await page.screenshot({ path: `${OUT}/admin-projects-invalid-1440.png` });
  console.log("shot admin-projects-invalid");
} else {
  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await ctx.route("**/api/**", (route) => {
      const p = new URL(route.request().url()).pathname;
      if (MODE === "served" && p === "/api/content") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, ...seed() }),
        });
      }
      return route.abort();
    });
    /* A fresh page per shot: a page carried from route to route keeps its
       scroll and its observers' state, and a full-page capture of the fourth
       route then depends on the first three. */
    for (const [name, path] of PAGES) {
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log("pageerror", e.message));
      await page.goto(`${BASE}${path}`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("main h1, main h2"), null, { polling: 500, timeout: 20000 });
      /* Every face loaded before the first frame counts: a fallback face
         caught mid-swap is a difference in the font, not in the page. */
      await page.evaluate(() => document.fonts.ready);
      await settle(page, 6);
      await page.screenshot({ path: `${OUT}/${MODE}-${name}-${w}.png`, fullPage: true });
      console.log("shot", MODE, name, w);
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
