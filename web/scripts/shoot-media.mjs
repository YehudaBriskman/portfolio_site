/*
 * Screenshots of the media library (#253): /admin/media, one picture's
 * details, and the picker open in the post editor.
 *
 * Against a real API, not fixtures, so the thumbnails are the variants the
 * backend actually made:
 *
 *   npm run build && npx vite preview --port 4398 --strictPort &
 *   BASE=http://127.0.0.1:4398 API=http://127.0.0.1:8080 ADMIN_PROXY_SECRET=... \
 *     node scripts/shoot-media.mjs [outDir]
 *
 * Every /api request the page makes is forwarded to API with the admin proof
 * headers added, standing in for the oauth2-proxy router in front of the
 * admin host. Writes to docs/media-library/ by default.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/media-library");
const BASE = process.env.BASE ?? "http://127.0.0.1:4398";
const API = process.env.API ?? "http://127.0.0.1:8080";
const SECRET = process.env.ADMIN_PROXY_SECRET ?? "";
const LOGIN = process.env.ADMIN_LOGIN ?? "YehudaBriskman";
if (!SECRET) {
  console.error("ADMIN_PROXY_SECRET is required (the API's own value).");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });

async function open(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await context.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    const response = await route.fetch({
      url: API + u.pathname + u.search,
      headers: { ...route.request().headers(), "x-admin-proxy-secret": SECRET, "x-auth-request-user": LOGIN },
    });
    await route.fulfill({ response });
  });
  return context.newPage();
}

/* Images settle when every <img> has decoded; polled by hand (no rAF here). */
async function settle(page) {
  // Lazy loading waits on an intersection pass, which this Chromium's missing
  // frame clock may never run; a real browser starts them at once.
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = "eager")));
  for (let i = 0; i < 40; i += 1) {
    // Lazy images report `complete` before they are even requested, so ask for pixels.
    const done = await page.evaluate(() =>
      [...document.images].filter((i) => i.getAttribute("src")).every((i) => i.complete && i.naturalWidth > 0),
    );
    if (done) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(300);
}

/* This box's headless Chromium paints rarely; a screenshot can time out waiting
   for a frame, and the next attempt usually lands. */
async function snap(page, path, opts = {}) {
  for (let i = 0; i < 6; i += 1) {
    try {
      return await page.screenshot({ path, timeout: 30000, animations: "disabled", ...opts });
    } catch (e) {
      if (i === 5) throw e;
    }
  }
}

const shots = [];
for (const [label, w, h] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
  const page = await open(w, h);
  await page.goto(`${BASE}/admin/media`, { waitUntil: "load" });
  await page.getByRole("list", { name: /pictures/ }).waitFor({ timeout: 15000 });
  await settle(page);
  shots.push(`library-${label}.png`);
  await snap(page, resolve(OUT, shots.at(-1)));

  // One picture, one video, one icon: each kind opens as itself.
  for (const [kind, name] of [["detail", /WindoM/], ["video", /colour bars/], ["icon", /A leaf/]]) {
    await page.goto(`${BASE}/admin/media`, { waitUntil: "load" });
    await page.getByRole("list", { name: /pictures/ }).getByRole("button", { name }).first().click();
    await page.getByRole("button", { name: "Delete" }).waitFor({ timeout: 15000 });
    await settle(page);
    shots.push(`${kind}-${label}.png`);
    await snap(page, resolve(OUT, shots.at(-1)));
  }

  // An area's icon field: the picker offers icons only.
  await page.goto(`${BASE}/admin/areas/new`, { waitUntil: "load" });
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  await page.getByRole("button", { name: "Choose an icon" }).click();
  await page.getByRole("list", { name: "Icons" }).waitFor({ timeout: 15000 });
  await settle(page);
  shots.push(`icon-picker-${label}.png`);
  await snap(page, resolve(OUT, shots.at(-1)));

  await page.goto(`${BASE}/admin/posts/new`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Choose from library" }).first().click();
  await page.getByRole("list", { name: "Pictures" }).waitFor({ timeout: 15000 });
  await settle(page);
  shots.push(`picker-${label}.png`);
  await snap(page, resolve(OUT, shots.at(-1)));
  await page.context().close();
}
await browser.close();
for (const s of shots) console.log(resolve(OUT, s));
