#!/usr/bin/env node
/*
 * Lay screenshots side by side in one PNG (no ImageMagick on this box).
 *   node scripts/a11y/montage.mjs out.png "label=path" "label=path" ...
 * Images are scaled to a common 360px column; labels sit above.
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const [out, ...items] = process.argv.slice(2);
const cells = items.map((i) => {
  const k = i.indexOf("=");
  const label = i.slice(0, k);
  const data = readFileSync(i.slice(k + 1)).toString("base64");
  return `<figure><figcaption>${label}</figcaption><img src="data:image/png;base64,${data}"></figure>`;
});
const html = `<body style="margin:0;background:#888;display:flex;gap:10px;padding:10px;align-items:flex-start;font:12px sans-serif">
<style>figure{margin:0;width:360px}figcaption{color:#fff;padding:2px 0}img{width:360px;display:block}</style>${cells.join("")}</body>`;
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: cells.length * 370 + 10, height: 400 } });
await p.setContent(html);
await p.waitForTimeout(500);
await p.screenshot({ path: out, fullPage: true, timeout: 120000 });
await b.close();
