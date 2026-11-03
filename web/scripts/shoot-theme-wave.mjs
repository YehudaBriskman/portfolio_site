#!/usr/bin/env node
/*
 * The theme menu and the theme wave, shot (#266), into docs/theme-wave/.
 *
 *   npm run build && xvfb-run -a node scripts/shoot-theme-wave.mjs
 *
 * The menu: open, in Light and Dark, at 1440x900 and on a phone (where it
 * lives in the side panel). Its rows are checked as `menuitemradio` with
 * exactly one `aria-checked="true"`.
 *
 * The wave: a real click on the toggle and on "Dark", then frames at 0, 150,
 * 300 and 600ms. Chromium on the dev box runs almost no rAF clock, so the
 * frames are not waited for: the transition's `ready` pauses every animation
 * and each frame is a `currentTime` set by hand, through the Web Animations
 * API — in this script, not in the site. Afterwards the wave is finished,
 * <html> must be clean, and a reload must land on the theme it revealed.
 *
 * CHROME overrides the browser binary.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer, startPreview } from "./a11y/site-stub.mjs";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/theme-wave");
mkdirSync(OUT, { recursive: true });
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const POLL = { polling: 500, timeout: 20_000 };

const { base, stop } = await startPreview();
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  headless: !process.env.DISPLAY,
  args: ["--no-sandbox"],
});

async function open(route, size, theme, reducedMotion = "reduce") {
  const context = await browser.newContext({ viewport: SIZES[size], deviceScaleFactor: 1, reducedMotion });
  /* Seeded once per tab, so a reload reads what the page stored, not this. */
  await context.addInitScript((t) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("yb-theme", t);
  }, theme);
  await context.route("**/api/**", (r) => {
    const { status, body } = answer(r.request().url(), false);
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  await page.goto(base + route, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("h1") !== null, null, POLL);
  await page
    .waitForFunction(() => !document.querySelector("div[data-state][aria-hidden='true']"), null, POLL)
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  return { context, page };
}

async function shot(page, file, opts = {}) {
  for (let i = 0; ; i++) {
    try {
      await page.screenshot({ path: resolve(OUT, file), timeout: 45_000, ...opts });
      console.log(resolve(OUT, file));
      return;
    } catch (e) {
      if (i >= 3) throw e;
    }
  }
}

/* The visible copy of the toggle: the bar's on a desktop, the panel's on a phone. */
async function openMenu(page, size) {
  if (size === "phone") {
    await page.getByRole("button", { name: /^Menu/ }).first().click({ force: true });
    await page.waitForTimeout(800);
  }
  const trigger = page.locator('button[aria-label^="Theme:"]:visible').first();
  await trigger.click({ force: true });
  await page.waitForFunction(() => document.querySelector('[role="menu"]'), null, POLL);
  /* Open means placed and at full size: Radix positions the panel and
     tailwindcss-animate zooms it in from 95%, both on frames this box
     hands out slowly. */
  for (let i = 0; i < 20; i++) {
    const settled = await page.evaluate(() => {
      const menu = document.querySelector('[role="menu"]');
      for (const a of menu?.getAnimations({ subtree: true }) ?? []) a.finish();
      const row = menu?.querySelector('[role="menuitemradio"]');
      const box = menu?.getBoundingClientRect();
      return Boolean(row && row.getBoundingClientRect().height >= 44 && box && box.left > 0 && box.top > 0);
    });
    if (settled) break;
    /* A screenshot makes the compositor produce a frame, which is what the
       panel's placement is waiting on. */
    await page.screenshot({ timeout: 45_000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
  return trigger;
}

const failures = [];
try {
  /* The menu. */
  for (const theme of ["light", "dark"]) {
    for (const size of ["desktop", "phone"]) {
      const { context, page } = await open("/blog", size, theme);
      await openMenu(page, size);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('[role="menu"] [role="menuitemradio"]')].map((r) => ({
          label: r.textContent.trim(),
          checked: r.getAttribute("aria-checked"),
          h: Math.round(r.getBoundingClientRect().height),
          x: Math.round(r.getBoundingClientRect().left),
        })),
      );
      const head = await page.evaluate(() => {
        const label = document.querySelector('[role="menu"] [role="menuitemradio"]');
        const h = label?.parentElement?.parentElement?.querySelector("[class*='head']");
        const icon = label?.querySelectorAll("svg");
        return {
          headText: h ? Math.round(h.getBoundingClientRect().left + parseFloat(getComputedStyle(h).paddingInlineStart)) : null,
          rowContent: label ? Math.round(label.getBoundingClientRect().left + parseFloat(getComputedStyle(label).paddingInlineStart)) : null,
          iconCount: icon?.length ?? 0,
        };
      });
      console.log(theme, size, JSON.stringify(rows), JSON.stringify(head));
      if (rows.length !== 3) failures.push(`${theme}/${size}: ${rows.length} menuitemradio rows`);
      if (rows.filter((r) => r.checked === "true").length !== 1) failures.push(`${theme}/${size}: not exactly one checked`);
      if (rows.some((r) => r.h < 40)) failures.push(`${theme}/${size}: a row under 40px`);
      if (new Set(rows.map((r) => r.h)).size !== 1) failures.push(`${theme}/${size}: uneven rows`);
      if (head.headText !== head.rowContent) failures.push(`${theme}/${size}: heading ${head.headText} vs rows ${head.rowContent}`);

      await shot(page, `menu-${theme}-${size}.png`);
      /* The keyboard ring: arrow onto the next row. */
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(400);
      if (size === "desktop") {
        const box = await page.locator('[role="menu"]').boundingBox();
        await shot(page, `menu-${theme}-${size}-focus.png`, {
          clip: { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: box.height + 48 },
        });
      }
      await context.close();
    }
  }

  /* The wave, Light to Dark and back, on two pages. */
  for (const [route, name] of [["/blog", "blog"], ["/", "home"]]) {
    for (const [from, to, label] of [["light", "dark", "Dark"], ["dark", "light", "Light"]]) {
      const { context, page } = await open(route, "desktop", from, "no-preference");
      await page.evaluate(() => {
        const original = document.startViewTransition.bind(document);
        document.startViewTransition = (update) => {
          const t = original(update);
          window.__vt = t;
          t.ready.then(() => {
            for (const a of document.getAnimations()) a.pause();
            window.__paused = true;
          });
          return t;
        };
      });
      await openMenu(page, "desktop");
      await page.getByRole("menuitemradio", { name: label }).click({ force: true });
      await page.waitForFunction(() => window.__paused === true, null, POLL);
      const found = await page.evaluate(() =>
        document.getAnimations().filter((a) => a.animationName === "theme-wave").length,
      );
      if (found !== 1) failures.push(`${route} ${from}->${to}: ${found} theme-wave animations`);
      for (const ms of [0, 150, 300, 600]) {
        await page.evaluate((t) => {
          for (const a of document.getAnimations()) {
            try {
              a.currentTime = t;
            } catch {
              /* A scroll-driven animation has no clock to set. */
            }
          }
        }, ms);
        await page.waitForTimeout(300);
        await shot(page, `wave-${name}-${from}-to-${to}-${String(ms).padStart(3, "0")}ms.png`);
      }
      await page.evaluate(async () => {
        for (const a of document.getAnimations()) {
          try {
            a.finish();
          } catch {
            /* Scroll-driven: nothing to finish. */
          }
        }
        await window.__vt.finished;
      });
      const after = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute("data-theme"),
        wave: document.documentElement.hasAttribute("data-theme-wave"),
        r: document.documentElement.style.getPropertyValue("--wave-r"),
      }));
      if (after.theme !== to || after.wave || after.r) failures.push(`${route} ${from}->${to}: after ${JSON.stringify(after)}`);
      await page.reload({ waitUntil: "load" });
      const reloaded = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      if (reloaded !== to) failures.push(`${route} ${from}->${to}: reload painted ${reloaded}`);
      await context.close();
    }
  }

  /* Under reduced motion the switch is instant: no transition is started. */
  {
    const { context, page } = await open("/blog", "desktop", "light", "reduce");
    await page.evaluate(() => {
      window.__started = 0;
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = (u) => {
        window.__started++;
        return original(u);
      };
    });
    await openMenu(page, "desktop");
    await page.getByRole("menuitemradio", { name: "Dark" }).click({ force: true });
    const r = await page.evaluate(() => ({ started: window.__started, theme: document.documentElement.getAttribute("data-theme") }));
    if (r.started !== 0 || r.theme !== "dark") failures.push(`reduced motion: ${JSON.stringify(r)}`);
    await context.close();
  }
} finally {
  await browser.close();
  stop();
}

if (failures.length) {
  console.error("\n" + failures.join("\n"));
  process.exit(1);
}
console.log("\nmenu and wave checks: all passed");
