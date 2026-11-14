#!/usr/bin/env node
/*
 * Bottom sheets on a phone, with real touch events (CDP) in Chromium, against
 * the repo's own harnesses served by Vite (no build needed):
 *
 *   npm run a11y:bottom-sheet-phone              all checks, about 30 s
 *   CHECK=reopen npm run a11y:bottom-sheet-phone one check
 *
 * Checks: reopen (a drag-dismissed sheet rises to the same place every time),
 * native-close (dialog.close() reaches the component, the opener works),
 * flick (a quick flick down dismisses a single-snap sheet), history (an action
 * from the More sheet leaves no dead Back entry), focus (More, Delete, Keep
 * lands focus on a control, not <body>).
 *
 * Fixed waits, never rAF: headless Chromium here emits about one frame per
 * 40 s. CHROME overrides the browser binary.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium, devices } = require("playwright-core");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* The harnesses are built, not served from dev: a built page is what a phone gets, and a dev server pre-bundles React differently. */
const { build, preview } = require("vite");
const servers = [];
async function serve(name) {
  const out = resolve(WEB, `dist-harness-${name}`);
  await build({ configFile: resolve(WEB, `test-harness/vite.${name}.config.ts`), root: resolve(WEB, "test-harness"), logLevel: "silent", build: { outDir: out, emptyOutDir: true } });
  const s = await preview({ configFile: false, root: WEB, logLevel: "silent", build: { outDir: out }, preview: { host: "127.0.0.1", port: 0 } });
  servers.push(s);
  return `http://127.0.0.1:${s.httpServer.address().port}/${name}.html`;
}
const names = process.env.CHECK ? process.env.CHECK.split(",") : ["reopen", "native-close", "flick", "history", "focus"];
const MOBILE = names.some((n) => ["reopen", "native-close"].includes(n)) ? await serve("mobile") : "";
const SELECTION = names.some((n) => ["flick", "history", "focus"].includes(n)) ? (await serve("selection")) + "?state=select" : "";

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });

async function phone() {
  const c = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await c.newPage();
  return page;
}
async function tap(page, loc) {
  const r = await loc.boundingBox();
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
}
async function touchDrag(page, x, y0, y1, { steps = 8, stepMs = 16, holdMs = 0 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (y) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(y0) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(y0 + ((y1 - y0) * i) / steps) });
    await sleep(stepMs);
  }
  if (holdMs) await sleep(holdMs);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const headPoint = (page) =>
  page.evaluate(() => {
    const r = document.querySelector("dialog[open] [data-sheet-header]").getBoundingClientRect();
    return { x: r.x + r.width / 2 - 60, y: r.y + r.height - 6 };
  });
const sheet = (page) =>
  page.evaluate(() => {
    const d = document.querySelector("dialog");
    const r = d.getBoundingClientRect();
    return { open: d.open, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, inline: d.getAttribute("style") || "", dragging: d.dataset.dragging };
  });

const checks = {
  async reopen() {
    const page = await phone();
    await page.goto(MOBILE);
    await sleep(800);
    const opener = page.locator("button.a-btn").first();
    await tap(page, opener);
    await sleep(700);
    const first = await sheet(page);
    for (let i = 0; i < 3; i++) {
      const h = await headPoint(page);
      await touchDrag(page, h.x, h.y, h.y + 450, { steps: 10, stepMs: 40, holdMs: 400 });
      await sleep(600);
      await tap(page, opener);
      await sleep(900);
      const s = await sheet(page);
      if (!s.open || s.top !== first.top || s.bottom !== first.bottom || s.inline !== "" || s.dragging) {
        return `round ${i + 1}: top=${s.top} bottom=${s.bottom} (first ${first.top}/${first.bottom}) style="${s.inline}" dragging=${s.dragging}`;
      }
    }
  },
  async "native-close"() {
    const page = await phone();
    await page.goto(MOBILE);
    await sleep(800);
    const opener = page.locator("button.a-btn").first();
    await tap(page, opener);
    await sleep(600);
    await page.evaluate(() => document.querySelector("dialog").close());
    await sleep(400);
    await tap(page, opener);
    await sleep(800);
    const s = await sheet(page);
    if (!s.open) return "the opener does nothing after a native close";
  },
  async flick() {
    const page = await phone();
    await page.goto(SELECTION);
    await sleep(900);
    await tap(page, page.locator("[role=toolbar] button", { hasText: "More" }));
    await sleep(700);
    const h = await headPoint(page);
    await touchDrag(page, h.x, h.y, h.y + 90, { steps: 5, stepMs: 12 });
    await sleep(700);
    if ((await sheet(page)).open) return "a 90px flick down left the sheet open";
  },
  async history() {
    const page = await phone();
    await page.goto(SELECTION);
    await sleep(900);
    await tap(page, page.locator("[role=toolbar] button", { hasText: "More" }));
    await sleep(600);
    await tap(page, page.locator("dialog[open] button", { hasText: "Mark read" }));
    await sleep(800);
    const st = await page.evaluate(() => history.state);
    if (st && (st.selection || st.sheet)) return `history.state=${JSON.stringify(st)} is left with no owner`;
  },
  async focus() {
    const page = await phone();
    await page.goto(SELECTION);
    await sleep(900);
    await tap(page, page.locator("[role=toolbar] button", { hasText: "More" }));
    await sleep(600);
    await tap(page, page.locator("dialog[open] button", { hasText: /^Delete/ }));
    await sleep(700);
    await tap(page, page.locator("dialog[open] button", { hasText: "Keep" }));
    await sleep(700);
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    if (tag === "BODY") return "focus fell to <body> after Keep";
  },
};

const wanted = process.env.CHECK ? process.env.CHECK.split(",") : Object.keys(checks);
let failed = 0;
for (const name of wanted) {
  if (!checks[name]) throw new Error(`no check "${name}" (have ${Object.keys(checks).join(", ")})`);
  let why;
  try {
    why = await checks[name]();
  } catch (e) {
    why = `threw: ${e.message}`;
  }
  if (why) failed++;
  console.log(`${why ? "FAIL" : "ok  "} ${name}${why ? `  ${why}` : ""}`);
}
await browser.close();
for (const s of servers) await s.close();
process.exit(failed ? 1 : 0);
