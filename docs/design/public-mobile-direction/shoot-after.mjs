#!/usr/bin/env node
/*
 * Renders ./html/*.html to ./after/*.png (390x844 view + full page, touch
 * emulation), then builds the contact sheets in ./sheets.
 *   node build.mjs && CHROME=<headless shell> node shoot-after.mjs [filter]
 * Polling is by hand; there is no rAF dependence (static pages, no JS).
 */
import { chromium } from "../../../web/node_modules/playwright-core/index.mjs";
import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || "";
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce" });

const files = readdirSync(`${HERE}/html`).filter((f) => f.endsWith(".html") && f.includes(filter));
for (const f of files) {
  const page = await ctx.newPage();
  await page.goto(`file://${HERE}/html/${f}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const base = `${HERE}/after/${f.replace(/\.html$/, "")}`;
  await page.screenshot({ path: base + ".view.png", timeout: 120000 });
  await page.addStyleTag({ content: ".bar,.progress{position:relative!important;top:auto!important}.dock{position:static!important}.aa{position:static!important;margin-top:16px}" });
  await page.screenshot({ path: base + ".full.png", fullPage: true, timeout: 120000 });
  await page.close();
}
console.log("shot", files.length);

/* ---------------------------------------------------------- contact sheets */
const sheet = async (name, cols) => {
  // cols: [[label, relative png path]]
  const cells = cols.filter(([, p]) => existsSync(`${HERE}/${p}`));
  if (cells.length < 2) return;
  const html = `<body style="margin:0;background:#2a2824;font:600 15px system-ui;color:#eee;display:flex;gap:24px;padding:24px;align-items:flex-start;width:max-content">
${cells.map(([l, p]) => `<figure style="margin:0"><figcaption style="padding:0 0 10px;letter-spacing:.04em">${l}</figcaption><div style="width:390px;max-height:2000px;overflow:hidden;border-radius:18px"><img src="file://${HERE}/${p}" width="390" style="display:block"></div></figure>`).join("")}</body>`;
  const pg = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 1 });
  writeFileSync(`${HERE}/sheets/_tmp.html`, html);
  await pg.goto(`file://${HERE}/sheets/_tmp.html`);
  await pg.waitForLoadState("load");
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${HERE}/sheets/${name}.png`, fullPage: true, timeout: 120000 });
  await pg.close();
};
const pairs = { projects: "projects", project: "project", blog: "blog", post: "post", area: "area" };
for (const lang of ["en", "he"]) for (const theme of ["light", "dark"]) {
  for (const [scr, b] of Object.entries(pairs)) {
    await sheet(`${scr}-${lang}-${theme}--before-vs-C`, [
      ["BEFORE (today)", `before/${b}-${lang}-${theme}-full.png`],
      ["C  RECOMMENDED", `after/c-${scr}.${lang}.${theme}.full.png`],
    ]);
  }
  for (const scr of ["projects", "post"]) {
    await sheet(`${scr}-${lang}-${theme}--before-A-B-C`, [
      ["BEFORE", `before/${scr}-${lang}-${theme}-full.png`],
      ["A  GROUPED", `after/a-${scr}.${lang}.${theme}.full.png`],
      ["B  CALM EDITORIAL", `after/b-${scr}.${lang}.${theme}.full.png`],
      ["C  BLEND (rec.)", `after/c-${scr}.${lang}.${theme}.full.png`],
    ]);
  }
}
await browser.close();
import("node:fs").then((fs) => fs.rmSync(`${HERE}/sheets/_tmp.html`, { force: true }));
console.log("sheets done");
