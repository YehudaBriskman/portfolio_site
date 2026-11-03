#!/usr/bin/env node
/*
 * Issue #99: the viewer controls, shot in both themes at desktop and phone
 * width, into docs/a11y-99/.
 *
 *   npm run build && node scripts/shoot-a11y-99.mjs
 *
 * Per theme and window:
 *   <theme>-<win>-menu.png         the display menu open: Theme, Text size,
 *                                  Contrast (on a phone, inside the side panel)
 *   <theme>-<win>-larger-more.png  /accessibility at Larger text, More contrast
 *   <theme>-<win>-focus.png        a keyboard focus ring under More contrast
 *
 * Reduced motion so every arrival is settled, and `{ polling: 500 }` on every
 * wait because headless Chromium on the dev box barely runs rAF.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { answer, startPreview } from "./a11y/site-stub.mjs";

const OUT = resolve(import.meta.dirname, "../../docs/a11y-99");
mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
];

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });

async function open(theme, [, w, h], prefs, route = "/") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", colorScheme: theme });
  await ctx.addInitScript(
    ([t, p]) => {
      localStorage.setItem("yb-theme", t);
      if (p) {
        localStorage.setItem("yb-text-size", p[0]);
        localStorage.setItem("yb-contrast", p[1]);
      }
    },
    [theme, prefs],
  );
  await ctx.route("**/api/**", (r) => {
    const { status, body } = answer(r.request().url(), false);
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  const page = await ctx.newPage();
  await page.goto(base + route, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("h1") !== null, null, { polling: 500, timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  return { ctx, page };
}

try {
  for (const theme of ["light", "dark"]) {
    for (const win of WINDOWS) {
      const [label] = win;

      {
        const { ctx, page } = await open(theme, win, null);
        if (label === "phone") {
          await page.locator('button[aria-label^="Menu"], button:has-text("Menu")').first().click({ force: true }); // force: "stable" waits on rAF, which barely runs here
          await page.waitForTimeout(600);
        }
        await page.locator('button[aria-label^="Theme:"]:visible').first().click({ force: true }); // force: "stable" waits on rAF, which barely runs here
        await page.waitForFunction(() => document.querySelector('[role="menu"]') !== null, null, { polling: 500, timeout: 10_000 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${theme}-${label}-menu.png` });
        await ctx.close();
      }

      {
        const { ctx, page } = await open(theme, win, ["larger", "more"], "/accessibility");
        await page.screenshot({ path: `${OUT}/${theme}-${label}-larger-more.png` });
        await ctx.close();
      }

      {
        const { ctx, page } = await open(theme, win, ["default", "more"], "/projects");
        for (let i = 0; i < (label === "phone" ? 3 : 4); i++) await page.keyboard.press("Tab");
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/${theme}-${label}-focus.png` });
        await ctx.close();
      }
      console.log(`${theme} ${label}: shot`);
    }
  }
} finally {
  await browser.close();
  stop();
}
