/*
 * Screenshots the specimen and dumps the measurement tables as text, so the
 * numbers in the report are the numbers the browser produced rather than the
 * numbers I expected it to.
 */
import { chromium } from "/home/yehuda/projects/army/unisync/MVP/node_modules/playwright-core/index.mjs";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2];
const URL = process.argv[3] ?? "http://127.0.0.1:4226/__specimen.html";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/home/yehuda/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

for (const [name, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1", { timeout: 20000 });
  await page.locator("#paper").screenshot({ path: `${OUT}/specimen-${name}-paper.png` });
  await page.locator("#panel").screenshot({ path: `${OUT}/specimen-${name}-panel.png` });
  // The three sections the issue asks to be able to judge by eye, each as its
  // own file, so none of them is a detail inside a 6000px page.
  for (const [sel, file] of [
    ["#count-ladder", `count-jitter-${name}.png`],
  ]) {
    const el = page.locator(sel);
    if (await el.count()) await el.screenshot({ path: `${OUT}/${file}` });
  }
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
