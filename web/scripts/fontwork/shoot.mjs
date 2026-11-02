/*
 * Screenshots the specimen and dumps its measurement tables as text, so the
 * numbers in the report are the numbers the browser produced rather than the
 * numbers I expected it to.
 *
 *   node web/scripts/fontwork/shoot.mjs docs/type-specimen [url]
 *
 * PLAYWRIGHT and CHROME name a playwright-core index.mjs and a chromium
 * binary; Playwright is not a dependency of this project. The wait polls
 * every 500ms rather than on requestAnimationFrame (the default), because a
 * headless Chromium with no frame clock emits about one rAF per forty
 * seconds and the default poll would sit on a condition that is already true.
 */
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core");
import { mkdirSync } from "node:fs";

const OUT = process.argv[2];
const URL = process.argv[3] ?? "http://127.0.0.1:4227/scripts/fontwork/specimen.html";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

for (const [name, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { polling: 500, timeout: 120000 });
  await page.locator("#paper").screenshot({ path: `${OUT}/specimen-${name}-paper.png` });
  await page.locator("#panel").screenshot({ path: `${OUT}/specimen-${name}-panel.png` });
  if (name === "desktop") {
    const text = await page.evaluate(() =>
      [...document.querySelectorAll("table.m")]
        .map((t) => [...t.rows].map((r) => [...r.cells].map((c) => c.textContent.trim()).join(" | ")).join("\n"))
        .join("\n\n"));
    console.log(text);
  }
  await page.close();
}

await browser.close();
