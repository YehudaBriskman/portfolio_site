#!/usr/bin/env node
/*
 * Contact sheets for docs/design/help-split/: for each width and language one
 * PNG, light over dark, the index and three topic pages across.
 *
 *   node scripts/a11y/montage-help.mjs ../docs/design/help-split
 *
 * Reads the `*.view.png` files shoot-public.mjs wrote to shots-390 and
 * shots-1280 and lays them out in a page it screenshots. No image library:
 * there is none on this box.
 */
import { chromium } from "playwright-core";
import { resolve } from "node:path";
import { rmSync, writeFileSync } from "node:fs";

const dir = resolve(process.argv[2] ?? "../docs/design/help-split");
const PAGES = ["help", "help-rss", "help-contact-send-failed", "help-newsletter-check-email"];
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
for (const width of [390, 1280]) {
  const shown = width === 390 ? 390 : 640;
  for (const lang of ["en", "he"]) {
    const cells = ["light", "dark"]
      .map((theme) => PAGES.map((p) => `<img src="file://${dir}/shots-${width}/${p}.${lang}.${theme}.view.png" width="${shown}">`).join(""))
      .map((row) => `<div style="display:flex;gap:12px;margin-bottom:12px">${row}</div>`)
      .join("");
    const page = await browser.newPage({ viewport: { width: (shown + 12) * 4, height: 400 } });
    const html = `${dir}/_montage.html`;
    writeFileSync(html, `<body style="margin:0;background:#888;padding:6px">${cells}</body>`);
    await page.goto(`file://${html}`);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { polling: 500, timeout: 60000 });
    await page.screenshot({ path: `${dir}/montage-${width}-${lang}.png`, fullPage: true, timeout: 120000 });
    await page.close();
  }
}
rmSync(`${dir}/_montage.html`, { force: true });
await browser.close();
