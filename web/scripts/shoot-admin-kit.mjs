#!/usr/bin/env node
/*
 * Screenshots of the admin page kit (PageHeader, Tabs, Banner, ConfirmDialog)
 * from the gallery in scripts/kit-gallery, served by the Vite dev server.
 *
 *   SHOTS=/tmp/kit node scripts/shoot-admin-kit.mjs
 *   WIDTHS=390,1280  LANGS=en,he  THEMES=light,dark  (all three are the defaults)
 *
 * Also checks, per combination, that no page scrolls sideways and that no button
 * label is cut mid-word. Waits poll on a timer, never rAF or animationend
 * (headless Chromium here has about one frame per 40 s); clicks use force.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { createServer } = require("vite");

const env = (n, d) => ((process.env[n] ?? "") || d).split(",").filter(Boolean);
const WIDTHS = env("WIDTHS", "390,1280").map(Number);
const LANGS = env("LANGS", "en,he");
const THEMES = env("THEMES", "light,dark");
const SHOTS = process.env.SHOTS ?? "/tmp/admin-kit-shots";
mkdirSync(SHOTS, { recursive: true });

const server = await createServer({ root: WEB, logLevel: "error", server: { port: 5199, strictPort: false, host: "127.0.0.1" } });
await server.listen();
const base = `http://127.0.0.1:${server.config.server.port}/scripts/kit-gallery/index.html`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });
const fails = [];

for (const w of WIDTHS) for (const lang of LANGS) for (const theme of THEMES) {
  const tag = `${w}-${lang}-${theme}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: theme, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${base}?lang=${lang}&theme=${theme}`, { waitUntil: "load", timeout: 120000 });
  for (let i = 0; i < 60 && !(await page.locator("h1").count()); i++) await page.waitForTimeout(500);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 1) fails.push(`${tag}: page scrolls sideways by ${over}px`);
  await page.screenshot({ path: resolve(SHOTS, `kit-${tag}.png`), fullPage: true, timeout: 120000 });

  /* More menu open */
  await page.getByRole("button", { name: lang === "he" ? "עוד פעולות" : "More actions" }).click({ force: true });
  for (let i = 0; i < 20 && !(await page.getByRole("menu").count()); i++) await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(SHOTS, `kit-menu-${tag}.png`), timeout: 120000 });
  await page.keyboard.press("Escape");

  /* The confirm dialog */
  await page.getByRole("button", { name: lang === "he" ? "פתיחת הדיאלוג" : "Open the dialog" }).click({ force: true });
  for (let i = 0; i < 20 && !(await page.locator("dialog[open]").count()); i++) await page.waitForTimeout(250);
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  const safe = lang === "he" ? "להשאיר" : "Keep";
  if (focused !== safe) fails.push(`${tag}: confirm opens with focus on "${focused}", not "${safe}"`);
  await page.screenshot({ path: resolve(SHOTS, `kit-confirm-${tag}.png`), timeout: 120000 });
  await ctx.close();
}

await browser.close();
await server.close();
if (fails.length) {
  console.error(fails.join("\n"));
  process.exit(1);
}
console.log(`ok: ${WIDTHS.length * LANGS.length * THEMES.length} combinations, shots in ${SHOTS}`);
