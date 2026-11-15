#!/usr/bin/env node
/*
 * The split New button on a phone: its caret opens a bottom sheet (#864, the
 * shot #862 left out). No admin page draws it below 600px yet (the phone lists
 * have their own add button), so it is shot from the kit gallery with
 * ?newmenu=1, served by the Vite dev server.
 *
 *   SHOTS=../docs/design/admin-f3 node scripts/shoot-new-menu-sheet.mjs
 *   LANGS=en  THEMES=light
 *
 * Waits poll on a timer, never rAF (headless Chromium here has ~1 frame / 40 s);
 * the click uses force for the same reason.
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
const LANGS = env("LANGS", "en,he");
const THEMES = env("THEMES", "light,dark");
const SHOTS = resolve(process.env.SHOTS ?? "/tmp/new-menu-sheet");
mkdirSync(SHOTS, { recursive: true });

const server = await createServer({ root: WEB, logLevel: "error", server: { port: 5198, strictPort: false, host: "127.0.0.1" } });
await server.listen();
const base = `http://127.0.0.1:${server.config.server.port}/scripts/kit-gallery/index.html`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });
const fails = [];

for (const lang of LANGS) for (const theme of THEMES) {
  const tag = `390-${theme}-${lang}`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: theme, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, theme);
  const page = await ctx.newPage();
  await page.goto(`${base}?lang=${lang}&theme=${theme}&newmenu=1`, { waitUntil: "load", timeout: 120000 });
  for (let i = 0; i < 60 && !(await page.locator("[data-new-menu]").count()); i++) await page.waitForTimeout(500);
  await page.evaluate(() => document.fonts.ready);
  try {
    await page.locator("[data-new-menu] button[aria-haspopup='dialog']").click({ force: true, timeout: 30000 });
    for (let i = 0; i < 40 && !(await page.locator("dialog[open] [role=menu]").count()); i++) await page.waitForTimeout(250);
    if (!(await page.locator("dialog[open] [role=menu]").count())) throw new Error("the sheet did not open");
    await page.waitForTimeout(1200);
    const rows = await page.locator("dialog[open] [role=menu] [role=menuitem]").count();
    if (rows < 2) fails.push(`${tag}: the sheet lists ${rows} entries`);
    await page.screenshot({ path: resolve(SHOTS, `newmenu-sheet-${tag}.png`), timeout: 120000 });
  } catch (e) {
    fails.push(`${tag}: ${e.message.split("\n")[0]}`);
  }
  await ctx.close();
}

await browser.close();
await server.close();
if (fails.length) {
  console.error(fails.join("\n"));
  process.exit(1);
}
console.log(`ok: ${LANGS.length * THEMES.length} sheet shots in ${SHOTS}`);
