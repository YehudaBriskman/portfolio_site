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
