/*
 * Site settings (#254): the home page before and after a reorder and a hide,
 * and the admin screen, in both themes, into `docs/site-settings/`.
 *
 *   npm run build && npx vite preview --port 4417 --strictPort
 *   BASE=http://localhost:4417 node scripts/shoot-site-settings.mjs
 *
 * Every /api/ request is answered here: /api/settings with the defaults
 * ("before") or with the edited settings ("after"), /api/admin/settings with
 * the edited settings and their history. Reduced motion, so a frame is a
 * state and not a moment. Waits poll on a timer, never on rAF: headless
 * Chromium on this box has almost no frame clock.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../docs/site-settings");
const BASE = process.env.BASE ?? "http://localhost:4417";
mkdirSync(OUT, { recursive: true });

const IDS = ["work", "approach", "city", "notes", "stack", "contact"];
const DEFAULTS = {
  home: { sections: IDS.map((id) => ({ id, visible: true })) },
  visuals: { theme: "system", motion: "on", accent: "ink" },
};
/* Specs moved up to follow Work, Notes hidden, the Pine accent. */
const EDITED = {
  home: {
    sections: [
      { id: "work", visible: true },
      { id: "stack", visible: true },
      { id: "approach", visible: true },
      { id: "city", visible: true },
      { id: "notes", visible: false },
      { id: "contact", visible: true },
    ],
  },
  visuals: { theme: "system", motion: "on", accent: "pine" },
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

async function settle(page, n = 4) {
  for (let i = 0; i < n; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
}

async function context(theme, settings) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: theme });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem("yb-theme", t);
    } catch {
      /* the theme still follows colorScheme */
    }
  }, theme);
  await ctx.route("**/api/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/api/settings") return json({ ok: true, settings });
    if (p === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
    if (p === "/api/admin/settings") {
      return json({
        ok: true,
        exists: true,
        _rev: "2-shot",
        version: 2,
        updatedAt: "2026-11-03T10:20:00.000Z",
        settings,
        history: [
          { version: 1, at: "2026-11-03T09:40:00.000Z", settings: DEFAULTS },
          { version: 0, at: "2026-11-03T09:00:00.000Z", settings: DEFAULTS },
        ],
      });
    }
    return route.abort();
  });
  return ctx;
}

for (const theme of ["light", "dark"]) {
  for (const [state, settings] of [
    ["before", DEFAULTS],
    ["after", EDITED],
  ]) {
    const ctx = await context(theme, settings);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("pageerror", e.message));
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("main h1"), null, { polling: 500, timeout: 20000 });
    if (state === "after") {
      await page.waitForFunction(() => !document.querySelector("#notes") && document.documentElement.dataset.accent === "pine", null, {
        polling: 500,
        timeout: 20000,
      });
    }
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 6);
    const order = await page.evaluate(() => [...document.querySelectorAll("main section[id]")].map((s) => s.id).join(","));
    console.log(theme, state, order);
    await page.screenshot({ path: `${OUT}/home-${state}-${theme}-1440.png`, fullPage: true });
    await ctx.close();
  }

  const ctx = await context(theme, EDITED);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(`${BASE}/admin/settings`, { waitUntil: "load" });
  await page.waitForSelector("#settings-work-up", { timeout: 20000 });
  await settle(page, 2);
  await page.screenshot({ path: `${OUT}/admin-${theme}-1440.png`, fullPage: true });
  /* The ledger rule, as the admin shows it: hiding Specs and How I work
     leaves Work beside The year, the two dark acts side by side. */
  await page.click("#settings-stack-visible");
  await page.click("#settings-approach-visible");
  await page.waitForSelector(".a-error", { timeout: 10000 });
  await settle(page, 2);
  await page.screenshot({ path: `${OUT}/admin-ledger-${theme}-1440.png`, fullPage: true });
  await ctx.close();
  console.log("shot admin", theme);
}
await browser.close();
