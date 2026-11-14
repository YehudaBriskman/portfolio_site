#!/usr/bin/env node
/*
 * Admin state-change motion on a phone, held as a check (docs/motion-contract.md
 * section 13). Run against a build:
 *
 *   npm run build
 *   npm run a11y:admin-motion
 *   SHOTS=/tmp/motion npm run a11y:admin-motion     (also saves frame strips)
 *
 * This box's headless Chromium has about one animation frame per 40 s, so
 * nothing here waits on time. It reads the Web Animations API instead:
 * `document.getAnimations()` lists the CSS transitions a state change started,
 * and the script PAUSES each one and seeks it to a fraction of its duration to
 * read the computed transform and opacity at that moment, which is the same
 * pixel a viewer would see mid-flight. Taps are dispatched, not clicked
 * (Playwright's click waits for frames); touch drags go through CDP.
 *
 * For every component it checks, with touch emulation, in English (LTR) and
 * Hebrew (RTL), with motion allowed:
 *  - the state flips at once (`dialog.open`, `data-open`, `inert`), before any
 *    animation could have finished;
 *  - enter and exit each start a transition, and the mid-frame is really
 *    between the two ends;
 *  - the sub-page comes from the inline-end edge and leaves toward it
 *    (mirrored in RTL);
 *  - the stuck-state test: open, close and open again fast, 20 times, with the
 *    animations randomly cancelled or finished in between, ends in the state
 *    of the last command, and a closed surface is really closed (not
 *    displayed, not modal, not focusable) once its animation is gone;
 *  - a drag follows the finger 1:1, release settles on a snap, a long pull
 *    down dismisses and the sheet leaves with a transition.
 * With `prefers-reduced-motion: reduce` the same state changes happen with no
 * transition anywhere and the right state at once.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(WEB, "package.json"));
const { chromium } = require("playwright-core");
const { startPreview } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/site-stub.mjs")).href);
const { answer } = await import(pathToFileURL(resolve(WEB, "scripts/a11y/admin-fixtures.mjs")).href);

const SHOTS = process.env.SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const fails = [];
const fail = (m) => fails.push(m);
const ok = (cond, m) => {
  if (!cond) fail(m);
};

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });

async function open(lang, reduced, path) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: reduced ? "reduce" : "no-preference",
    colorScheme: "light",
    locale: lang === "he" ? "he-IL" : "en-US",
  });
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(`${lang}${reduced ? " reduced" : ""} ${path}: page error ${e.message}`));
  await page.goto(`${base}${lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
  return { page, ctx };
}

const waitFor = async (page, fn, arg, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(250);
  }
  return false;
};

/* Frame strips: the protocol's own capture, since page.screenshot waits for a frame. */
async function shot(page, name) {
  if (!SHOTS) return;
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(data, "base64"));
  await cdp.detach();
}

/* ----------------------------------------------- in-page helpers (strings) */

/** Installed once per page: every helper the checks use, so each check is one evaluate. */
const HELPERS = `
window.__m = {
  transitions() {
    return document.getAnimations().filter((a) => a instanceof CSSTransition);
  },
  desc(a) {
    const t = a.effect.target;
    const name = t.id || t.getAttribute("data-surface") || t.className || t.tagName;
    return { prop: a.transitionProperty, on: String(name).slice(0, 40) + (a.effect.pseudoElement || "") };
  },
  /** Pause every transition at fraction f of its own duration; return what a viewer would see. */
  seek(f, filter) {
    const out = [];
    for (const a of this.transitions()) {
      const t = a.effect.target;
      const pe = a.effect.pseudoElement;
      if (filter && !filter(t, pe)) continue;
      const d = a.effect.getComputedTiming().duration;
      a.pause();
      a.currentTime = d * f;
      const cs = getComputedStyle(t, pe);
      out.push({ prop: a.transitionProperty, on: this.desc(a).on, value: cs.getPropertyValue(a.transitionProperty) });
    }
    return out;
  },
  /** The state must flip within a macrotask or two of the tap (a router update is not synchronous), never on an animation. */
  async soon(fn, ms = 150) {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 4));
    }
    return Boolean(fn());
  },
  settle() {
    for (const a of this.transitions()) a.finish();
  },
  cancelAll() {
    for (const a of this.transitions()) a.cancel();
  },
};
`;
async function arm(page) {
  await page.evaluate(HELPERS);
}

/** A sheet's closed state must be real: not shown, not modal, nothing in it focusable. */
const closedForReal = (sel) => `(() => {
  const d = document.querySelector(${JSON.stringify(sel)});
  if (!d) return true;
  const cs = getComputedStyle(d);
  return !d.open && !d.matches(":modal") && cs.display === "none";
})()`;

/* ------------------------------------------------------------ the checks */

/* A computed `translate` keeps percentages: read one axis in px for a box of `size`. */
const axis = (value, i, size) => {
  const part = String(value ?? "").split(" ")[i] ?? "0px";
  if (part.endsWith("%")) return (parseFloat(part) / 100) * size;
  return parseFloat(part) || 0;
};
const tag = (lang, reduced) => `${lang}${reduced ? " reduced" : ""}`;

const seen = { sheet: 0, page: 0 };
async function checkSheet(lang, reduced, path) {
  const t = `${tag(lang, reduced)} ${path}`;
  const { page, ctx } = await open(lang, reduced, path);
  if (!(await waitFor(page, () => document.querySelectorAll("[data-settings-group]").length > 0))) {
    fail(`${t}: settings groups never appeared`);
    await ctx.close();
    return;
  }
  await arm(page);

  /* Find a group that opens as a sheet. */
  const groups = await page.evaluate(() => [...document.querySelectorAll("[data-settings-group]")].map((r) => r.getAttribute("data-settings-group")));
  let sheetId = null;
  let pageId = null;
  for (const id of groups) {
    await page.evaluate((i) => document.querySelector(`[data-settings-group="${i}"] button`)?.click(), id);
    await page.waitForTimeout(150);
    const kind = await page.evaluate(() => (document.querySelector("dialog[open]") ? "sheet" : document.querySelector('[data-surface="page"][data-open="true"], section[data-surface="page"]') ? "page" : "none"));
    if (kind === "sheet") {
      sheetId ??= id;
      await page.evaluate(() => document.querySelector("dialog[open] button[class*=close]")?.click());
    } else if (kind === "page") {
      pageId ??= id;
      await page.evaluate(() => document.querySelector('[data-surface="page"] button')?.click());
    }
    await page.evaluate(() => window.__m.cancelAll());
    await page.waitForTimeout(100);
    if (sheetId && pageId) break;
  }
  if (sheetId) seen.sheet++;
  if (pageId) seen.page++;
  await page.evaluate(() => window.__m.cancelAll());
  await page.waitForTimeout(600); /* let the last exit's kept content go, so the next open is a clean first one */

  if (sheetId) {
    const row = `[data-settings-group="${sheetId}"] button`;
    /* ---- open: state first, then the transition, then the mid-frame. */
    const opened = await page.evaluate((r) => {
      document.querySelector(r)?.click();
      return window.__m.soon(() => document.querySelector("dialog")?.open).then(() => {
        const d = document.querySelector("dialog");
        return { open: Boolean(d?.open), modal: Boolean(d?.matches(":modal")), n: window.__m.transitions().length };
      });
    }, row);
    ok(opened.open && opened.modal, `${t}: the sheet is not open and modal right after the tap`);
    await page.waitForTimeout(120);
    const flying = await page.evaluate(() => window.__m.transitions().map((a) => window.__m.desc(a)));
    if (reduced) ok(flying.length === 0, `${t}: reduced motion still starts ${flying.length} transitions on open (${JSON.stringify(flying.slice(0, 3))})`);
    else {
      ok(flying.some((x) => x.prop === "translate" || x.prop === "transform"), `${t}: opening the sheet starts no slide (${sheetId}: ${JSON.stringify(flying)})`);
      const mid = await page.evaluate(() => window.__m.seek(0.15, (el, pe) => el.tagName === "DIALOG" && !pe));
      const slide = mid.find((x) => x.prop === "translate");
      const y = slide ? axis(slide.value, 1, 844) : NaN;
      ok(Number.isFinite(y) && y > 0, `${t}: early in the rise the sheet is not still below its place (translate ${slide?.value})`);
      await shot(page, `sheet-open-${t.replace(" ", "-")}`);
      const back = await page.evaluate(() => window.__m.seek(0.4, (el, pe) => pe === "::backdrop"));
      ok(back.some((x) => x.prop === "opacity" && Number(x.value) > 0 && Number(x.value) < 1), `${t}: the backdrop does not fade in (${JSON.stringify(back)})`);
    }
    await page.evaluate(() => window.__m.settle());

    /* ---- close: the state flips at once and the exit is a transition. */
    const closed = await page.evaluate(() => {
      const d = document.querySelector("dialog");
      d.querySelector("button[aria-label][class*=close], button[class*=close]").click();
      return { stillOpen: d.open };
    });
    await page.waitForTimeout(150);
    const afterClose = await page.evaluate(() => ({ open: document.querySelector("dialog")?.open, n: window.__m.transitions().map((a) => window.__m.desc(a)) }));
    ok(!afterClose.open && !closed.stillOpen === true || !afterClose.open, `${t}: the sheet is still open after Close`);
    if (reduced) ok(afterClose.n.length === 0, `${t}: reduced motion still animates the exit`);
    else {
      ok(afterClose.n.some((x) => x.prop === "translate" || x.prop === "display" || x.prop === "transform"), `${t}: closing the sheet starts no exit (${JSON.stringify(afterClose.n)})`);
      const mid = await page.evaluate(() => window.__m.seek(0.5, (el, pe) => el.tagName === "DIALOG" && !pe));
      const disp = mid.find((x) => x.prop === "display");
      ok(!disp || disp.value !== "none", `${t}: the sheet is not displayed during its exit (display ${disp?.value})`);
    }
    /* The exit may never decide the state: with every animation cancelled it is closed. */
    await page.evaluate(() => window.__m.cancelAll());
    ok(await page.evaluate(closedForReal("dialog")), `${t}: after Close and cancelled animations the sheet is still shown or modal`);

    /* ---- the stuck-state test: 20 fast open/close, animations torn at random. */
    const stuck = await page.evaluate(async (r) => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      let want = false;
      for (let i = 0; i < 20; i++) {
        const d = document.querySelector("dialog");
        want = i % 2 === 0;
        if (want) document.querySelector(r)?.click();
        else document.querySelector("dialog button[class*=close]")?.click();
        /* A user cannot tap a button that is not drawn yet: let the command land (a router update is async), then tear the animation. */
        await window.__m.soon(() => Boolean(document.querySelector("dialog")?.open) === want, 100);
        await wait(Math.floor(rnd() * 30));
        const k = rnd();
        if (k < 0.3) window.__m.cancelAll();
        else if (k < 0.5) window.__m.settle();
      }
      await wait(60);
      const d = document.querySelector("dialog");
      return { want, open: Boolean(d?.open), modal: Boolean(d?.matches(":modal")) };
    }, row);
    /* Last command was a close (i = 19 is odd). */
    ok(stuck.want === false && stuck.open === false && stuck.modal === false, `${t}: 20 fast open/close left the sheet ${stuck.open ? "open" : "closed"} but the last command was a close`);
    await page.evaluate(() => window.__m.cancelAll());
    ok(await page.evaluate(closedForReal("dialog")), `${t}: after the fast toggling the closed sheet is still displayed`);
    await page.evaluate((r) => document.querySelector(r)?.click(), row);
    await page.waitForTimeout(80);
    await page.evaluate(() => window.__m.cancelAll());
    const reopened = await page.evaluate(() => {
      const d = document.querySelector("dialog");
      return { open: d.open, display: getComputedStyle(d).display, translate: getComputedStyle(d).translate };
    });
    ok(reopened.open && reopened.display !== "none" && /^(none|0px( 0px)?)$/.test(reopened.translate), `${t}: reopening after the toggling does not rest in place (${JSON.stringify(reopened)})`);
    await page.evaluate(() => document.querySelector("dialog button[class*=close]")?.click());
    await page.evaluate(() => window.__m.cancelAll());
  }

  /* ---- the sub-page: pushes from the inline-end edge, pops back. */
  if (pageId) {
    const row = `[data-settings-group="${pageId}"] button`;
    await page.evaluate((r) => document.querySelector(r)?.click(), row);
    const pushed = await page.evaluate(async () => {
      await window.__m.soon(() => document.querySelector('[data-surface="page"]')?.getAttribute("data-open") === "true");
      const p = document.querySelector('[data-surface="page"]');
      return { open: p?.getAttribute("data-open"), inert: p?.inert };
    });
    ok(pushed.open === "true" && pushed.inert === false, `${t}: the page is not open and live right after the tap (${JSON.stringify(pushed)})`);
    await page.waitForTimeout(100);
    const fl = await page.evaluate(() => window.__m.transitions().map((a) => window.__m.desc(a)));
    if (reduced) ok(fl.length === 0, `${t}: reduced motion still animates the page push`);
    else {
      ok(fl.some((x) => x.prop === "translate" || x.prop === "transform"), `${t}: the push starts no slide (${JSON.stringify(fl)})`);
      const start = await page.evaluate(() => window.__m.seek(0, (el) => el.getAttribute?.("data-surface") === "page"));
      const sx = axis(start.find((x) => x.prop === "translate")?.value, 0, 390);
      if (lang === "he") ok(sx < 0, `${t}: in RTL the page does not start from the left edge (translate x ${sx}; ${JSON.stringify(start)})`);
      else ok(sx > 0, `${t}: in LTR the page does not start from the right edge (translate x ${sx}; ${JSON.stringify(start)})`);
      const mid = await page.evaluate(() => window.__m.seek(0.5, (el) => el.getAttribute?.("data-surface") === "page"));
      const mx = axis(mid.find((x) => x.prop === "translate")?.value, 0, 390);
      ok(Math.abs(mx) > 0 && Math.abs(mx) < Math.abs(sx), `${t}: halfway the page is not between the edge and its place (${mx} of ${sx})`);
      await shot(page, `page-push-${t.replace(" ", "-")}`);
    }
    await page.evaluate(() => window.__m.settle());
    const popped = await page.evaluate(async () => {
      document.querySelector('[data-surface="page"] button').click();
      await window.__m.soon(() => document.querySelector('[data-surface="page"]')?.getAttribute("data-open") !== "true");
      const p = document.querySelector('[data-surface="page"]');
      return { open: p?.getAttribute("data-open"), inert: p?.inert };
    });
    ok(popped.open !== "true" && popped.inert !== false, `${t}: the page is not closed and inert right after Back (${JSON.stringify(popped)})`);
    await page.waitForTimeout(100);
    if (!reduced) {
      const ex = await page.evaluate(() => window.__m.transitions().map((a) => window.__m.desc(a)));
      ok(ex.some((x) => x.prop === "translate" || x.prop === "transform"), `${t}: the pop starts no slide (${JSON.stringify(ex)})`);
    }
    await page.evaluate(() => window.__m.cancelAll());
    const rest = await page.evaluate(() => {
      const p = document.querySelector('[data-surface="page"]');
      if (!p) return { gone: true };
      const cs = getComputedStyle(p);
      return { gone: false, visible: cs.visibility !== "hidden" && cs.display !== "none", inert: p.inert };
    });
    ok(rest.gone || (!rest.visible && rest.inert), `${t}: after Back and cancelled animations the page is still reachable (${JSON.stringify(rest)})`);

    /* fast push/pop x20 ends on the last command */
    const stuck = await page.evaluate(async (r) => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      let seed = 11;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 20; i++) {
        const want = i % 2 === 0;
        if (want) document.querySelector(r)?.click();
        else document.querySelector('[data-surface="page"] button')?.click();
        await window.__m.soon(() => (document.querySelector('[data-surface="page"]')?.getAttribute("data-open") === "true") === want, 100);
        await wait(Math.floor(rnd() * 25));
        const k = rnd();
        if (k < 0.3) window.__m.cancelAll();
        else if (k < 0.5) window.__m.settle();
      }
      await wait(60);
      const p = document.querySelector('[data-surface="page"]');
      return { open: p?.getAttribute("data-open") === "true" };
    }, row);
    ok(stuck.open === false, `${t}: 20 fast push/pop left the page open though the last command was Back`);
  }
  await ctx.close();
}

let dragged = 0;
async function checkDrag(lang, path) {
  const t = `${tag(lang, false)} ${path}`;
  const { page, ctx } = await open(lang, false, path);
  if (!(await waitFor(page, () => document.querySelectorAll("[data-settings-group]").length > 0))) {
    await ctx.close();
    return;
  }
  await arm(page);
  /* A group that opens as a sheet: try each. */
  const ids = await page.evaluate(() => [...document.querySelectorAll("[data-settings-group]")].map((r) => r.getAttribute("data-settings-group")));
  let found = false;
  for (const id of ids) {
    await page.evaluate((i) => document.querySelector(`[data-settings-group="${i}"] button`)?.click(), id);
    await page.waitForTimeout(120);
    if (await page.evaluate(() => Boolean(document.querySelector("dialog[open]")))) {
      found = true;
      break;
    }
    await page.evaluate(() => window.__m.cancelAll());
    await page.evaluate(() => document.querySelector('[data-surface="page"] button')?.click());
  }
  if (!found) {
    await ctx.close();
    return;
  }
  dragged++;
  await page.evaluate(() => window.__m.settle());
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: 195, y, id: 1 }] });
  const info = () => page.evaluate(() => {
    const d = document.querySelector("dialog");
    return { snap: d.getAttribute("data-snap"), dragging: d.dataset.dragging === "true", h: parseFloat(d.style.blockSize) || d.getBoundingClientRect().height, transform: d.style.transform, open: d.open };
  });
  const head = await page.evaluate(() => {
    const r = document.querySelector("dialog [data-sheet-header]").getBoundingClientRect();
    return { y: Math.round(r.top + 22) };
  });
  const before = await info();
  ok(before.snap === "half", `${t}: the sheet does not open at half (${before.snap})`);

  /* Up: the height follows the finger 1:1 while it is down. */
  await touch("touchStart", head.y);
  await touch("touchMove", head.y - 40);
  await touch("touchMove", head.y - 120);
  const mid = await info();
  ok(mid.dragging, `${t}: a drag does not mark the sheet as dragging`);
  ok(mid.h > before.h + 30, `${t}: the sheet does not follow the finger 1:1 (${before.h} -> ${mid.h}, finger moved 120)`);
  const noMotionWhileDragging = await page.evaluate(() => window.__m.transitions().filter((a) => ["block-size", "transform"].includes(a.transitionProperty)).length);
  ok(noMotionWhileDragging === 0, `${t}: the sheet lags the finger through a transition while dragging`);
  await shot(page, `sheet-drag-${t}`);
  await touch("touchEnd");
  await page.waitForTimeout(100);
  const up = await info();
  ok(!up.dragging && up.snap === "full", `${t}: releasing after a pull up does not settle on full (${JSON.stringify(up)})`);
  const settle = await page.evaluate(() => window.__m.transitions().map((a) => a.transitionProperty));
  ok(settle.includes("block-size") || settle.includes("height"), `${t}: the snap settle is not a transition (${settle})`);
  await page.evaluate(() => window.__m.settle());

  /* Down, far: dismisses, and the sheet leaves with a transition and ends closed. */
  const head2 = await page.evaluate(() => Math.round(document.querySelector("dialog [data-sheet-header]").getBoundingClientRect().top + 22));
  await touch("touchStart", head2);
  await touch("touchMove", head2 + 60);
  await touch("touchMove", head2 + 400);
  await touch("touchMove", head2 + 700);
  await touch("touchEnd");
  await page.waitForTimeout(150);
  const gone = await page.evaluate(() => ({ open: document.querySelector("dialog")?.open, n: window.__m.transitions().map((a) => a.transitionProperty) }));
  ok(gone.open === false, `${t}: a long pull down does not close the sheet`);
  ok(gone.n.some((p) => ["translate", "transform", "display"].includes(p)), `${t}: the dismissed sheet vanishes with no exit (${gone.n})`);
  await page.evaluate(() => window.__m.cancelAll());
  ok(await page.evaluate(closedForReal("dialog")), `${t}: after a dismissing drag the sheet is still shown`);
  await ctx.close();
}

async function checkRows(lang, reduced) {
  const t = tag(lang, reduced);
  const { page, ctx } = await open(lang, reduced, "/admin/posts");
  if (!(await waitFor(page, () => document.querySelectorAll("[data-record-row]").length > 2))) {
    fail(`${t}: posts never listed`);
    await ctx.close();
    return;
  }
  await arm(page);
  const label = lang === "he" ? "בחירה" : "Select";
  /* Select: the bulk bar rises in. */
  await page.evaluate((l) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim().includes(l)).click(), label);
  await page.evaluate(() => document.querySelector("[data-record-row]").click());
  const bar = await page.evaluate(() => {
    const b = document.querySelector('[role="toolbar"][data-state]');
    return { shown: Boolean(b), state: b?.closest("[data-state]")?.getAttribute("data-state") };
  });
  ok(bar.shown && bar.state === "open", `${t}: the selection bar is not drawn through Presence as open (${JSON.stringify(bar)})`);
  await page.waitForTimeout(100);
  const rise = await page.evaluate(() => window.__m.transitions().map((a) => window.__m.desc(a)));
  if (reduced) ok(rise.length === 0, `${t}: reduced motion still animates the selection bar`);
  else ok(rise.some((x) => ["opacity", "translate"].includes(x.prop)), `${t}: the selection bar rises with no transition (${JSON.stringify(rise)})`);
  await page.evaluate(() => window.__m.settle());
  /* Done: it falls, but is inert at once and is gone when animations are gone. */
  await page.evaluate((l) => [...document.querySelectorAll("button")].find((b) => ["Done", "סיום"].includes(b.textContent.trim()))?.click(), label);
  const fell = await page.evaluate(() => {
    const b = document.querySelector('[role="toolbar"][data-state]');
    const p = b?.closest("[data-state]");
    return { present: Boolean(b), state: p?.getAttribute("data-state"), inert: p?.inert ?? null };
  });
  ok(!fell.present || (fell.state === "closed" && fell.inert === true), `${t}: after Done the bar is neither gone nor inert (${JSON.stringify(fell)})`);
  if (!reduced && fell.present) {
    const ex = await page.evaluate(() => window.__m.transitions().map((a) => window.__m.desc(a)));
    ok(ex.some((x) => ["opacity", "translate"].includes(x.prop)), `${t}: the bar leaves with no transition (${JSON.stringify(ex)})`);
  }
  await page.evaluate(() => window.__m.cancelAll());
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => !document.querySelector('[role="toolbar"][data-state]')), `${t}: the selection bar is still in the page after its exit and a 500ms wait`);
  await ctx.close();
}

async function checkDisclosure(lang, reduced) {
  const t = tag(lang, reduced);
  const { page, ctx } = await open(lang, reduced, "/admin/settings");
  if (!(await waitFor(page, () => Boolean(document.querySelector('[data-testid="settings-history"]'))))) {
    fail(`${t}: no Disclosure on /admin/settings`);
    await ctx.close();
    return;
  }
  await arm(page);
  await page.evaluate(() => document.querySelector('[data-testid="settings-history"] summary').click());
  await page.waitForTimeout(100);
  const st = await page.evaluate(() => ({ open: document.querySelector('[data-testid="settings-history"]').open, n: window.__m.transitions().map((a) => window.__m.desc(a)) }));
  ok(st.open, `${t}: the Disclosure did not open on the tap`);
  if (reduced) ok(st.n.length === 0, `${t}: reduced motion still animates the Disclosure`);
  /* Chromium's ::details-content transitions are not listed by getAnimations() here; the chevron's is, and the CSS side is held by the guard test. */
  else ok(st.n.some((x) => x.prop === "block-size" || x.prop === "height" || x.prop === "transform"), `${t}: the Disclosure opens with no transition (${JSON.stringify(st.n)})`);
  await page.evaluate(() => window.__m.settle());
  await page.evaluate(() => document.querySelector('[data-testid="settings-history"] summary').click());
  ok(await page.evaluate(() => !document.querySelector('[data-testid="settings-history"]').open), `${t}: the Disclosure did not close on the tap`);
  await ctx.close();
}

const SETTINGS_PATHS = ["/admin/settings", "/admin/marketing?tab=settings"];
for (const lang of ["en", "he"]) {
  for (const path of SETTINGS_PATHS) await checkSheet(lang, false, path);
  for (const path of SETTINGS_PATHS) await checkDrag(lang, path);
  await checkRows(lang, false);
  await checkDisclosure(lang, false);
}
/* Reduced motion: the same state changes, no transition anywhere. */
for (const path of SETTINGS_PATHS) await checkSheet("en", true, path);
ok(dragged > 0, "no sheet could be dragged on any settings screen");
ok(seen.sheet > 0, "no settings group opened as a sheet on any screen");
ok(seen.page > 0, "no settings group opened as a page on any screen");
await checkRows("en", true);
await checkDisclosure("en", true);


/* ---- a cold admin load on a phone: no entrance over the app, nothing time-driven at mount (#709). */
async function checkColdLoad() {
  const { page, ctx } = await open("en", false, "/admin/posts");
  try {
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({
      shutter: Boolean(document.querySelector('[class*="shutter"]')),
      timed: document.getAnimations().filter((a) => a instanceof CSSAnimation && a.timeline instanceof DocumentTimeline).map((a) => a.animationName),
    }));
    ok(!r.shutter, "cold admin load at 390px: the entry shutter is covering the app");
    ok(r.timed.length === 0, `cold admin load at 390px: time-driven animations at mount (${JSON.stringify(r.timed)})`);
  } finally {
    await ctx.close();
  }
}
await checkColdLoad();

/* ---- frame strips at t = 0, 80, 160, 240 ms (STRIPS=dir): the transition paused and seeked, then photographed. */
async function strip(page, name, durMs = 300) {
  const dir = process.env.STRIPS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  for (const t of [0, 80, 160, 240]) {
    await page.evaluate(([t]) => { for (const a of window.__m.transitions()) { const d = a.effect.getComputedTiming().duration || 1; a.pause(); a.currentTime = Math.min(d, t * (d / 300)); } }, [t]);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${dir}/${name}-t${String(t).padStart(3, "0")}.png`, Buffer.from(data, "base64"));
  }
  await cdp.detach();
}
if (process.env.STRIPS) {
  for (const [path, group, kind] of [["/admin/marketing?tab=settings", "mail", "sheet"], ["/admin/settings", null, "page"]]) {
    const { page, ctx } = await open("en", false, path);
    await arm(page);
    await page.evaluate(() => window.__m.soon(() => document.querySelector("[data-settings-group] button"), 3000));
    const id = group ?? (await page.evaluate(() => document.querySelector("[data-settings-group]").getAttribute("data-settings-group")));
    await page.evaluate((i) => document.querySelector(`[data-settings-group="${i}"] button`)?.click(), id);
    await page.waitForTimeout(120);
    await strip(page, `${kind}-enter`);
    await page.evaluate(() => window.__m.settle());
    await page.evaluate(() => (document.querySelector("dialog button[class*=close]") ?? document.querySelector('[data-surface="page"] button'))?.click());
    await page.waitForTimeout(120);
    await strip(page, `${kind}-exit`, 200);
    await ctx.close();
  }
}

/* ---- motion pass 3 (#731): the motion budget. For each new case: the state is right at once, a leftover is out of the DOM within a hard
   timeout (animations cancelled or not), nothing animates under reduced motion, nothing animates at >= 600px. */
const HARD_MS = 700; /* EXIT_KEEP_MS is 420: a leftover is gone well inside this, with or without an animation event */
const searchFor = (v) => `(() => {
  const i = document.querySelector('input[type=search]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(v)});
  i.dispatchEvent(new Event("input", { bubbles: true }));
})()`;
const rowsOf = () => `(() => {
  const all = [...document.querySelectorAll("[data-list-row]")];
  const closed = all.filter((r) => r.getAttribute("data-state") === "closed");
  return { open: all.length - closed.length, closed: closed.length, ghostsInert: closed.every((r) => r.inert && r.getAttribute("aria-hidden") === "true"), fresh: all.filter((r) => r.hasAttribute("data-fresh")).length };
})()`;

async function stripPass3(page, name) {
  const dir = process.env.STRIPS3;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  for (const t of [0, 80, 160, 240]) {
    await page.evaluate((t) => { for (const a of window.__m.transitions()) { const d = a.effect.getComputedTiming().duration || 1; a.pause(); a.currentTime = Math.min(d, t); } }, t);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${dir}/${name}-t${String(t).padStart(3, "0")}.png`, Buffer.from(data, "base64"));
  }
  await cdp.detach();
}

async function checkListPresence(lang, reduced) {
  const t = `${tag(lang, reduced)} list rows`;
  const { page, ctx } = await open(lang, reduced, "/admin/posts");
  if (!(await waitFor(page, () => document.querySelectorAll("[data-list-row]").length > 3))) {
    fail(`${t}: posts never listed through ListPresence`);
    await ctx.close();
    return;
  }
  await arm(page);
  const first = await page.evaluate(rowsOf());
  ok(first.fresh === 0, `${t}: rows of the first draw are marked fresh (a page must not animate when it opens)`);
  const total = first.open;

  /* remove: the filter drops rows. State first. */
  await page.evaluate(searchFor("theme"));
  await page.evaluate(async (rows) => { await window.__m.soon(() => document.querySelectorAll('[data-list-row][data-state="open"]').length < rows, 300); }, total);
  const now = await page.evaluate(rowsOf());
  ok(now.open === 1, `${t}: after the filter ${now.open} rows are open, not 1 (the list must be right at once)`);
  if (reduced) {
    ok(now.closed === 0, `${t}: reduced motion keeps ${now.closed} leaving rows in the page`);
    ok((await page.evaluate(() => window.__m.transitions().length)) === 0, `${t}: reduced motion starts transitions on a removal`);
  } else {
    ok(now.closed === total - 1 && now.ghostsInert, `${t}: leaving rows are not all closed and inert at once (${JSON.stringify(now)})`);
    const fl = await page.evaluate(() => window.__m.transitions().map((a) => window.__m.desc(a)));
    ok(fl.some((x) => x.prop === "grid-template-rows") && fl.some((x) => x.prop === "opacity"), `${t}: a removed row does not collapse and fade (${JSON.stringify(fl.slice(0, 4))})`);
    const mid = await page.evaluate(() => window.__m.seek(0.5, (el) => el.matches?.('[data-list-row][data-state="closed"]')));
    const op = mid.find((x) => x.prop === "opacity");
    ok(op && Number(op.value) > 0 && Number(op.value) < 1, `${t}: halfway through a removal the row is not between visible and gone (${op?.value})`);
    await stripPass3(page, `remove-${lang}`);
    /* Hard timeout: with every animation cancelled the leftovers still leave the DOM. */
    await page.evaluate(() => window.__m.cancelAll());
    await page.waitForTimeout(HARD_MS);
    const after = await page.evaluate(rowsOf());
    ok(after.closed === 0, `${t}: ${after.closed} leaving rows are still in the DOM ${HARD_MS}ms after a removal`);
  }

  /* insert: clearing the filter brings rows back. */
  await page.evaluate(() => window.__m.settle());
  await page.evaluate(searchFor(""));
  await page.evaluate(async (n) => { await window.__m.soon(() => document.querySelectorAll('[data-list-row][data-state="open"]').length >= n, 300); }, total);
  const back = await page.evaluate(rowsOf());
  ok(back.open === total && back.closed === 0, `${t}: after clearing the filter the list is not whole at once (${JSON.stringify(back)})`);
  if (reduced) ok(back.fresh === 0 && (await page.evaluate(() => window.__m.transitions().length)) === 0, `${t}: reduced motion animates an insertion`);
  else {
    ok(back.fresh === total - 1, `${t}: inserted rows are not marked fresh (${JSON.stringify(back)})`);
    const fl = await page.evaluate(() => window.__m.transitions().map((a) => window.__m.desc(a)));
    ok(fl.some((x) => x.prop === "grid-template-rows"), `${t}: an inserted row does not grow in (${JSON.stringify(fl.slice(0, 4))})`);
    const start = await page.evaluate(() => window.__m.seek(0, (el) => el.matches?.("[data-list-row][data-fresh]")));
    const op = start.find((x) => x.prop === "opacity");
    ok(op && Number(op.value) < 0.5, `${t}: an inserted row does not start from nothing (${op?.value})`);
    await stripPass3(page, `insert-${lang}`);
    await page.evaluate(() => window.__m.settle());
  }
  await ctx.close();
}

async function checkPopover(lang, reduced) {
  const t = `${tag(lang, reduced)} popover`;
  const { page, ctx } = await open(lang, reduced, "/admin/media");
  const sel = 'button[aria-label^="About"], button[aria-label^="על"]';
  if (!(await waitFor(page, (s) => Boolean(document.querySelector(s)), sel))) {
    fail(`${t}: no info button on /admin/media`);
    await ctx.close();
    return;
  }
  await arm(page);
  /* The media grid still fades in by .a-settle: a transition, and none under reduced motion. */
  const settle = await page.evaluate(() => { const e = document.querySelector(".a-settle"); return e ? getComputedStyle(e).transitionDuration : null; });
  if (settle !== null) ok(reduced ? /^(0s|1e-05s)(, (0s|1e-05s))*$/.test(settle) : settle !== "0s", `${t}: the media grid settle is ${reduced ? "animated under reduced motion" : "not a transition"} (${settle})`);
  await page.evaluate((s) => document.querySelector(s).click(), sel);
  const st = await page.evaluate(async () => {
    await window.__m.soon(() => Boolean(document.querySelector('.pop[data-state="open"]')), 300);
    const p = document.querySelector(".pop");
    const a = document.getAnimations().filter((x) => x.effect?.target === p).map((x) => x.animationName);
    return { open: p?.getAttribute("data-state"), anims: a };
  });
  ok(st.open === "open", `${t}: the popover is not open right after the tap`);
  ok(reduced ? st.anims.length === 0 : st.anims.includes("pop-in"), `${t}: the popover ${reduced ? "animates under reduced motion" : "has no soft enter"} (${JSON.stringify(st.anims)})`);
  if (!reduced) await stripPass3(page, `popover-open-${lang}`);
  await page.evaluate(() => { for (const a of document.getAnimations()) a.finish(); });
  await page.keyboard.press("Escape");
  const ex = await page.evaluate(async () => {
    await window.__m.soon(() => !document.querySelector('.pop[data-state="open"]'), 150);
    const p = document.querySelector(".pop");
    return { gone: !p, state: p?.getAttribute("data-state"), anims: p ? document.getAnimations().filter((x) => x.effect?.target === p).map((x) => x.animationName) : [] };
  });
  ok(ex.gone || ex.state === "closed", `${t}: the popover is still open right after Escape (${JSON.stringify(ex)})`);
  if (!reduced && !ex.gone) ok(ex.anims.includes("pop-out"), `${t}: the popover leaves with no soft exit (${JSON.stringify(ex)})`);
  if (reduced) ok(ex.gone, `${t}: reduced motion keeps the popover for an exit`);
  await page.waitForTimeout(HARD_MS);
  ok(await page.evaluate(() => !document.querySelector(".pop")), `${t}: the popover is still in the DOM ${HARD_MS}ms after Escape`);
  await ctx.close();
}

async function checkPressAndSettle(lang, reduced) {
  const t = `${tag(lang, reduced)} press`;
  const { page, ctx } = await open(lang, reduced, "/admin/posts");
  if (!(await waitFor(page, () => document.querySelectorAll("[data-record-row]").length > 2))) {
    fail(`${t}: posts never listed`);
    await ctx.close();
    return;
  }
  await arm(page);
  const cdp = await ctx.newCDPSession(page);
  const c = await page.evaluate(() => { const r = document.querySelector("[data-record-row]").getBoundingClientRect(); return { x: Math.round(r.left + 60), y: Math.round(r.top + r.height / 2) }; });
  const before = await page.evaluate(() => getComputedStyle(document.querySelector("[data-record-row]")).backgroundColor);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", clickCount: 1 });
  const down = await page.evaluate(async () => {
    const el = document.querySelector("[data-record-row]");
    await window.__m.soon(() => el.matches(":active"), 100);
    const cs = getComputedStyle(el);
    return { active: el.matches(":active"), bg: cs.backgroundColor, dur: cs.transitionDuration.split(",")[0].trim(), running: window.__m.transitions().filter((a) => a.effect.target === el && a.transitionProperty === "background-color").length };
  });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x, y: c.y, button: "left", clickCount: 1 });
  ok(down.active, `${t}: a touch on a row does not make it :active`);
  if (!reduced) ok(down.bg !== before, `${t}: the pressed row has no tint on the first frame (${before} -> ${down.bg})`);
  if (!reduced) ok(down.dur === "0s" && down.running === 0, `${t}: the press tint is tweened (duration ${down.dur}, ${down.running} running), it must be there at once`);
  await ctx.close();
}

async function checkDesktopLists() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference", locale: "en-US" });
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.goto(base + "/admin/posts");
  await page.waitForTimeout(1500);
  await arm(page);
  const res = await page.evaluate(async () => {
    const i = document.querySelector("input[type=search]");
    if (i) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "theme"); i.dispatchEvent(new Event("input", { bubbles: true })); }
    await new Promise((r) => setTimeout(r, 120));
    return { ghosts: document.querySelectorAll('[data-list-row][data-state="closed"]').length, t: window.__m.transitions().filter((a) => a.transitionProperty === "grid-template-rows").length, settle: [...document.querySelectorAll(".a-settle")].map((e) => getComputedStyle(e).transitionDuration) };
  });
  ok(res.ghosts === 0 && res.t === 0, `desktop 1280: list rows leave with motion (${JSON.stringify(res)})`);
  ok(res.settle.every((d) => /^(0s|1e-05s)(, (0s|1e-05s))*$/.test(d)), `desktop 1280: the skeleton settle animates on a wide screen (${JSON.stringify(res.settle)})`);
  await ctx.close();
}

for (const lang of ["en", "he"]) {
  await checkListPresence(lang, false);
  await checkPopover(lang, false);
  await checkPressAndSettle(lang, false);
}
await checkListPresence("en", true);
await checkPopover("en", true);
await checkPressAndSettle("en", true);
await checkDesktopLists();

/* ---- motion pass 4 (#735): true skeleton cross-fade, reorder glide, and the cold-load audit. */
async function stripAny(page, name, filter) {
  const dir = process.env.STRIPS4;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  for (const t of [0, 80, 160, 240]) {
    await page.evaluate(([t, f]) => {
      for (const a of document.getAnimations()) {
        if (f && !new Function("a", `return (${f})(a)`)(a)) continue;
        const d = a.effect.getComputedTiming().duration || 1;
        a.pause();
        a.currentTime = Math.min(d, t);
      }
    }, [t, filter ? String(filter) : null]);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${dir}/${name}-t${String(t).padStart(3, "0")}.png`, Buffer.from(data, "base64"));
  }
  await cdp.detach();
}

/* A phone context whose /api/admin/posts answer is held until release() is called. */
async function openGated(lang, reduced, path, gate) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    reducedMotion: reduced ? "reduce" : "no-preference", colorScheme: "light", locale: lang === "he" ? "he-IL" : "en-US",
  });
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  let release;
  const held = new Promise((r) => (release = r));
  await ctx.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith(gate)) await held;
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(`${lang} ${path}: page error ${e.message}`));
  await page.goto(`${base}${lang === "he" ? "/he" : ""}${path}`, { waitUntil: "load" });
  return { page, ctx, release };
}

async function checkCrossFade(lang, reduced) {
  const t = `${tag(lang, reduced)} skeleton cross-fade`;
  const { page, ctx, release } = await openGated(lang, reduced, "/admin/posts", "/admin/posts");
  if (!(await waitFor(page, () => Boolean(document.querySelector('[data-phase="loading"]'))))) {
    fail(`${t}: no skeleton while the list loads`);
    await ctx.close();
    return;
  }
  await arm(page);
  const skelH = await page.evaluate(() => Math.round(document.querySelector('[data-phase="loading"] .a-skel-row')?.getBoundingClientRect().height ?? 0));
  ok(skelH > 0, `${t}: the skeleton has no height`);
  release();
  await page.evaluate(async () => { await window.__m.soon(() => document.querySelector('[data-list-row]'), 1500); });
  const st = await page.evaluate(() => {
    const sw = document.querySelector("[data-phase]");
    const ghost = sw?.querySelector('[data-state="closed"]');
    return { rows: document.querySelectorAll("[data-list-row]").length, phase: sw?.getAttribute("data-phase"), ghost: Boolean(ghost), inert: ghost?.inert ?? null, t: window.__m.transitions().map((a) => window.__m.desc(a)) };
  });
  ok(st.rows > 3, `${t}: the list is not drawn at once when the data arrives`);
  if (reduced) {
    ok(!st.ghost && st.t.length === 0, `${t}: reduced motion keeps the skeleton or animates (${JSON.stringify(st)})`);
  } else {
    ok(st.phase === "swap" && st.ghost && st.inert, `${t}: the skeleton does not stay as a closed ghost while the list arrives (${JSON.stringify(st)})`);
    ok(st.t.filter((x) => x.prop === "opacity").length >= 2, `${t}: the skeleton and the content do not both fade (${JSON.stringify(st.t)})`);
    const mid = await page.evaluate(() => window.__m.seek(0.5, () => true));
    const ops = mid.filter((x) => x.prop === "opacity").map((x) => Number(x.value));
    ok(ops.length >= 2 && ops.every((v) => v > 0 && v < 1), `${t}: halfway, both layers are not between 0 and 1 (${JSON.stringify(ops)})`);
    await stripAny(page, `crossfade-${lang}`, (a) => a instanceof CSSTransition);
    await page.evaluate(() => window.__m.cancelAll());
    await page.waitForTimeout(HARD_MS);
    const after = await page.evaluate(() => ({ phase: document.querySelector("[data-phase]")?.getAttribute("data-phase"), ghost: Boolean(document.querySelector('[data-phase] [data-state="closed"]')) }));
    ok(after.phase === "ready" && !after.ghost, `${t}: the skeleton ghost is still in the DOM ${HARD_MS}ms after the data arrived (${JSON.stringify(after)})`);
  }
  await ctx.close();
}

async function checkReorder(lang, reduced) {
  const t = `${tag(lang, reduced)} reorder`;
  const { page, ctx } = await open(lang, reduced, "/admin/projects");
  if (!(await waitFor(page, () => Boolean(document.querySelector("main button[aria-pressed]"))))) {
    fail(`${t}: no Reorder button on /admin/projects`);
    await ctx.close();
    return;
  }
  await arm(page);
  await page.evaluate(() => document.querySelector("main button[aria-pressed]").click());
  await page.evaluate(async () => { await window.__m.soon(() => document.querySelectorAll("li[data-i]").length > 2, 500); });
  const before = await page.evaluate(() => [...document.querySelectorAll("li[data-i]")].slice(0, 3).map((l) => l.textContent));
  await page.evaluate(() => document.querySelector('li[data-i="0"] [data-move="down"]').click());
  const after = await page.evaluate(async () => {
    await window.__m.soon(() => true, 20);
    const rows = [...document.querySelectorAll("li[data-i]")];
    const anims = document.getAnimations().filter((a) => a.effect?.target?.matches?.("li[data-i]"));
    for (const a of anims) a.pause(); /* held at the start: the hard timer must still cancel it, and the strip is deterministic */
    return { names: rows.slice(0, 3).map((l) => l.textContent), n: anims.length, tf: anims.map((a) => a.effect.getKeyframes()[0].transform) };
  });
  ok(after.names[0] === before[1] && after.names[1] === before[0], `${t}: the order did not flip at once (${JSON.stringify([before, after.names])})`);
  if (reduced) ok(after.n === 0, `${t}: reduced motion glides (${after.n} animations)`);
  else {
    ok(after.n >= 2 && after.tf.every((x) => /translateY\(/.test(x)), `${t}: the swapped rows do not glide (${JSON.stringify(after)})`);
    await stripAny(page, `reorder-${lang}`, (a) => a.effect?.target?.matches?.("li[data-i]"));
    await page.waitForTimeout(HARD_MS);
    ok((await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.matches?.("li[data-i]")).length)) === 0, `${t}: a glide is still running ${HARD_MS}ms after the move`);
  }
  await ctx.close();
}

/* Cold loads at 390: poll getAnimations for 1.5 s from the first script and list every time-driven entrance. */
async function checkColdLoads() {
  for (const path of ["/admin", "/admin/marketing", "/admin/posts", "/admin/settings"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "no-preference", colorScheme: "light", locale: "en-US" });
    await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
    await ctx.route("**/api/**", (route) => {
      const u = new URL(route.request().url());
      const a = answer(u.pathname, route.request().method(), u.search);
      return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
    });
    await ctx.addInitScript(() => {
      window.__seen = new Map();
      const sample = () => {
        for (const a of document.getAnimations()) {
          const tg = a.effect?.target;
          const el = tg ? (tg.tagName || "?").toLowerCase() + (tg.className && typeof tg.className === "string" ? "." + tg.className.split(" ")[0] : "") + (a.effect.pseudoElement || "") + (tg.getAttribute?.("role") ? "[" + tg.getAttribute("role") + "]" : "") : "?";
          const kind = a instanceof CSSTransition ? "transition:" + a.transitionProperty : a instanceof CSSAnimation ? "animation:" + a.animationName : "waapi";
          const timed = a.timeline instanceof DocumentTimeline;
          window.__seen.set(kind + "|" + el + "|" + (timed ? "time" : "scroll"), 1);
        }
      };
      setInterval(sample, 16);
    });
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForTimeout(1800);
    const seenList = await page.evaluate(() => [...window.__seen.keys()]);
    /* The contract allows: the route fade of a screen's top-level blocks (opacity), and scroll-driven placeholders. Nothing else time-driven. */
    const timed = seenList.filter((k) => k.endsWith("|time"));
    const allowed = (k) => k.startsWith("transition:opacity|") || /^transition:translate\|div\[tabpanel\]\|/.test(k);
    const offenders = timed.filter((k) => !allowed(k));
    ok(offenders.length === 0, `cold load ${path} at 390: time-driven entrances at mount other than the route fade, the tab panel rise and the skeleton cross-fade: ${JSON.stringify(offenders)}`);
    coldReport.push(`${path}: ${timed.length ? timed.join(", ") : "none"}`);
    await ctx.close();
  }
}
const coldReport = [];

for (const lang of ["en", "he"]) {
  await checkCrossFade(lang, false);
  await checkReorder(lang, false);
}
await checkCrossFade("en", true);
await checkReorder("en", true);
await checkColdLoads();
if (process.env.COLD) console.log(coldReport.join("\n"));

/* Desktop (>= 600px) keeps the contract as is: none of the phone motion exists. */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference", locale: "en-US" });
  await ctx.route((u) => !["127.0.0.1", "localhost"].includes(u.hostname), (route) => route.abort());
  await ctx.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const a = answer(u.pathname, route.request().method(), u.search);
    return route.fulfill({ status: a.status ?? 200, contentType: "application/json", body: JSON.stringify(a.body ?? {}) });
  });
  const page = await ctx.newPage();
  await page.goto(base + "/admin/settings");
  await page.waitForTimeout(1500);
  await page.addInitScript(() => {});
  const res = await page.evaluate(async () => {
    document.querySelector("[data-settings-group] button")?.click();
    document.querySelector('[data-testid="settings-history"] summary')?.click();
    await new Promise((r) => setTimeout(r, 120));
    return document
      .getAnimations()
      .filter((a) => a instanceof CSSTransition && ["translate", "block-size", "height", "display"].includes(a.transitionProperty))
      .map((a) => a.transitionProperty + ":" + String(a.effect.target.className).slice(0, 30));
  });
  ok(res.length === 0, `desktop 1280: the phone motion started on a wide screen (${JSON.stringify(res)})`);
  await ctx.close();
}

await browser.close();
stop();
if (fails.length) {
  console.error(`FAIL (${fails.length}):\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("PASS: admin enter/exit motion: state first, transitions in no-preference only, never stuck, mirrored in RTL.");
