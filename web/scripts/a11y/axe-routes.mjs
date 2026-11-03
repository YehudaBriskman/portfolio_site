#!/usr/bin/env node
/*
 * The automated half of the accessibility audit (issue #99).
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 *
 * axe-core run against every public route, in both reading directions and
 * both themes (#247), at the desktop width and at 320px. It is the *floor*: the rules axe can decide from
 * the DOM — names, roles, contrast it can measure, landmarks, duplicate ids,
 * heading order, `lang`. It is not the audit. The keyboard walk, focus
 * visibility and obscuring, target size by hand, text spacing and the reduced
 * motion contract are in `docs/accessibility/audit.md`, because axe catches
 * perhaps a third of what a person finds and a green run here must never be
 * quoted as conformance.
 *
 * Since the viewer controls (#99) it also walks the keyboard on every route
 * and fails on three things axe does not decide: a tab stop with no visible
 * focus indicator (2.4.7), a tab stop entirely hidden under sticky chrome
 * (2.4.11), and a focusable control smaller than 24x24 CSS px that is not an
 * inline link in a run of text (2.5.8). And it re-runs a set of routes at
 * Larger text and More contrast, in both themes, so the two controls cannot
 * reintroduce an overflow or a contrast failure.
 *
 * It exists so the floor stays where the audit left it. A pull request that
 * drops a name off a button or a heading level out of a page fails CI here,
 * rather than waiting for the next person who thinks to look.
 *
 * WHY A SCRIPT AND NOT A VITEST FILE
 *
 * The unit suite runs in jsdom, and jsdom has no layout: no computed colour
 * against a painted ground, no boxes, no viewport. Contrast — the rule this
 * site's whole token block is argued against — is unanswerable there. So this
 * drives a real Chromium against the built site, and runs as its own step
 * after `npm run build`.
 *
 * THE API IS STUBBED, DELIBERATELY
 *
 * /blog and /blog/:slug read CouchDB through the API. CI has no API, and an
 * audit of the error state is an audit of the wrong page. So every /api/
 * request is answered here with a small fixture shaped like the real envelope
 * (and validated by the same zod schemas in the app, so a drifted fixture
 * shows up as an error state the run then reports). The error states are
 * still pages a reader can land on, so the run also takes /blog once with
 * the API failing.
 *
 * HEBREW
 *
 * Since #248 the Hebrew site is real: every route is loaded again under
 * `/he`, the address the language menu goes to, so the run audits the Hebrew
 * strings, `lang="he" dir="rtl"` as the app sets them, and the English
 * fallbacks marked `lang="en"` inside it.
 *
 * RUNNING IT
 *
 *   npm run build && npm run a11y
 *
 * It starts `vite preview` on its own port unless BASE is given. `playwright-
 * core` is pinned in package.json and finds its own browser build; on a
 * machine without it, `npx playwright-core install chromium-headless-shell`.
 * CHROME overrides the binary. Exit 1 on any violation; `--json <file>`
 * writes the raw results for the audit document.
 */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { answer, startPreview } from "./site-stub.mjs";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const jsonOut = (() => {
  const i = process.argv.indexOf("--json");
  return i > -1 ? process.argv[i + 1] : null;
})();

/* WCAG 2.2 A and AA, which is the target the issue sets. IS 5568 — the
   Israeli legal floor — is WCAG 2.0 AA with national changes, so it is a
   subset of this run apart from 2.4.10 (section headings, AAA in WCAG and AA
   in IS 5568), which no automated rule decides and the manual audit covers. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const ROUTES = [
  "/",
  "/projects",
  "/projects?sort=name",
  "/projects/bothy",
  "/projects/bothy?tab=notes",
  "/projects/bothy?tab=releases",
  "/projects/bothy?tab=docs",
  "/blog",
  "/blog?view=feed",
  "/blog/area/site",
  "/blog/area/bothy",
  "/blog/log",
  "/blog/log?kind=release&area=site",
  "/blog/fixture-post",
  "/accessibility",
  "/a-page-that-does-not-exist",
  /* The media library (#253): the admin is a page somebody works in daily,
     so it is held to the same floor. The others open one item of each kind. */
  "/admin/media",
  "/admin/media?id=fixture-media",
  "/admin/media?id=fixture-icon",
  "/admin/media?id=fixture-video",
  /* The note editor (#250): toolbar, body, preview and the draft notice. */
  "/admin/posts/fixture-post",
  /* Site settings (#254). */
  "/admin/settings",
];

/* The routes re-run at Larger text and More contrast (#99): one of each
   kind of page, so every layout the controls can stretch is seen. */
const PREF_ROUTES = ["/", "/projects", "/projects/bothy", "/blog", "/blog/fixture-post", "/blog/log", "/accessibility"];

const WINDOWS = [
  ["desktop", 1440, 900],
  /* 1.4.10 Reflow: 320 CSS px is the width the criterion names. */
  ["narrow", 320, 568],
];

/*
 * Both themes (#247), and every run in each. The theme is reached the way a
 * reader on System reaches it — the browser's `prefers-color-scheme` — so
 * the run also proves that System follows the OS; the stored-choice path is
 * checked once per theme below, against the opposite OS setting, so an
 * explicit choice is seen to win. THEMES=light (or dark) narrows a local run.
 */
const THEMES = (process.env.THEMES ?? "light,dark").split(",").map((t) => t.trim()).filter(Boolean);
/* ONLY=axe, ONLY=prefs or ONLY=keyboard narrows a local run to one block. */
const ONLY = process.env.ONLY ?? "";
const want = (block) => !ONLY || ONLY.split(",").includes(block);

/* -------------------------------------------------------------------- run */

const { base, stop } = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });

/*
 * The pen's off state, measured rather than assumed (#174).
 *
 * An unwritten word is deliberately texture — `--ink` at 22%, 1.60:1 — and
 * that is only defensible because the text's real state is full ink and a
 * reader who turns motion off gets exactly that. So every run checks it: each
 * word `motion/Written` made must be painted in the ink its paragraph
 * resolves `--ink` to, at full alpha. axe then measures the contrast of that
 * written state like any other text. The reduced-motion runs cover one
 * switch; the `paused` runs below cover the site's own Pause, with motion
 * otherwise on. The third, a browser without `animation-timeline`, cannot be
 * faked in Chromium and is held by the stylesheet tests.
 */
async function unwrittenWords(page) {
  return page.evaluate(() => {
    const bad = [];
    for (const p of document.querySelectorAll("[data-written]")) {
      const probe = document.createElement("span");
      probe.style.color = "rgb(var(--ink))";
      p.append(probe);
      const ink = getComputedStyle(probe).color;
      probe.remove();
      for (const w of p.querySelectorAll(":scope [data-word]")) {
        if (w.closest("[data-written]") !== p) continue;
        const c = getComputedStyle(w).color;
        if (c !== ink) bad.push(`"${w.textContent}" is ${c}, not ${ink}`);
      }
    }
    return bad;
  });
}

/*
 * The keyboard walk (#99): Tab through the page and judge each stop.
 *
 *   2.4.7  the focused element, or the box it draws its ring on, shows an
 *          outline or a box-shadow that is not there unfocused.
 *   2.4.11 at least one of nine points across the element is the element (or
 *          inside it) by `elementFromPoint`, so sticky chrome does not hide
 *          it entirely. The minimum criterion is "not entirely hidden".
 *   2.5.8  24x24 CSS px, or the criterion's spacing exception: a 24px circle
 *          centred on the undersized target meets no other target and no
 *          other undersized target's circle. An inline link inside a run of
 *          text is exempt outright.
 *
 * Capped at MAX_STOPS so a long index does not make the run quadratic; the
 * stops past it are the same components repeated.
 */
const MAX_STOPS = 40;

async function keyboardWalk(page) {
  const bad = [];
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
  });
  const seen = new Set();
  for (let i = 0; i < MAX_STOPS; i++) {
    await page.keyboard.press("Tab");
    /* Chrome that reveals itself on focus (the phone reading bar) does it
       on a state change, so give it a moment rather than a frame. */
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { end: true };
      const name =
        (el.getAttribute("aria-label") || el.textContent || el.getAttribute("href") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
      const id = `${el.tagName.toLowerCase()} "${name}"`;
      const box = el.getBoundingClientRect();

      // 2.4.7: an indicator painted while focused.
      const drawn = (node) => {
        const cs = getComputedStyle(node);
        const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1;
        return outline || (cs.boxShadow && cs.boxShadow !== "none");
      };
      let visible = drawn(el);
      for (const pseudo of ["::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.content !== "none" && ((cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1) || cs.boxShadow !== "none")) visible = true;
      }
      // A ring drawn on the row inside (the tree's branch `li` draws on its
      // first row, APG's structure) counts.
      if (!visible && el.firstElementChild && drawn(el.firstElementChild)) visible = true;
      // A ring drawn on a wrapper by :focus-within counts.
      for (let p = el.parentElement, n = 0; !visible && p && n < 3; p = p.parentElement, n++) {
        if (p.matches(":focus-within") && drawn(p)) visible = true;
      }

      // 2.4.11: not entirely hidden.
      // Sampled across the part of the box that is inside the viewport, so a
      // tab panel taller than the screen is judged by what is on it; a box
      // with no part on screen is hidden by definition.
      let shown = 0;
      const vis = {
        left: Math.max(box.left, 0),
        top: Math.max(box.top, 0),
        right: Math.min(box.right, innerWidth),
        bottom: Math.min(box.bottom, innerHeight),
      };
      if (vis.right > vis.left && vis.bottom > vis.top) {
        for (const fx of [0.15, 0.5, 0.85]) {
          for (const fy of [0.15, 0.5, 0.85]) {
            const x = vis.left + (vis.right - vis.left) * fx;
            const y = vis.top + (vis.bottom - vis.top) * fy;
            const hit = document.elementFromPoint(x, y);
            if (hit && (hit === el || el.contains(hit) || hit.contains(el))) shown++;
          }
        }
      }

      // 2.5.8: the inline-link exemption is a link whose parent is running
      // text (other text nodes beside it).
      const inline =
        el.tagName === "A" &&
        getComputedStyle(el).display === "inline" &&
        [...(el.parentElement?.childNodes ?? [])].some((c) => c !== el && c.nodeType === 3 && c.textContent.trim());
      let small = !inline && (box.width < 24 - 0.5 || box.height < 24 - 0.5);
      if (small) {
        // The spacing exception, measured against every other visible target.
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const targets = [...document.querySelectorAll("a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex='-1']), [role='button'], [role='link']")]
          .filter((t) => t !== el && !t.contains(el) && !el.contains(t))
          .map((t) => t.getBoundingClientRect())
          .filter((b) => b.width > 0 && b.height > 0);
        const clash = targets.some((b) => {
          const dx = Math.max(b.left - cx, 0, cx - b.right);
          const dy = Math.max(b.top - cy, 0, cy - b.bottom);
          if (Math.hypot(dx, dy) < 12) return true;
          const under = b.width < 23.5 || b.height < 23.5;
          return under && Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) < 24;
        });
        small = clash;
      }

      return { id, visible, shown, small, w: box.width, h: box.height };
    });
    if (r.end) break;
    if (seen.has(r.id)) break;
    seen.add(r.id);
    if (!r.visible) bad.push(`2.4.7 no focus indicator: ${r.id}`);
    if (r.shown === 0) bad.push(`2.4.11 focus entirely hidden: ${r.id}`);
    if (r.small) bad.push(`2.5.8 target ${r.w.toFixed(0)}x${r.h.toFixed(0)}: ${r.id}`);
  }
  return bad;
}

async function audit(
  route,
  lang,
  [label, width, height],
  { failing = false, paused = false, theme = "light", stored = false, prefs = null, keyboard = false } = {},
) {
  /* Reduced motion so the entry shutter and the arrivals settle at once:
     axe measures contrast against what is painted, and a heading caught
     mid-fade reads as a contrast failure that no reader ever sees. The
     motion paths themselves are covered by hand in the audit.
     `paused` instead leaves motion on and sets the site's own Pause before
     the page loads, the way a returning reader who paused it arrives. */
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: paused ? "no-preference" : "reduce",
    /* System, unless `stored`: then the OS says the opposite and the
       reader's stored choice has to win (#247). */
    colorScheme: stored ? (theme === "dark" ? "light" : "dark") : theme,
  });
  if (stored) await context.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
  if (paused) await context.addInitScript(() => localStorage.setItem("yb-motion-paused", "1"));
  /* The viewer controls (#99), stored the way a returning reader has them. */
  if (prefs) {
    await context.addInitScript(([size, contrast]) => {
      localStorage.setItem("yb-text-size", size);
      localStorage.setItem("yb-contrast", contrast);
    }, [prefs.textSize, prefs.contrast]);
  }
  await context.route("**/api/**", (r) => {
    const { status, body } = answer(r.request().url(), failing);
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const at = lang === "he" ? (route.startsWith("/?") || route === "/" ? `/he${route.slice(1)}` : `/he${route}`) : route;
  await page.goto(base + at, { waitUntil: "load" });
  const docLang = await page.evaluate(() => `${document.documentElement.lang}/${document.documentElement.dir}`);
  if (docLang !== (lang === "he" ? "he/rtl" : "en/ltr")) errors.push(`document is ${docLang}`);
  /* Headless Chromium on the dev box has almost no rAF clock, so the
     default rAF polling would wait on a frame that never comes. */
  await page
    .waitForFunction(() => !document.querySelector("div[data-state][aria-hidden='true']"), null, { polling: 500, timeout: 15_000 })
    .catch(() => errors.push("entry shutter never left"));
  await page
    .waitForFunction(() => document.querySelector("h1") !== null, null, { polling: 500, timeout: 15_000 })
    .catch(() => errors.push("no h1 rendered"));
  await page.evaluate(() => document.fonts.ready);
  if (paused) {
    await page
      .waitForFunction(() => document.body.classList.contains("motion-paused"), null, { polling: 500, timeout: 15_000 })
      .catch(() => errors.push("Pause never applied"));
  }
  await page.waitForTimeout(600);
  for (const w of (await unwrittenWords(page)).slice(0, 3)) errors.push(`pen off state not at ink: ${w}`);
  /* The theme the run asked for is the theme on the page (#247), or every
     number below is measured against the wrong ground. */
  const painted = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (painted !== theme) errors.push(`theme is ${painted}, expected ${theme}${stored ? " (stored)" : " (System)"}`);
  /* #242: a dark ground under the bar must have the bar in its dark
     material. Paper over a dark page drew the current room's link in
     paper's ink on the dark ground, which axe passes: it measures the link
     against the bar's computed paper, not the dark it was painted over. */
  const chrome = await page.evaluate(() => {
    const bar = document.querySelector("header[data-material]");
    if (!bar) return null;
    const edge = bar.getBoundingClientRect().bottom;
    const under = [...document.querySelectorAll('[data-chrome="dark"]')].some((p) => {
      const r = p.getBoundingClientRect();
      return r.height > 0 && r.top < edge && r.bottom > 0;
    });
    /* And the current room against the material's own ground, read from
       the token rather than the composited pixel: a colour transition on
       the link stalled at paper's ink measured 1.06:1 here. */
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const current = bar.querySelector("a[aria-current]");
    let ratio = null;
    if (current) {
      const fg = getComputedStyle(current).color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const bg = getComputedStyle(bar).getPropertyValue("--paper").trim().split(/\s+/).map(Number);
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      ratio = (hi + 0.05) / (lo + 0.05);
    }
    return { under, material: bar.getAttribute("data-material"), ratio };
  });
  if (chrome?.under && chrome.material !== "dark") errors.push(`bar is ${chrome.material} over a dark ground`);
  if (chrome?.ratio != null && chrome.ratio < 4.5) errors.push(`current nav link at ${chrome.ratio.toFixed(2)}:1 on the ${chrome.material} bar`);

  if (prefs) {
    const on = await page.evaluate(() => [
      document.documentElement.getAttribute("data-text-size"),
      document.documentElement.getAttribute("data-contrast"),
    ]);
    if (on[0] !== prefs.textSize || on[1] !== prefs.contrast) errors.push(`viewer controls are ${on.join("/")}, expected ${prefs.textSize}/${prefs.contrast}`);
    /* 1.4.4 at Larger: `body` clips sideways overflow, so the reflow number
       below stays 0 even when a word runs off the screen. Read the text's
       own boxes instead: no visible element in main that holds text and
       nothing else may end past the viewport, unless it sits in a scroll
       container, which 1.4.10 allows for content that needs it. */
    const clipped = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("main *")) {
        if (el.children.length || !el.textContent.trim()) continue;
        if (el.closest("[aria-hidden='true'], pre, table, [hidden]")) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue;
        if (r.right <= innerWidth + 1 && r.left >= -1) continue;
        let scrolls = false;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const ox = getComputedStyle(a).overflowX;
          if (ox === "auto" || ox === "scroll") scrolls = true;
        }
        if (!scrolls) out.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`);
      }
      return out;
    });
    for (const c of clipped.slice(0, 3)) errors.push(`1.4.4 text runs off the screen at ${prefs.textSize}: ${c}`);
  }
  if (keyboard) {
    errors.push(...(await keyboardWalk(page)));
    /* Back to the top, unfocused, so axe measures the page a reader lands
       on: the walk leaves the bar over whichever section the last stop was
       in, and its material swap is scroll-driven, which this box's headless
       Chromium runs too rarely to have settled. */
    await page.evaluate(() => {
      document.activeElement?.blur?.();
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
  }

  await page.addScriptTag({ content: AXE });
  const result = await page.evaluate(
    (tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] }),
    TAGS,
  );
  /* 1.4.10 is not an axe rule. Checked directly: nothing may push the
     document wider than the viewport at 320px. */
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await context.close();
  return {
    route:
      route +
      (failing ? " (API down)" : "") +
      (paused ? " (Pause)" : "") +
      (stored ? " (stored)" : "") +
      (prefs ? ` (text ${prefs.textSize}, contrast ${prefs.contrast})` : "") +
      (keyboard ? " (keyboard)" : ""),
    lang: `${lang}, ${theme}`,
    window: label,
    overflow,
    errors,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      tags: v.tags.filter((t) => /^wcag\d/.test(t)),
      nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary })),
    })),
  };
}

const results = [];
try {
  for (const theme of THEMES) {
    if (want("axe")) {
      for (const lang of ["en", "he"]) {
        for (const win of WINDOWS) {
          for (const route of ROUTES) results.push(await audit(route, lang, win, { theme }));
        }
      }
      results.push(await audit("/blog", "en", WINDOWS[0], { failing: true, theme }));
      results.push(await audit("/blog/fixture-post", "en", WINDOWS[1], { failing: true, theme }));
      results.push(await audit("/blog/log", "en", WINDOWS[1], { failing: true, theme }));
      /* The pen's prose, under the site's own Pause rather than reduced motion. */
      for (const route of ["/", "/story", "/projects/bothy", "/blog/fixture-post"]) {
        results.push(await audit(route, "en", WINDOWS[0], { paused: true, theme }));
        results.push(await audit(route, "he", WINDOWS[1], { paused: true, theme }));
      }
      /* A stored choice against the opposite OS setting: the choice wins. */
      results.push(await audit("/", "en", WINDOWS[0], { theme, stored: true }));
      results.push(await audit("/blog", "en", WINDOWS[1], { theme, stored: true }));
    }
    /* The viewer controls at their strongest (#99): Larger text and More
       contrast, at both widths, so neither can bring back an overflow at
       320px or a contrast failure. */
    if (want("prefs")) {
      for (const route of PREF_ROUTES) {
        for (const win of WINDOWS) {
          results.push(await audit(route, "en", win, { theme, prefs: { textSize: "larger", contrast: "more" } }));
        }
      }
    }
  }
  /* The keyboard walk, once per page and width. Theme does not move a
     ring's presence, its box or a target's size, so light is enough; and a
     query-string variant is the same components re-sorted, so each page is
     walked once, which keeps the CI step inside its budget. */
  if (want("keyboard")) {
    for (const route of ROUTES.filter((r) => !r.includes("?"))) {
      for (const win of WINDOWS) results.push(await audit(route, "en", win, { keyboard: true }));
    }
  }
} finally {
  await browser.close();
  stop();
}

let failed = 0;
for (const r of results) {
  const bad = r.violations.length > 0 || r.overflow > 0 || r.errors.length > 0;
  if (!bad) continue;
  failed++;
  console.log(`\n✗ ${r.route}  [${r.lang}, ${r.window}]`);
  if (r.overflow > 0) console.log(`  1.4.10 reflow: document is ${r.overflow}px wider than the viewport`);
  for (const e of r.errors) console.log(`  page error: ${e}`);
  for (const v of r.violations) {
    console.log(`  ${v.id} (${v.impact}; ${v.tags.join(", ")}): ${v.help}`);
    for (const n of v.nodes.slice(0, 4)) console.log(`    ${n.target}`);
    if (v.nodes.length > 4) console.log(`    …and ${v.nodes.length - 4} more`);
  }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2));
console.log(
  `\n${results.length - failed}/${results.length} route runs clean (axe ${TAGS.join(" ")}; reflow at 320px; ` +
    `keyboard walk for 2.4.7, 2.4.11, 2.5.8; Larger text and More contrast)`,
);
process.exit(failed ? 1 : 0);
