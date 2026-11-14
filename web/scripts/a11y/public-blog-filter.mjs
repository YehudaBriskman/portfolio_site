#!/usr/bin/env node
/*
 * The Blog search box on a phone (#766, plan PR 4), measured in a real
 * Chromium against the built site with the API stubbed (site-stub.mjs):
 *
 *   npm run build && npm run a11y:public-blog-filter
 *   SHOTS=../docs/design/public-blog-filter/after npm run a11y:public-blog-filter
 *
 * Phones are `hasTouch` + `isMobile` at 360 and 390, Hebrew and English, light
 * and dark. For each it asserts, on /blog and /he/blog:
 *   - the box fits (no horizontal overflow) and every control in it is >= 44px
 *   - the search icon is INSIDE the field, at the inline-start edge
 *   - no keyboard-only helper copy on a coarse pointer; when the helper is
 *     shown (a fine pointer) it keeps >= 40% of the card's width
 *   - the field carries the search-keyboard hints and is >= 16px (iOS zoom)
 *   - a clear (x) button appears once there is text, is 44px, and empties it
 * and on a fine pointer (desktop, and a narrow desktop window) that the
 * helper IS present.
 *
 * Waits are by hand, never rAF: headless Chromium here emits about one frame
 * per 40 s (force:true on clicks, polling 500 on waitForFunction). CHROME
 * overrides the browser binary. Exit 1 on any failure.
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

async function open({ width, height = 800, touch, lang, theme }) {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: touch,
    isMobile: touch,
    deviceScaleFactor: touch ? 2 : 1,
    reducedMotion: "reduce",
    colorScheme: theme,
  });
  await context.route("**/api/**", (r) => {
    const { status, body } = answer(r.request().url(), false);
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => fail(`${lang} ${width}`, `page error ${e}`));
  await page.goto(`${base}${lang === "he" ? "/he" : ""}/blog`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("form[role=search] textarea, form[role=search] input"), null, { polling: 500, timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);
  return { context, page };
}

/* One probe, in the page: everything is measured from the box's own DOM. */
const probe = () => {
  const form = document.querySelector("form[role=search]");
  const field = form.querySelector("textarea, input");
  const r = (el) => el.getBoundingClientRect();
  const box = r(form);
  const controls = [...form.querySelectorAll("button, a")]
    .filter((b) => b.offsetParent !== null)
    .map((b) => ({ name: b.getAttribute("aria-label") || b.textContent.trim(), w: r(b).width, h: r(b).height }));
  const submit = form.querySelector("button[type=submit]");
  const hint = document.getElementById(field.getAttribute("aria-describedby") ?? "");
  const hintShown = !!hint && hint.offsetParent !== null && r(hint).width > 0;
  const rtl = getComputedStyle(form).direction === "rtl";
  const fieldRect = r(form.querySelector("[data-ask-field]") ?? field);
  const s = r(submit);
  return {
    rtl,
    box: { w: box.width },
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    controls,
    hintShown,
    hintW: hintShown ? r(hint).width : 0,
    iconInside: s.left >= fieldRect.left - 0.5 && s.right <= fieldRect.right + 0.5 && s.top >= fieldRect.top - 0.5 && s.bottom <= fieldRect.bottom + 0.5,
    iconAtStart: rtl ? fieldRect.right - s.right < 16 : s.left - fieldRect.left < 16,
    attrs: {
      enterkeyhint: field.getAttribute("enterkeyhint"),
      inputmode: field.getAttribute("inputmode"),
      autocapitalize: field.getAttribute("autocapitalize"),
      autocorrect: field.getAttribute("autocorrect"),
      spellcheck: field.getAttribute("spellcheck"),
    },
    font: parseFloat(getComputedStyle(field).fontSize),
  };
};

function judge(tag, p, { coarse, wide = false }) {
  if (p.overflow > 0) fail(tag, `horizontal overflow ${p.overflow}px`);
  if (coarse) for (const c of p.controls) if (c.h < 43.5 || c.w < 43.5) fail(tag, `target "${c.name}" ${c.w.toFixed(0)}x${c.h.toFixed(0)} < 44`);
  /* The desktop box keeps its search button in the tools row (pixels unchanged). */
  if (!wide && !p.iconInside) fail(tag, "search icon is not inside the field");
  if (!wide && !p.iconAtStart) fail(tag, "search icon is not at the inline-start edge");
  const want = { enterkeyhint: "search", inputmode: "search", autocapitalize: "off", autocorrect: "off", spellcheck: "false" };
  for (const [k, v] of Object.entries(want)) if (p.attrs[k] !== v) fail(tag, `${k}=${p.attrs[k]} (want ${v})`);
  if (p.font < 16) fail(tag, `font ${p.font}px < 16 (iOS zooms)`);
  if (coarse && p.hintShown) fail(tag, "keyboard-instruction helper shown to a touch user");
  if (!coarse && !p.hintShown) fail(tag, "helper missing on a fine pointer");
  if (p.hintShown && p.hintW < 0.4 * p.box.w) fail(tag, `helper ${p.hintW.toFixed(0)}px < 40% of the card (${p.box.w.toFixed(0)}px)`);
}

async function shoot(page, name) {
  if (!SHOTS) return;
  /* The first capture can wait a long frame; retry rather than fail the run. */
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

for (const lang of ["he", "en"])
  for (const theme of ["light", "dark"]) {
    for (const width of [360, 390]) {
      const tag = `${lang} ${theme} ${width} touch`;
      const { context, page } = await open({ width, touch: true, lang, theme });
      judge(tag, await page.evaluate(probe), { coarse: true });
      await shoot(page, `blog-${lang}-${theme}-${width}`);

      /* The clear button: absent while empty, 44px with text, and it empties. */
      const field = page.locator("form[role=search] textarea, form[role=search] input").first();
      const clear = page.locator("form[role=search] button[data-ask-clear]");
      if ((await clear.count()) !== 0) fail(tag, "clear button present on an empty field");
      await field.fill(lang === "he" ? "החלטות" : "decisions");
      await sleep(300);
      if ((await clear.count()) !== 1) fail(tag, "no clear button once there is text");
      else {
        const b = await clear.boundingBox();
        if (b.width < 43.5 || b.height < 43.5) fail(tag, `clear button ${b.width.toFixed(0)}x${b.height.toFixed(0)} < 44`);
        const fb = await page.locator("form[role=search] [data-ask-field]").boundingBox();
        if (b.x < fb.x - 0.5 || b.x + b.width > fb.x + fb.width + 0.5) fail(tag, "clear button outside the field");
        await shoot(page, `blog-${lang}-${theme}-${width}-typed`);
        await clear.click({ force: true });
        await sleep(300);
        if ((await field.inputValue()) !== "") fail(tag, "clear did not empty the field");
        if (!(await field.evaluate((el) => el === document.activeElement))) fail(tag, "clear did not return focus to the field");
      }
      await context.close();
    }
  }

/* Fine pointer: desktop, and a narrow desktop window (helper wraps, is not squeezed). */
for (const lang of ["he", "en"])
  for (const width of [1280, 360]) {
    const tag = `${lang} ${width} mouse`;
    const { context, page } = await open({ width, height: 900, touch: false, lang, theme: "light" });
    judge(tag, await page.evaluate(probe), { coarse: false, wide: width > 640 });
    await shoot(page, `blog-${lang}-light-${width}-mouse`);
    await context.close();
  }

/* The results count is a polite live region that is in the page before it changes. */
for (const lang of ["he", "en"]) {
  const { context, page } = await open({ width: 390, touch: true, lang, theme: "light" });
  await page.goto(`${base}${lang === "he" ? "/he" : ""}/blog?view=feed&q=zzz`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("[data-filter-scope]"), null, { polling: 500, timeout: 30_000 });
  const live = await page.evaluate(() => document.querySelector("[data-filter-scope] p[aria-live]")?.getAttribute("aria-live"));
  if (live !== "polite") fail(`${lang} feed`, `results count live region is ${live}`);
  await context.close();
}

await browser.close();
stop();
if (failures.length) {
  console.error(`public-blog-filter: ${failures.length} failure(s)\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("public-blog-filter: ok");
