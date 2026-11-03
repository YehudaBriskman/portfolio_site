#!/usr/bin/env node
/*
 * The head and the H1 as a browser holds them after the app has run (#308):
 * on a hard load of each path, and again after a client-side navigation to
 * it from the first path, which is where a single-page app's head drifts
 * from the server render's.
 *
 *   xvfb-run -a node scripts/seo/rendered-head.mjs --base http://127.0.0.1:8080 / /he /he/projects
 */
import { chromium } from "playwright-core";

const argv = process.argv.slice(2);
const bi = argv.indexOf("--base");
const BASE = (bi >= 0 ? argv.splice(bi, 2)[1] : "http://127.0.0.1:8080").replace(/\/+$/, "");
const paths = argv.length ? argv : ["/", "/he"];

const read = () => {
  const m = (sel) => document.querySelector(sel)?.getAttribute("content") ?? document.querySelector(sel)?.getAttribute("href") ?? null;
  return {
    lang: document.documentElement.lang,
    title: document.title,
    description: m('meta[name="description"]'),
    canonical: m('link[rel="canonical"]'),
    ogTitle: m('meta[property="og:title"]'),
    ogLocale: m('meta[property="og:locale"]'),
    robots: m('meta[name="robots"]'),
    hreflang: document.querySelectorAll("link[rel=alternate][hreflang]").length,
    h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()),
  };
};

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ reducedMotion: "reduce" });
const settle = async () => {
  await page.waitForFunction(() => document.querySelector("main h1"), null, { polling: 500, timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
};
const out = { hard: {}, navigated: {} };
for (const p of paths) {
  await page.goto(BASE + p, { waitUntil: "load" });
  await settle();
  out.hard[p] = await page.evaluate(read);
}
await page.goto(BASE + paths[0], { waitUntil: "load" });
await settle();
for (const p of paths.slice(1)) {
  await page.evaluate((to) => {
    history.pushState({}, "", to);
    dispatchEvent(new PopStateEvent("popstate"));
  }, p);
  await settle();
  out.navigated[p] = await page.evaluate(read);
}
await browser.close();
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
