#!/usr/bin/env node
/*
 * The Browse sheet's chip popovers stay inside the sheet (1.7.2 diagnosis #5).
 *
 *   npm run build && npm run a11y:public-browse-popover
 *   SHOTS=../docs/design/diagnosis-fixes/popover npm run a11y:public-browse-popover
 *
 * On /blog and /he/blog at 360x640 and 390x844 (touch), open the Browse sheet
 * from the menu, open every filter chip's popover, and assert that the popover
 * lies inside the sheet's scrolling body (nothing is cut at the sheet's top or
 * bottom edge) and that its first option is visible. Waits are by hand, never
 * rAF: headless Chromium here emits about one frame per 40 s.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./site-stub.mjs";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(resolve(WEB, "package.json"))("playwright-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = process.env.SHOTS ? resolve(process.cwd(), process.env.SHOTS) : "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

async function shoot(page, name) {
  if (!SHOTS) return;
  for (let i = 0; i < 8; i++) {
    try {
      await page.screenshot({ path: join(SHOTS, `${name}.png`), timeout: 20_000 });
      return;
    } catch {
      /* ask again */
    }
  }
  fail(name, "screenshot never completed");
}

const measure = () => {
  const body = document.querySelector("dialog[open]");
  const pop = document.querySelector("dialog[open] [data-filter-scope] [role=dialog]");
  if (!body || !pop) return null;
  const b = body.getBoundingClientRect();
  const p = pop.parentElement.getBoundingClientRect();
  const first = pop.querySelector("button");
  const f = first?.getBoundingClientRect();
  const q = pop.getBoundingClientRect();
  return {
    body: { top: b.top, bottom: b.bottom },
    pop: { top: p.top, bottom: p.bottom },
    firstVisible: !!f && f.top >= q.top - 0.5 && f.bottom <= q.bottom + 0.5 && pop.scrollTop === 0,
  };
};

for (const lang of ["en", "he"])
  for (const [width, height] of [[360, 640], [390, 844]]) {
    const tag = `${lang} ${width}x${height}`;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: "light" });
    await context.route("**/api/**", (r) => {
      const { status, body } = answer(r.request().url(), false);
      return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => fail(tag, `page error ${e}`));
    await page.goto(`${base}${lang === "he" ? "/he" : ""}/blog`, { waitUntil: "load" });
    await page.waitForSelector('button[aria-controls="nav-menu"]', { timeout: 30_000 });
    await sleep(800);
    await page.locator('button[aria-controls="nav-menu"]').click({ force: true });
    await page.locator("#nav-menu [data-local-browse] button").click({ force: true });
    await page.waitForSelector("dialog[open] [data-filter-scope]", { timeout: 30_000, state: "attached" });
    await sleep(800);
    const chips = page.locator("dialog[open] [data-filter-scope] button[aria-haspopup=dialog]");
    const n = await chips.count();
    if (n === 0) fail(tag, "no filter chips in the Browse sheet");
    for (let i = 0; i < n; i++) {
      const name = ((await chips.nth(i).innerText()) || `chip${i}`).trim().split("\n")[0];
      await chips.nth(i).click({ force: true });
      /* Radix parks the wrapper off-screen (translate -200%) until it has measured; wait for that, never for a frame. */
      await page.waitForFunction(
        () => {
          const w = document.querySelector("dialog[open] [data-radix-popper-content-wrapper]");
          return !!w && !w.style.transform.includes("-200%");
        },
        null,
        { polling: 200, timeout: 30_000 },
      );
      await sleep(300);
      /* Without a frame clock the sheet's slide-in sits at its first frame; a screenshot forces the frames to run, then it is measured. */
      for (let t = 0; t < 8; t++) if (await page.screenshot({ timeout: 20_000 }).then(() => true, () => false)) break;
      await sleep(300);
      const m = await page.evaluate(measure);
      if (!m) fail(`${tag} ${name}`, "popover did not open");
      else {
        if (m.pop.top < m.body.top - 0.5) fail(`${tag} ${name}`, `popover top ${m.pop.top.toFixed(0)} is above the sheet body (${m.body.top.toFixed(0)})`);
        if (m.pop.bottom > m.body.bottom + 0.5) fail(`${tag} ${name}`, `popover bottom ${m.pop.bottom.toFixed(0)} is below the sheet body (${m.body.bottom.toFixed(0)})`);
        if (!m.firstVisible) fail(`${tag} ${name}`, "first option is not visible");
      }
      await shoot(page, `popover-${lang}-${width}x${height}-${i}`);
      await page.keyboard.press("Escape");
      await sleep(300);
    }
    await context.close();
  }

await browser.close();
stop();
if (failures.length) {
  console.error(`public-browse-popover: ${failures.length} failure(s)\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("public-browse-popover: ok");
