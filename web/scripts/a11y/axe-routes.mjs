#!/usr/bin/env node
/*
 * The automated half of the accessibility audit (issue #99).
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 *
 * axe-core run against every public route, in both reading directions, at the
 * desktop width and at 320px. It is the *floor*: the rules axe can decide from
 * the DOM — names, roles, contrast it can measure, landmarks, duplicate ids,
 * heading order, `lang`. It is not the audit. The keyboard walk, focus
 * visibility and obscuring, target size by hand, text spacing and the reduced
 * motion contract are in `docs/accessibility/audit.md`, because axe catches
 * perhaps a third of what a person finds and a green run here must never be
 * quoted as conformance.
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
 * The Hebrew locale is listed and disabled (see `nav/locale.ts`) because
 * there are no Hebrew strings yet. What does exist is the right-to-left half:
 * `:root:lang(he)` switches all three faces and the layout is in logical
 * properties. That half is audited the way `shoot-first-screen.mjs` shoots
 * it, by setting `lang` and `dir` on <html> after load. It answers "does the
 * RTL layout hold", not "is the Hebrew site accessible" — there is no Hebrew
 * site yet to ask.
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
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
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
];

const WINDOWS = [
  ["desktop", 1440, 900],
  /* 1.4.10 Reflow: 320 CSS px is the width the criterion names. */
  ["narrow", 320, 568],
];

/* ---------------------------------------------------------------- fixtures */

const at = (days) => new Date(Date.UTC(2026, 9, 1) - days * 86_400_000).toISOString();

/* The one area the fixture note is filed under, and two events for the
   dashboard's timeline: one on the site, one leaving it. */
const AREA = {
  slug: "site",
  title: "The site",
  tagline: "This portfolio.",
  description: "",
  coverImage: null,
  links: [],
  order: 0,
  kind: "site",
  repoUrl: null,
  stats: null,
  noteCount: 1,
  lastActivityAt: at(1),
  topics: [{ tag: "ci", count: 1 }],
};
/* A project area linked to a repo (#225): its facts, docs and side card. */
const BOTHY = {
  ...AREA,
  slug: "bothy",
  title: "Bothy",
  tagline: "The box's portal.",
  kind: "project",
  repoUrl: "https://github.com/example/bothy",
  docs: [{ path: "docs/README.md", url: "https://github.com/example/bothy/blob/main/docs/README.md" }],
  stats: {
    stars: 12,
    forks: 3,
    language: "TypeScript",
    license: "MIT",
    pushedAt: at(2),
    latestRelease: { tag: "v1.9.0", url: "https://github.com/example/bothy/releases/tag/v1.9.0", publishedAt: at(5) },
    fetchedAt: at(1),
  },
};
const EVENTS = [
  { id: "post:fixture-post", kind: "post", at: at(1), area: { slug: "site", title: "The site" }, title: "A fixture note", href: "/blog/fixture-post", meta: {} },
  { id: "site:v1", kind: "site", at: at(3), area: null, title: "Site v1.0.0", href: "https://github.com/example/site/releases/tag/v1.0.0", meta: {} },
  /* Work (#227): a project's release and push, for the cards' strips, the
     releases aside and the project page's Releases tab. */
  { id: "release:bothy:v1.9.0", kind: "release", at: at(4), area: { slug: "bothy", title: "Bothy" }, title: "Bothy v1.9.0", href: "https://github.com/example/bothy/releases/tag/v1.9.0", meta: { tag: "v1.9.0" } },
  { id: "push:bothy", kind: "push", at: at(2), area: { slug: "bothy", title: "Bothy" }, title: "Pushed to Bothy", href: "https://github.com/example/bothy", meta: {} },
];

const SUMMARY = {
  slug: "fixture-post",
  title: "A fixture note for the audit",
  subtitle: "Long enough to wrap at 320px, which is the point of it",
  excerpt: "A short excerpt, so the list has the shape it has in production.",
  publishedAt: at(3),
  updatedAt: at(1),
  tags: ["accessibility", "process"],
  collection: "site",
  coverImage: null,
  readingMinutes: 2,
};

/* The body exercises what the prose renderer emits: headings below the
   page's h1, a list, a link, inline and fenced code, a table, a quote. */
const BODY = `Opening paragraph with a [link to the projects](/projects) and \`inline code\`.

## A section

- one
- two

> A quotation, set as the prose renders it.

\`\`\`ts
const audited = true;
\`\`\`

| Criterion | Status |
| --- | --- |
| 1.4.10 | pass |

### A subsection

Closing paragraph.`;

const POST = { ...SUMMARY, body: BODY, links: [{ label: "Repository", url: "https://example.com/" }] };

function contributionDays() {
  const days = [];
  const end = Date.UTC(2026, 9, 1);
  for (let i = 364; i >= 0; i--) {
    const d = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ date: d, count: (i * 7) % 5 === 0 ? 0 : (i * 13) % 9 });
  }
  return days;
}

function answer(url, failing) {
  if (failing) return { status: 503, body: { error: "unavailable" } };
  const p = new URL(url).pathname.replace(/^\/api/, "");
  if (p === "/blog/posts") return { status: 200, body: { items: [SUMMARY] } };
  if (p.startsWith("/blog/posts/")) {
    return p.endsWith("/fixture-post") ? { status: 200, body: { post: POST } } : { status: 404, body: {} };
  }
  if (p === "/blog/collections") return { status: 200, body: { items: [] } };
  if (p.startsWith("/blog/collections/")) return { status: 404, body: {} };
  /* The Blogs dashboard (#224): its areas and the site's activity. */
  if (p === "/areas") return { status: 200, body: { items: [AREA, BOTHY] } };
  if (p === "/activity") return { status: 200, body: { items: EVENTS, nextCursor: null } };
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

/* A port the OS hands out, never a fixed one. The first version of this
   script used a fixed port, found someone else's static server already on
   it, and audited a directory listing — clean. So the port is fresh, and the
   page that answers must be this site's before anything is measured. */
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

async function audit(route, lang, [label, width, height], { failing = false, paused = false } = {}) {
  /* Reduced motion so the entry shutter and the arrivals settle at once:
     axe measures contrast against what is painted, and a heading caught
     mid-fade reads as a contrast failure that no reader ever sees. The
     motion paths themselves are covered by hand in the audit.
     `paused` instead leaves motion on and sets the site's own Pause before
     the page loads, the way a returning reader who paused it arrives. */
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: paused ? "no-preference" : "reduce",
  });
  if (paused) await context.addInitScript(() => localStorage.setItem("yb-motion-paused", "1"));
  await context.route("**/api/**", (r) => {
    const { status, body } = answer(r.request().url(), failing);
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + route, { waitUntil: "load" });
  if (lang === "he") {
    await page.evaluate(() => {
      document.documentElement.lang = "he";
      document.documentElement.dir = "rtl";
    });
  }
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
    route: route + (failing ? " (API down)" : "") + (paused ? " (Pause)" : ""),
    lang,
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
  for (const lang of ["en", "he"]) {
    for (const win of WINDOWS) {
      for (const route of ROUTES) results.push(await audit(route, lang, win));
    }
  }
  results.push(await audit("/blog", "en", WINDOWS[0], { failing: true }));
  results.push(await audit("/blog/fixture-post", "en", WINDOWS[1], { failing: true }));
  results.push(await audit("/blog/log", "en", WINDOWS[1], { failing: true }));
  /* The pen's prose, under the site's own Pause rather than reduced motion. */
  for (const route of ["/", "/story", "/projects/bothy", "/blog/fixture-post"]) {
    results.push(await audit(route, "en", WINDOWS[0], { paused: true }));
    results.push(await audit(route, "he", WINDOWS[1], { paused: true }));
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
console.log(`\n${results.length - failed}/${results.length} route runs clean (axe ${TAGS.join(" ")}; reflow at 320px)`);
process.exit(failed ? 1 : 0);
