/*
 * Runs legibility.html in headless Chromium and prints its tables as text,
 * plus a screenshot of the samples, so the numbers in the PR are the ones the
 * browser produced. See the head of legibility.html for the metric.
 *
 *   PLAYWRIGHT  path to a playwright-core index.mjs (not a project dependency)
 *   CHROME      path to a chromium binary
 *   BASE        where `web/` is being served, default http://127.0.0.1:4227
 *
 * Polls by hand rather than with `waitForFunction`'s default, which waits on
 * requestAnimationFrame — and a headless Chromium with no frame clock emits
 * roughly one of those every forty seconds.
 */
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core");
const BASE = process.env.BASE ?? "http://127.0.0.1:4227";
const OUT = process.argv[2];

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
await page.goto(`${BASE}/scripts/fontwork/legibility.html`, { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { polling: 500, timeout: 240000 });

const text = await page.evaluate(() =>
  [...document.querySelectorAll("table")]
    .map((t) => [...t.rows].map((r) => [...r.cells].filter((c) => !c.classList.contains("sample"))
      .map((c) => c.textContent.trim()).join(" | ")).join("\n"))
    .join("\n\n"));
console.log(text);
if (OUT) await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
