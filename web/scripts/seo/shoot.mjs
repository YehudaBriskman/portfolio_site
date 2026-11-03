#!/usr/bin/env node
/*
 * A screenshot of a page as a reader first sees it, for the SEO PRs (#308).
 *
 *   xvfb-run -a node scripts/seo/shoot.mjs <url> <out.png> [width] [height]
 *
 * Reduced motion, so the entry shutter is not in the picture; waits by
 * polling for the page's H1, never on animation frames.
 */
import { chromium } from "playwright-core";

const [url, out, width = "1280", height = "800"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, reducedMotion: "reduce" });
await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => document.querySelector("main h1"), null, { polling: 500, timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: out });
await browser.close();
