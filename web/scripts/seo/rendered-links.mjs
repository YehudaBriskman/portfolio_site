#!/usr/bin/env node
/*
 * The second half of the audit's link graph (#308): the internal links a
 * page has once its JavaScript has run, which is what Google's renderer sees
 * after the raw-HTML pass that audit.mjs measures.
 *
 *   xvfb-run -a node scripts/seo/rendered-links.mjs --base http://127.0.0.1:8080 / /he /blog
 *
 * Prints, per page, the sorted set of internal paths its rendered DOM links
 * to. Waits by polling with a timer and never on animation frames (this
 * box's headless Chromium has almost no frame clock).
 */
import { chromium } from "playwright-core";

const argv = process.argv.slice(2);
const bi = argv.indexOf("--base");
const BASE = (bi >= 0 ? argv.splice(bi, 2)[1] : "http://127.0.0.1:8080").replace(/\/+$/, "");
const paths = argv.length ? argv : ["/", "/he"];

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ reducedMotion: "reduce" });
const out = {};
for (const p of paths) {
  await page.goto(BASE + p, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("main a[href], nav a[href], footer a[href]").length > 3, null, { polling: 500, timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  out[p] = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll("a[href]")].map((a) => new URL(a.href, location.href)).filter((u) => u.origin === location.origin).map((u) => u.pathname))].sort(),
  );
}
await browser.close();
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
