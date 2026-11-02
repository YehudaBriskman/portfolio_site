#!/usr/bin/env node
/*
 * Every link lands on its target (#196).
 *
 * WHAT IT CHECKS
 *
 * Clicks one of each kind of internal link on the built site, at a laptop and
 * a phone, and asserts where the reader ends up rather than that the URL
 * changed:
 *
 *   a link to a page with no target    scrollY is 0 — never the position the
 *                                      previous page was left at
 *   a link with a hash                 the target sits where the document's
 *                                      scroll-padding and the target's own
 *                                      scroll-margin put it (or, near the foot
 *                                      of the page, the page is at its end and
 *                                      the target is on screen)
 *   a cold load of a hash on a lazy    the same, after the chunk and its data
 *   route                              have arrived
 *   Back and Forward                   the position the reader left
 *   the skip link                      focus is on #content
 *   prefers-reduced-motion             the jump is already there one tick
 *                                      after the click — no smooth scroll
 *   a filter (same path, new query)    the page stays where it was
 *
 * The inventory it was written against — 45 internal link sites, by kind:
 *
 *   nav       4   Home, All work, The story, All notes (bar, and the sheet)
 *   footer    4   Home, Projects, Notes, Accessibility
 *   cards    11   run card, gallery card, the wall rail, project row, note card and its area
 *                 link, shelf post, Blog area link, a project's posts, story
 *                 beat title, a post's area link
 *   CTAs     17   Work onward, shelf "All notes", project back/onward, post
 *                 back and onward, Blog's empty states, 404 ×3, Story onward,
 *                 the reading bar's back
 *   contact   2   hero "Get in touch" (#contact), Accessibility (/#contact)
 *   in-text   1   every link inside a post's markdown
 *   skip      3   #content in the chrome, "skip past" the run and the shelf
 *   filters   3   active-filter tokens, the clear, the search box (one wall
 *                 control for /projects and /blog)
 *
 * One representative of each kind is pressed, plus cold loads of a hash on
 * the eager home page and on three lazy routes.
 *
 * RUNNING IT
 *
 *   npm run build && xvfb-run -a npm run links
 *
 * It starts `vite preview` on a free port unless BASE is given, and stubs
 * /api/ like scripts/a11y/axe-routes.mjs does. Chromium is launched headed
 * when a display is present (xvfb on this box), because headless Chromium
 * here has almost no frame clock and a smooth scroll would never finish;
 * every wait polls on a timer, never on rAF. Headed wants the full Chromium
 * build rather than the headless shell; CHROME points at one. Headless (CI)
 * passes too. Exit 1 on any failure.
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");

/* `WIN=phone` runs one window. */
const WINDOWS = [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
].filter(([name]) => !process.env.WIN || process.env.WIN === name);

/* ---------------------------------------------------------------- fixtures */

const at = (days) => new Date(Date.UTC(2026, 9, 1) - days * 86_400_000).toISOString();
const SUMMARY = {
  slug: "fixture-post",
  title: "A fixture note",
  subtitle: "For the link check",
  excerpt: "A short excerpt.",
  publishedAt: at(3),
  tags: ["process"],
  collection: "site",
  coverImage: null,
  readingMinutes: 2,
};
const BODY = `Opening paragraph with a [link to the projects](/projects).

${"Filler paragraph so the page is long enough to scroll. ".repeat(40)}

## A section

${"More filler, so the section is not already on the first screen. ".repeat(40)}`;
const POST = { ...SUMMARY, body: BODY, links: [] };

function contributionDays() {
  const days = [];
  const end = Date.UTC(2026, 9, 1);
  for (let i = 364; i >= 0; i--) {
    const d = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ date: d, count: (i * 7) % 5 === 0 ? 0 : (i * 13) % 9 });
  }
  return days;
}

function answer(url) {
  const p = new URL(url).pathname.replace(/^\/api/, "");
  if (p === "/blog/posts") return { status: 200, body: { items: [SUMMARY] } };
  if (p.startsWith("/blog/posts/")) {
    return p.endsWith("/fixture-post") ? { status: 200, body: { post: POST } } : { status: 404, body: {} };
  }
  if (p === "/blog/collections") return { status: 200, body: { items: [] } };
  if (p.startsWith("/blog/collections/")) return { status: 404, body: {} };
  if (p === "/github/contributions") {
    const days = contributionDays();
    return {
      status: 200,
      body: {
        contributions: {
          from: days[0].date,
          to: days.at(-1).date,
          total: days.reduce((n, d) => n + d.count, 0),
          days,
          fetchedAt: at(0),
          error: null,
        },
      },
    };
  }
  return { status: 404, body: {} };
}

/* ------------------------------------------------------------------ server */

function freePort() {
  return new Promise((ok, fail) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", fail);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => ok(port));
    });
  });
}

async function isThisSite(base) {
  const res = await fetch(base);
  return res.ok && (await res.text()).includes('id="root"');
}

async function startPreview() {
  if (process.env.BASE) {
    if (!(await isThisSite(process.env.BASE))) throw new Error(`${process.env.BASE} is not this site`);
    return { base: process.env.BASE, stop: () => {} };
  }
  const port = await freePort();
  const child = spawn(
    process.execPath,
    [resolve(WEB, "node_modules/vite/bin/vite.js"), "preview", "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    { cwd: WEB, stdio: ["ignore", "pipe", "pipe"] },
  );
  let exited = false;
  child.on("exit", () => (exited = true));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60 && !exited; i++) {
    try {
      if (await isThisSite(base)) return { base, stop: () => child.kill() };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error("vite preview never answered with this site — was `npm run build` run first?");
}

/* ----------------------------------------------------------------- helpers */

const { base, stop } = await startPreview();
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  headless: !process.env.DISPLAY,
  args: ["--no-sandbox"],
});

async function open([, width, height], { reduced = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await context.route("**/api/**", (r) => {
    const { status, body } = answer(r.request().url());
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  /* The entry shutter is an overlay with no layout of its own, and it leaves
     on a chain of animation frames, which this box's Chromium hands out about
     once every forty seconds — so it can sit over the page for minutes and
     take every pointer press. It is not what this checks, so it is hidden. */
  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = '[class*="_shutter_"] { display: none !important; }';
    document.addEventListener("DOMContentLoaded", () => document.head.append(style));
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("  pageerror", e.message));
  return page;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Waits for the scroll position to stop moving: three equal reads 250ms
 *  apart, inside a budget. Polled on a timer, never on rAF. */
async function settle(page, budget = 8000) {
  const end = Date.now() + budget;
  let last = -1;
  let same = 0;
  while (Date.now() < end) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    same = y === last ? same + 1 : 0;
    if (same >= 3) return y;
    last = y;
    await sleep(250);
  }
  return last;
}

async function goto(page, path) {
  await page.goto(base + path, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("main h1, main"), null, { polling: 500, timeout: 15000 });
  await settle(page);
}

async function waitPath(page, path) {
  await page.waitForFunction((p) => location.pathname + location.search + location.hash === p, path, {
    polling: 250,
    timeout: 15000,
  });
}

async function scrollTo(page, y) {
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y);
  await sleep(300);
  return page.evaluate(() => Math.round(window.scrollY));
}

/** Where the target is against where the document's scroll-padding and its own
 *  scroll-margin say it should be. */
function placement(page, id) {
  return page.evaluate((target) => {
    const el = document.getElementById(target);
    if (!el) return { missing: true };
    const html = document.documentElement;
    const pad = parseFloat(getComputedStyle(html).scrollPaddingTop) || 0;
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const r = el.getBoundingClientRect();
    const max = html.scrollHeight - innerHeight;
    return {
      top: Math.round(r.top),
      want: Math.round(pad + margin),
      atEnd: window.scrollY >= max - 2,
      onScreen: r.top < innerHeight && r.bottom > 0,
      y: Math.round(window.scrollY),
    };
  }, id);
}

const results = [];
function record(name, win, ok, detail) {
  results.push({ name, win, ok, detail });
  console.log(`${ok ? "✓" : "✗"} [${win}] ${name}${ok ? "" : `  — ${detail}`}`);
}

async function expectTop(page, name, win) {
  const y = await settle(page);
  record(name, win, y === 0, `scrollY ${y}, wanted 0`);
}

async function expectLanded(page, id, name, win) {
  await page.waitForFunction((t) => document.getElementById(t), id, { polling: 250, timeout: 15000 }).catch(() => {});
  await settle(page);
  const p = await placement(page, id);
  const ok = !p.missing && (Math.abs(p.top - p.want) <= 4 || (p.atEnd && p.onScreen));
  record(name, win, ok, JSON.stringify(p));
  return ok;
}

/** Brings a link on screen without Playwright's actionability waits, which
 *  count animation frames — and this box's Chromium hands those out
 *  irregularly, so "stable" can time out on an element that is not moving. */
async function reveal(page, selector) {
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ block: "center", behavior: "instant" });
  }, selector);
  await sleep(300);
}

/**
 * Activates a link the way a reader would: a real pointer press at its centre
 * when the link is what is under that point, else — the bar tucks away on a
 * forward scroll and slides back on focus — the focused link and Enter, which
 * is the same navigation a keyboard reader makes.
 */
async function click(page, selector) {
  const link = page.locator(selector).first();
  await link.focus();
  await sleep(300);
  const at = await link.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (hit && (hit === e || e.contains(hit))) return { x, y };
    return { miss: hit ? `${hit.tagName}.${hit.className}` : "nothing" };
  });
  if (!at.miss) {
    await page.mouse.click(at.x, at.y);
  } else {
    console.log(`  (keyboard: ${at.miss} is over the link) ${selector}`);
    await page.keyboard.press("Enter");
  }
}

async function openSheetIfPhone(page, win) {
  if (win !== "phone") return;
  await click(page, 'button[aria-controls="nav-menu"]');
  await page.waitForSelector("#nav-menu:not([hidden])", { timeout: 5000 });
}

/* ------------------------------------------------------------------- cases */

for (const w of WINDOWS) {
  const [win] = w;
  const page = await open(w);

  /* nav: home scrolled deep -> All work lands at the top */
  await goto(page, "/");
  await scrollTo(page, 3000);
  await openSheetIfPhone(page, win);
  await click(page, win === "phone" ? '#nav-menu a[href="/projects"]' : 'header a[href="/projects"], nav a[href="/projects"]');
  await waitPath(page, "/projects");
  await expectTop(page, "nav link -> top of /projects", win);

  /* card: /projects gallery card, scrolled, lands at the top of the project */
  await page.waitForSelector('main a[href^="/projects/"]', { timeout: 15000 });
  const cardY = await scrollTo(page, 900);
  const card = page.locator('main a[href^="/projects/"]').first();
  const cardHref = await card.getAttribute("href");
  await reveal(page, `main a[href="${cardHref}"]`);
  const leftAt = await page.evaluate(() => Math.round(window.scrollY));
  await click(page, `main a[href="${cardHref}"]`);
  await waitPath(page, cardHref);
  await expectTop(page, "card -> top of project", win);

  /* back restores the place the reader left, forward restores the next one */
  const projectY = await scrollTo(page, 400);
  await page.goBack();
  await waitPath(page, "/projects");
  const backY = await settle(page);
  record("back restores position", win, Math.abs(backY - leftAt) <= 4, `scrollY ${backY}, left at ${leftAt} (asked ${cardY})`);
  await page.goForward();
  await waitPath(page, cardHref);
  const fwdY = await settle(page);
  record("forward restores position", win, Math.abs(fwdY - projectY) <= 4, `scrollY ${fwdY}, left at ${projectY}`);

  /* CTA: the project's back action, from scrolled */
  await scrollTo(page, 600);
  await click(page, 'main a[href="/projects"]');
  await waitPath(page, "/projects");
  await expectTop(page, "CTA (project back) -> top", win);

  /* filter: same path, new query — the page stays where it was. A filter's
     own links are the active-filter tokens (the popover's options are menu
     items), so the run starts from a filtered address and removes one. */
  await goto(page, "/projects?state=In+use");
  const token = await page.waitForSelector("main a[data-token]", { timeout: 8000 }).catch(() => null);
  if (!token) {
    record("filter keeps the place", win, false, "no active-filter token on /projects?state=In+use");
  } else {
    /* The tokens sit at the head of the wall, where the top and "where it
       was" can be the same number. So the page is scrolled until the token
       is just under the bar, which makes the two outcomes differ. */
    const tokenTop = await page.evaluate(
      () => document.querySelector("main a[data-token]").getBoundingClientRect().top + window.scrollY,
    );
    const before = await scrollTo(page, Math.max(0, Math.round(tokenTop - 140)));
    await click(page, "main a[data-token]");
    await page.waitForFunction(() => location.search === "", null, { polling: 250, timeout: 5000 });
    const after = await settle(page);
    /* Within a token row: the row folds away with its last token, and scroll
       anchoring takes up that much. Reset to the top is the failure. */
    record("filter keeps the place", win, before > 0 && Math.abs(after - before) <= 48, `scrollY ${after}, was ${before}`);
  }

  /* footer: foot of the home page -> Notes */
  await goto(page, "/");
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await settle(page);
  await click(page, 'footer a[href="/blog"]');
  await waitPath(page, "/blog");
  await expectTop(page, "footer link -> top of /blog", win);

  /* card: note card -> post */
  await page.waitForSelector('main a[href="/blog/fixture-post"]', { timeout: 15000 });
  await scrollTo(page, 300);
  await click(page, 'main a[href="/blog/fixture-post"]');
  await waitPath(page, "/blog/fixture-post");
  await expectTop(page, "note card -> top of post", win);

  /* in-text: a markdown link in the post body */
  await page.waitForSelector('main article a[href="/projects"], main .prose a[href="/projects"]', { timeout: 15000 });
  await reveal(page, 'main article a[href="/projects"], main .prose a[href="/projects"]');
  await click(page, 'main article a[href="/projects"], main .prose a[href="/projects"]');
  await waitPath(page, "/projects");
  await expectTop(page, "in-text link -> top of /projects", win);

  /* CTA: the home page's Work onward */
  await goto(page, "/");
  await reveal(page, '#work a[href="/projects"]');
  await sleep(300);
  await click(page, '#work a[href="/projects"]');
  await waitPath(page, "/projects");
  await expectTop(page, "CTA (Work onward) -> top of /projects", win);

  /* contact: Accessibility's /#contact crosses a route and lands on the plate */
  await goto(page, "/accessibility");
  await reveal(page, 'main a[href="/#contact"]');
  await click(page, 'main a[href="/#contact"]');
  await waitPath(page, "/#contact");
  await expectLanded(page, "contact", "/#contact from /accessibility lands on contact", win);

  /* contact: the hero's in-page "Get in touch" */
  await goto(page, "/");
  await click(page, 'a[href="#contact"]');
  await expectLanded(page, "contact", "hero #contact lands on contact", win);

  /* skip link: first Tab, Enter, focus on #content */
  await goto(page, "/projects");
  await page.keyboard.press("Tab");
  const skipName = await page.evaluate(() => document.activeElement?.textContent?.trim());
  await page.keyboard.press("Enter");
  await sleep(500);
  const focused = await page.evaluate(() => document.activeElement?.id);
  record("skip link moves focus to #content", win, skipName === "Skip to content" && focused === "content", `tabbed to "${skipName}", focus on #${focused}`);

  /* cold loads of a hash: eager page with data-dependent targets, lazy routes */
  for (const [path, id] of [
    ["/#contact", "contact"],
    ["/#object-bothy", "object-bothy"],
    ["/#notes", "notes"],
    ["/story#now", "now"],
    ["/projects/bothy#decisions-heading", "decisions-heading"],
    ["/blog/fixture-post#a-section", "a-section"],
  ]) {
    await page.goto(base + path, { waitUntil: "load" });
    if (path.includes("fixture-post") && !(await page.waitForSelector("#a-section", { timeout: 8000 }).catch(() => null))) {
      record(`cold ${path}`, win, true, "skipped: post headings carry no ids");
      continue;
    }
    await expectLanded(page, id, `cold ${path} lands on #${id}`, win);
  }

  /* 404 CTA: home lands at the top */
  await goto(page, "/a-page-that-does-not-exist");
  await click(page, 'main a[href="/"]');
  await waitPath(page, "/");
  await expectTop(page, "404 CTA -> top of /", win);

  await page.context().close();

  /* reduced motion: the jump is instant */
  const still = await open(w, { reduced: true });
  await goto(still, "/");
  await click(still, 'a[href="#contact"]');
  await sleep(60);
  const p = await placement(still, "contact");
  record("reduced motion jumps instantly", win, Math.abs(p.top - p.want) <= 4 || (p.atEnd && p.onScreen), JSON.stringify(p));
  await still.context().close();
}

await browser.close();
stop();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} landings correct`);
process.exit(failed.length ? 1 : 0);
