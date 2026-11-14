#!/usr/bin/env node
/*
 * Screenshots of Marketing > Settings > Signature image, at 390x844 and
 * 1280x900, left-to-right and right-to-left, light and dark, into
 * `docs/design/signature/`:
 *
 *   npm run build
 *   OUT=../docs/design/signature node scripts/shoot-signature.mjs
 *
 * Reuses site-stub.mjs (vite preview + API fixtures); the signature routes
 * are answered here, and a drawn stroke is made with the real pointer. Polls
 * on a timer, never on rAF (headless Chromium on this box has ~1 frame/40 s).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);
const { answer: fixtureAnswer } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/admin-fixtures.mjs")).href);
const OUT = resolve(process.env.OUT || resolve(WEB, "../docs/design/signature"));
mkdirSync(OUT, { recursive: true });

const INK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 90"><path d="M10 60Q30 5 52 40T96 38Q110 20 120 48T160 30Q190 60 230 22" fill="none" stroke="#14130f" stroke-width="5" stroke-linecap="round"/></svg>';
const SLOT = (lang) => ({
  lang, mode: "drawn", format: "svg", alt: lang === "he" ? "חתימה" : "Signature", ink: "#14130f", light: true, hash: "0123456789abcdef", width: 120, height: 45, updatedAt: new Date().toISOString(),
  urls: { web: "/w", email: "/e", emailLight: "/l" },
  preview: { web: `/api/admin/signature/${lang}/file/web`, email: `/api/admin/signature/${lang}/file/email`, emailLight: `/api/admin/signature/${lang}/file/email-light` },
});

function answer(u, method) {
  const p = u.pathname.replace(/^\/api/, "");
  if (p === "/admin/signature") return { body: { ok: true, show: { email: false, posts: false, cards: false }, slots: { en: SLOT("en"), he: null } } };
  if (p.startsWith("/admin/signature/") && p.includes("/file/")) return { raw: INK, type: "image/svg+xml" };
  if (p.startsWith("/admin/signature")) return { status: 503, body: { error: "This shoot does not save." } };
  return fixtureAnswer(u.pathname, method, u.search);
}

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });

async function open(w, h, lang, theme) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600, reducedMotion: "reduce", colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("yb-theme", t); } catch { /* colorScheme carries it */ } }, theme);
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (r) => r.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const a = answer(u, route.request().method());
    if (a.raw) return route.fulfill({ status: 200, contentType: a.type, body: a.raw });
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  const phone = w < 600;
  await page.goto(`${base}${lang === "he" ? "/he" : ""}/admin/marketing?tab=settings${phone ? "&section=signature" : ""}`, { waitUntil: "load" });
  return { page, phone, close: () => ctx.close() };
}
const until = async (page, sel, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate((s) => !!document.querySelector(s), sel)) return true;
    await page.waitForTimeout(250);
  }
  throw new Error(`never found ${sel}`);
};
async function shot(page, name, full) {
  const cdp = await page.context().newCDPSession(page);
  const params = { format: "png" };
  if (full) {
    const { cssContentSize } = await cdp.send("Page.getLayoutMetrics");
    params.captureBeyondViewport = true;
    params.clip = { x: 0, y: 0, width: cssContentSize.width, height: Math.min(cssContentSize.height, 3400), scale: 1 };
  }
  const { data } = await cdp.send("Page.captureScreenshot", params);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
  await cdp.detach();
}

async function scribble(page) {
  const box = await page.locator("[data-testid=signature-pad]").boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  const stroke = async (pts) => {
    await page.mouse.move(...at(...pts[0]));
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(...at(...p), { steps: 6 });
    await page.mouse.up();
  };
  await stroke([[0.08, 0.62], [0.16, 0.25], [0.24, 0.7], [0.32, 0.3], [0.4, 0.66]]);
  await stroke([[0.44, 0.45], [0.55, 0.3], [0.66, 0.6], [0.78, 0.28], [0.9, 0.55]]);
  await stroke([[0.1, 0.78], [0.5, 0.74], [0.92, 0.8]]);
}

const failures = [];
try {
  for (const lang of ["en", "he"]) {
    for (const theme of ["light", "dark"]) {
      for (const w of [390, 1280]) {
        const tag = `${w === 390 ? "phone" : "desktop"}-${lang === "he" ? "rtl" : "ltr"}-${theme}`;
        const { page, phone, close } = await open(w, w === 390 ? 844 : 900, lang, theme);
        try {
          await until(page, phone ? "[data-testid=signature-settings]" : "[data-testid=signature-image]");
          if (!phone) {
            await page.locator("[data-testid=signature-image] summary, [data-testid=signature-image] button").first().click();
            await until(page, "[data-testid=signature-settings]");
          }
          await page.waitForTimeout(500);
          if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) failures.push(`${tag}: page scrolls sideways`);
          await shot(page, `${tag}-1-slots`, !phone);
          await page.locator("[data-testid=signature-slot-he] button").first().click();
          await until(page, "[data-testid=signature-pad]");
          await page.waitForTimeout(500);
          await scribble(page);
          await until(page, "[data-testid=signature-previews]");
          await page.waitForTimeout(600);
          await page.locator("[data-testid=signature-pad]").scrollIntoViewIfNeeded().catch(() => {});
          await shot(page, `${tag}-2-draw`, !phone);
          if (phone) {
            await page.evaluate(() => document.querySelector("dialog[open] [data-testid=signature-previews]")?.scrollIntoView({ block: "start" }));
            await page.waitForTimeout(400);
            await shot(page, `${tag}-3-previews`, false);
          }
          if (lang === "en" && theme === "light") {
            await page.getByRole("button", { name: /^(Cancel|ביטול)$/ }).first().click();
            await page.waitForTimeout(500);
            await page.locator("[data-testid=signature-slot-he] button").nth(1).click();
            await until(page, "input[type=file]");
            await page.setInputFiles("input[type=file]", { name: "sig.svg", mimeType: "image/svg+xml", buffer: Buffer.from(INK) });
            await until(page, "[data-testid=checker-preview]");
            await page.waitForTimeout(2500);
            await page.locator("[data-testid=checker-preview]").scrollIntoViewIfNeeded();
            await page.waitForTimeout(1500);
            await shot(page, `${tag}-4-upload-svg`, false);
          }
        } catch (e) {
          failures.push(`${tag}: ${e.message}`);
          if (process.env.DEBUG) console.error(await page.evaluate(() => document.body.innerText.slice(0, 600)), page.url());
        }
        await close();
      }
    }
  }
} finally {
  await browser.close();
  stop();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("shot into", OUT);
