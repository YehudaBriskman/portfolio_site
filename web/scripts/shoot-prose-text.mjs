#!/usr/bin/env node
/*
 * Prose fields as Text, the state chip as a key, activity from structure
 * (#306): the Hebrew pages they reach and the two admin editors whose link
 * labels became bilingual, in both themes, at 1440 and 390, into
 * docs/i18n/build/.
 *
 *   npm run build && xvfb-run -a node scripts/shoot-prose-text.mjs
 *
 * Under xvfb the browser is headed, which is what gives it a frame clock on
 * this box. Every wait polls on a timer (`{ polling: 500 }`), never on rAF.
 * The public API is the a11y stub, with the push events given the `repo`
 * the backend now sends; the admin reads the backend's seed.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./a11y/site-stub.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../docs/i18n/build");
mkdirSync(OUT, { recursive: true });

function seed() {
  const src = readFileSync(resolve(HERE, "../../backend/src/content/seed.ts"), "utf8");
  return JSON.parse(src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1));
}

const SHOTS = [
  ["306-projects-he", "/he/projects", "h1"],
  ["306-log-he", "/he/blog/log", "h1"],
  ["306-admin-projects-links", "/admin/projects", "#project-links-0-label-en"],
  ["306-admin-site-copy-footer", "/admin/site-copy", "#site-footer-work-0-label-en"],
];
const SIZES = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };

const s = seed();
const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: !process.env.DISPLAY, args: ["--no-sandbox"] });
const problems = [];

try {
  for (const [name, path, wait] of SHOTS) {
    for (const theme of ["light", "dark"]) {
      for (const [w, viewport] of Object.entries(SIZES)) {
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
        await ctx.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
        await ctx.route("**/api/**", (route) => {
          const url = new URL(route.request().url());
          const p = url.pathname;
          const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
          if (p === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
          const m = p.match(/^\/api\/admin\/content\/(projects|story|site-copy)$/);
          if (m) {
            return json({ ok: true, key: m[1], exists: true, _rev: "1-seed", published: s[m[1] === "site-copy" ? "siteCopy" : m[1]], draft: null });
          }
          const { status, body } = answer(url.href, false);
          if (p === "/api/activity" && Array.isArray(body?.items)) {
            for (const e of body.items) if (e.kind === "push") e.meta = { ...e.meta, repo: e.area?.title ?? "Bothy" };
          }
          return json(body, status);
        });
        const page = await ctx.newPage();
        page.on("pageerror", (e) => problems.push(`${name}: ${e.message}`));
        await page.goto(base + path, { waitUntil: "load" });
        await page.waitForFunction((sel) => document.querySelector(sel) !== null, wait, { polling: 500, timeout: 20_000 });
        await page.evaluate(() => document.fonts.ready);
        await new Promise((r) => setTimeout(r, 1200));
        if (wait.startsWith("#")) await page.locator(wait).scrollIntoViewIfNeeded();
        /* Retried: a capture on this box sometimes waits on a frame that never comes. */
        for (let i = 0; ; i++) {
          try {
            await page.screenshot({ path: `${OUT}/${name}-${theme}-${w}.png`, timeout: 45_000 });
            break;
          } catch (e) {
            if (i >= 3) throw e;
          }
        }
        console.log("shot", name, theme, w);
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
  stop();
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
