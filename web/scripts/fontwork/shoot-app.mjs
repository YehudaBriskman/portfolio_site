/*
 * Screenshots the real page in both languages, and reports what the browser
 * actually fetched for each — the font bytes per language, measured off the
 * network rather than off the directory listing.
 */
import { chromium } from "/home/yehuda/projects/army/unisync/MVP/node_modules/playwright-core/index.mjs";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2];
const BASE = "http://127.0.0.1:4226";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/home/yehuda/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

for (const lang of ["en", "he"]) {
  for (const [name, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    const fonts = new Map();
    page.on("response", async (r) => {
      if (!r.url().includes("/fonts/")) return;
      const h = r.headers();
      fonts.set(r.url().split("/").pop(), Number(h["content-length"] ?? 0));
    });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    if (lang === "he") {
      // The locale switch is gated on `available`, which is false until the
      // strings exist. Writing the two attributes is exactly what
      // `applyLocale` does once that flag flips, so this is the same code
      // path a reader will take, reached a release early. It has to happen
      // after mount, because `useLocale`'s effect writes the default on the
      // first commit and would overwrite anything set before it.
      await page.evaluate(() => {
        document.documentElement.lang = "he";
        document.documentElement.dir = "rtl";
      });
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/home-${lang}-${name}.png` });
    // The spec plate lives far down the page; scroll it into view so the
    // count fires and the figures are on the shot.
    const plate = page.locator("#stack");
    if (await plate.count()) {
      await plate.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1800);
      await plate.screenshot({ path: `${OUT}/spec-plate-${lang}-${name}.png` });
    }
    if (name === "desktop") {
      let total = 0;
      console.log(`\n— ${lang} — fonts the browser actually fetched`);
      for (const [f, n] of [...fonts].sort()) { console.log(`  ${String(n).padStart(7)}  ${f}`); total += n; }
      console.log(`  ${String(total).padStart(7)}  TOTAL (${(total / 1024).toFixed(1)} KiB)`);
    }
    await page.close();
  }
}
await browser.close();
