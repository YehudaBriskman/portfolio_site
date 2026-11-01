/* Widths of the two strings Hero.module.css budgets against, in em, at each
 * face's own shipped tracking. Measured in the DOM, not derived from hmtx,
 * so kerning and the tracking step are both in the number. */
import { chromium } from "/home/yehuda/projects/army/unisync/MVP/node_modules/playwright-core/index.mjs";

const browser = await chromium.launch({
  executablePath: "/home/yehuda/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:4226/__specimen.html", { waitUntil: "networkidle" });
await page.waitForFunction(() => document.documentElement.dataset.ready === "1");

const rows = await page.evaluate(() => {
  const w = (face, text, track, size = 1000, extra = "") => {
    const s = document.createElement("span");
    s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;` +
      `font:${size}px "${face}";letter-spacing:${track * size}px;${extra}`;
    s.textContent = text;
    document.body.appendChild(s);
    const r = s.getBoundingClientRect().width / size;
    s.remove();
    return r;
  };
  const out = [];
  for (const [face, track, label] of [
    ["Archivo", -0.045, "Archivo @ -0.045em (wdth 125/900)"],
    ["Audiowide", -0.030, "Audiowide @ -0.030em"],
    ["Audiowide", -0.045, "Audiowide @ -0.045em"],
    ["Rubik Glitch", 0, "Rubik Glitch @ 0"],
  ]) {
    const extra = face === "Archivo" ? "font-variation-settings:'wdth' 125;font-weight:900;" : "";
    out.push([label,
      w(face, "BRISKMAN", track, 1000, extra).toFixed(2),
      w(face, "YEHUDA BRISKMAN", track, 1000, extra).toFixed(2),
      w(face, "GET IN TOUCH", track, 1000, extra).toFixed(2)]);
  }
  return out;
});
await browser.close();
console.log("setting".padEnd(36), "BRISKMAN", " YEHUDA BRISKMAN", " GET IN TOUCH");
for (const [a, b, c, d] of rows) console.log(a.padEnd(36), b.padEnd(9), c.padEnd(16), d);
