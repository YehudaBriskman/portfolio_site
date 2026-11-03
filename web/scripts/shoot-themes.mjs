#!/usr/bin/env node
/*
 * The two themes, shot (#247): five routes in Light and Dark at 1440x900,
 * and the home page and /blog on a phone, into docs/themes/.
 *
 * Against the built site and the same API fixtures the axe run measures
 * (scripts/a11y/site-stub.mjs), with reduced motion so the shutter and the
 * arrivals have settled. The theme is set the way a reader sets it — a
 * stored choice — with the OS saying the opposite, so a shot in the wrong
 * theme would show it.
 *
 *   npm run build && xvfb-run -a node scripts/shoot-themes.mjs
 *
 * CHROME overrides the browser binary. Polling is by hand (500ms): headless
 * Chromium on the dev box has almost no rAF clock.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./a11y/site-stub.mjs";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/themes");
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  ["home", "/", ["desktop", "phone"]],
  ["story", "/story", ["desktop"]],
  ["blog", "/blog", ["desktop", "phone"]],
  ["projects", "/projects", ["desktop"]],
  ["project", "/projects/bothy", ["desktop"]],
];
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

const { base, stop } = await startPreview();
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  /* Headed under xvfb when there is a display: headless Chromium on the dev
     box paints so rarely that a screenshot times out waiting for a frame. */
  headless: !process.env.DISPLAY,
  args: ["--no-sandbox"],
});

try {
  for (const theme of ["light", "dark"]) {
    for (const [name, route, sizes] of SHOTS) {
      for (const size of sizes) {
        const context = await browser.newContext({
          viewport: SIZES[size],
          deviceScaleFactor: 1,
          reducedMotion: "reduce",
          colorScheme: theme === "dark" ? "light" : "dark",
        });
        await context.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
        await context.route("**/api/**", (r) => {
          const { status, body } = answer(r.request().url(), false);
          return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        });
        const page = await context.newPage();
        await page.goto(base + route, { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("h1") !== null, null, { polling: 500, timeout: 15_000 });
        await page
          .waitForFunction(() => !document.querySelector("div[data-state][aria-hidden='true']"), null, { polling: 500, timeout: 15_000 })
          .catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);
        const painted = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        if (painted !== theme) throw new Error(`${route} painted ${painted}, expected ${theme}`);
        const file = resolve(OUT, `${name}-${theme}-${size}.png`);
        /* A frame can be 40s away here (see the header), so ask again
           rather than failing the run on the first wait. */
        for (let i = 0; ; i++) {
          try {
            await page.screenshot({ path: file, timeout: 45_000 });
            break;
          } catch (e) {
            if (i >= 3) throw e;
          }
        }
        console.log(file);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  stop();
}
