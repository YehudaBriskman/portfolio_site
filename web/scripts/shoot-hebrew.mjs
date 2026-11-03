#!/usr/bin/env node
/*
 * The Hebrew site beside the English one (#248): every main route in both
 * languages, both themes, at a laptop and a phone, into docs/hebrew/.
 *
 *   npm run build && xvfb-run -a node scripts/shoot-hebrew.mjs
 *
 * Under xvfb the browser is headed, which is what gives it a frame clock on
 * this box; headless Chromium here paints too rarely to screenshot. Every
 * wait polls by hand (`{ polling: 500 }`) for the same reason.
 *
 * Each Hebrew page is also checked, not only shot: the document must be
 * `lang="he" dir="rtl"`, and the language menu must take the reader to the
 * same page in English and back. ONLY=home,blog narrows a run.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./a11y/site-stub.mjs";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/hebrew");
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["home", "/"],
  ["story", "/story"],
  ["projects", "/projects"],
  ["project", "/projects/bothy"],
  ["blog", "/blog"],
  ["post", "/blog/fixture-post"],
  ["area", "/blog/area/site"],
  ["log", "/blog/log"],
  ["accessibility", "/accessibility"],
  ["mcp", "/developers/mcp"],
  ["not-found", "/a-page-that-does-not-exist"],
];
const ONLY = process.env.ONLY?.split(",");
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const he = (route) => (route === "/" ? "/he" : `/he${route}`);

const { base, stop } = await startPreview();
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  headless: !process.env.DISPLAY,
  args: ["--no-sandbox"],
});

const problems = [];
try {
  for (const [name, route] of ROUTES.filter(([n]) => !ONLY || ONLY.includes(n))) {
    for (const lang of ["he", "en"]) {
      for (const theme of ["light", "dark"]) {
        for (const size of ["desktop", "phone"]) {
          const context = await browser.newContext({ viewport: SIZES[size], deviceScaleFactor: 1, reducedMotion: "reduce" });
          await context.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
          await context.route("**/api/**", (r) => {
            const { status, body } = answer(r.request().url(), false);
            return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
          });
          const page = await context.newPage();
          page.on("pageerror", (e) => problems.push(`${name} ${lang}: ${e}`));
          await page.goto(base + (lang === "he" ? he(route) : route), { waitUntil: "load" });
          await page.waitForFunction(() => document.querySelector("h1") !== null, null, { polling: 500, timeout: 15_000 });
          await page
            .waitForFunction(() => !document.querySelector("div[data-state][aria-hidden='true']"), null, { polling: 500, timeout: 15_000 })
            .catch(() => {});
          await page.evaluate(() => document.fonts.ready);
          /* Every eager image decoded before the shot. Without this the run's
             first shot (home, he, light, desktop) caught the hero portrait
             still decoding on a cold cache and showed the hero without it:
             the page was fine, the photograph of it was early. */
          await page.evaluate(() =>
            Promise.all(
              [...document.images]
                .filter((i) => i.loading !== "lazy")
                .map((i) => (i.complete ? i.decode() : new Promise((r) => i.addEventListener("load", r, { once: true })).then(() => i.decode())).catch(() => {})),
            ),
          );
          /* And the hero portrait fully arrived: complete, at opacity 1.
             Polled by hand, since rAF-driven waits stall on this box. */
          for (let t = 0; t < 40; t++) {
            const arrived = await page.evaluate(() => {
              const img = document.querySelector("[data-portrait] img");
              return !img || (img.complete && img.naturalWidth > 0 && getComputedStyle(img).opacity === "1");
            });
            if (arrived) break;
            await page.waitForTimeout(250);
          }
          await page.waitForTimeout(1000);
          const doc = await page.evaluate(() => `${document.documentElement.lang}/${document.documentElement.dir}`);
          const want = lang === "he" ? "he/rtl" : "en/ltr";
          if (doc !== want) problems.push(`${name} ${lang}: document is ${doc}, expected ${want}`);
          const file = resolve(OUT, `${name}-${lang}-${theme}-${size}.png`);
          for (let i = 0; ; i++) {
            try {
              await page.screenshot({ path: file, timeout: 45_000 });
              break;
            } catch (e) {
              if (i >= 3) throw e;
            }
          }
          console.log(file);

          /* The switch itself, once per page: Hebrew → English → Hebrew. */
          if (lang === "he" && theme === "light" && size === "desktop") {
            for (const [label, to, path] of [["English", "en/ltr", route], ["עברית", "he/rtl", he(route)]]) {
              await page.locator("header [aria-haspopup='menu']").first().click();
              await page.getByRole("menuitemradio", { name: label }).click();
              await page.waitForFunction((t) => `${document.documentElement.lang}/${document.documentElement.dir}` === t, to, { polling: 500, timeout: 10_000 });
              const at = await page.evaluate(() => location.pathname);
              if (at !== path) problems.push(`${name}: switching to ${label} went to ${at}, expected ${path}`);
            }
          }
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  stop();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
  process.exit(1);
}
