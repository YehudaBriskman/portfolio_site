/*
 * The shared gallery's rail and filter control (#193), on /projects and
 * /blog, a laptop and a phone, both directions.
 *
 * What it shoots, into `docs/gallery-filters/`:
 *
 *   <page>-<set>-<lang>-1440x900-wall.png      the rail beside the wall, nothing chosen
 *   <page>-<set>-<lang>-1440x900-popover.png   two values chosen (tokens in the card)
 *                                              and a facet's popover open
 *   <page>-<set>-<lang>-390x844-tokens.png     the phone: the Filter button with the
 *                                              active tokens beside it, over the wall
 *   <page>-<set>-<lang>-390x844-sheet.png      the phone: the sheet open, a popover
 *                                              expanded inside it
 *
 * `<page>` is `projects` or `blog`. `<set>` is `seed` (projects: the six real
 * ones, the API answering with nothing; notes: six mocked) or `many` (twenty
 * more mocked through `page.route`, never written to the data). `he` is the
 * document set to `dir="rtl" lang="he"`.
 *
 * It prints what is not a picture: horizontal overflow, and for each open
 * popover which element has focus.
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --port 4399 --strictPort`, then
 * `xvfb-run -a node scripts/shoot-gallery-filters.mjs`. Headless Chromium on
 * this box has almost no frame clock: frames are driven by throwaway
 * screenshots, and waits poll on a timer (`{ polling: 500 }`), never on rAF.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/gallery-filters");
const BASE = process.env.BASE ?? "http://localhost:4399";
mkdirSync(OUT, { recursive: true });

const STATES = ["Live", "In use", "Archive", "v2.1.0", "Live", "Archive"];
const STACKS = ["TypeScript", "Go", "Python", "Rust", "React", "Postgres"];

function projects(n) {
  return Array.from({ length: n }, (_, i) => {
    const release = STATES[i % STATES.length].startsWith("v");
    return {
      slug: `fixture-${i + 1}`,
      title: `${["Harbor", "Lantern", "Quarry", "Meridian", "Tidewater"][i % 5]} ${i + 1}`,
      tagline: [
        "A small tool that does one thing",
        "Scheduling for a team that never agreed on a calendar",
        "An index of every log line, searchable in under a second",
      ][i % 3],
      description: "Fixture.",
      coverImage: null,
      links: [],
      order: 60 + i,
      kind: "project",
      repoUrl: null,
      stats: {
        stars: null,
        language: STACKS[i % STACKS.length],
        license: null,
        pushedAt: `${2019 + (i % 7)}-0${1 + (i % 9)}-15T00:00:00Z`,
        latestRelease: release ? { tag: "v2.1.0", url: "https://example.com", publishedAt: null } : null,
      },
    };
  });
}

const TAGS = ["ci", "testing", "postgres", "react", "infra", "design", "security", "kubernetes"];
const TITLES = [
  "Why the deploy gate checks bytes, not status codes",
  "A database that restores itself every night",
  "Scroll-driven motion without a single scroll listener",
  "What a 1000 ms tailnet peer looks like from the outside",
  "Picking a stack for a two-person team",
  "The cost of a fixed row height",
  "Strict CSP and the inline style you did not write",
  "Right to left, from the grid down",
];

function notes(n) {
  return Array.from({ length: n }, (_, i) => ({
    slug: `note-${i + 1}`,
    title: TITLES[i % TITLES.length] + (i >= TITLES.length ? ` (part ${Math.floor(i / TITLES.length) + 1})` : ""),
    subtitle: i % 3 === 0 ? "What it cost, and what it bought" : null,
    excerpt: "A worked example, with the numbers measured on the box it runs on.",
    publishedAt: `${2026 - (i % 4)}-${String(1 + ((i * 5) % 12)).padStart(2, "0")}-1${i % 9}T09:00:00Z`,
    tags: [TAGS[i % TAGS.length], TAGS[(i * 3 + 1) % TAGS.length]],
    collection: i % 5 === 2 ? "windom" : "site",
    coverImage: i % 7 === 3 ? "/projects/icaros-800.jpg" : null,
    readingMinutes: 3 + (i % 9),
  }));
}

const COLLECTIONS = [
  { slug: "site", title: "Notes", tagline: "", description: "Decisions I made and what they cost.", coverImage: null, links: [], order: 0, kind: "site", repoUrl: null, stats: null },
  { slug: "windom", title: "WindoM", tagline: "", description: "", coverImage: null, links: [], order: 5, kind: "project", repoUrl: null, stats: null },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

async function frames(page, n = 3) {
  for (let i = 0; i < n; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(120);
  }
}

async function open(pageName, set, lang, [width, height], query = "") {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.route("**/api/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    let body = {};
    let status = 404;
    if (path === "/api/blog/collections") {
      status = 200;
      body = { items: pageName === "projects" ? (set === "many" ? projects(20) : []) : COLLECTIONS };
    } else if (path === "/api/blog/posts") {
      status = 200;
      /* Newest first, as the API answers. */
      body = { items: notes(set === "many" ? 22 : 6).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) };
    }
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(`${BASE}/${pageName}${query}`, { waitUntil: "load" });
  if (lang === "he") {
    await page.evaluate(() => {
      document.documentElement.lang = "he";
      document.documentElement.dir = "rtl";
    });
    await frames(page, 2);
  }
  const want = pageName === "projects" ? (set === "many" ? 26 : 6) : 1;
  await page.waitForFunction(
    ([sel, n]) => document.querySelectorAll(sel).length >= n || location.search,
    [pageName === "projects" ? "main ol a[href^='/projects/']" : "main ol a[href^='/blog/']", want],
    { polling: 500, timeout: 30000 }
  );
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
  }
  /* Pause: the wall lands on its finished state, so a still is of the
     controls and not of a tile half-way in. */
  await page.evaluate(() => document.body.classList.add("motion-paused"));
  await frames(page, 6);
  return { page, context };
}

const QUERY = {
  projects: (set) => (set === "many" ? "?state=Live&state=Archive&stack=Go" : "?state=Live&year=2024"),
  blog: () => "?tag=ci&tag=testing&year=2026",
};

/* Down to where the rail and the wall start, so both are on screen. */
async function toWall(page) {
  await page.evaluate(() => {
    const el = document.querySelector("main ol[aria-label], main [aria-busy]");
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 140);
  });
  await frames(page, 4);
}

const report = [];

for (const pageName of ["projects", "blog"]) {
  for (const set of ["seed", "many"]) {
    for (const lang of ["en", "he"]) {
      const tag = (w, h) => `${pageName}-${set}-${lang}-${w}x${h}`;

      /* Laptop: the plain rail, then two choices and an open popover. */
      {
        const { page, context } = await open(pageName, set, lang, [1440, 900]);
        await toWall(page);
        await page.screenshot({ path: `${OUT}/${tag(1440, 900)}-wall.png` });
        await context.close();
      }
      {
        const { page, context } = await open(pageName, set, lang, [1440, 900], QUERY[pageName](set));
        await toWall(page);
        const trigger = page.locator("aside [aria-haspopup='listbox']").first();
        await trigger.focus();
        await page.keyboard.press("ArrowDown");
        await frames(page, 3);
        const focus = await page.evaluate(() => ({
          role: document.activeElement?.getAttribute("role"),
          text: document.activeElement?.textContent,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
        report.push({ shot: `${tag(1440, 900)}-popover`, ...focus });
        await page.screenshot({ path: `${OUT}/${tag(1440, 900)}-popover.png` });
        await context.close();
      }

      /* Phone: the button with its tokens, then the sheet. */
      {
        const { page, context } = await open(pageName, set, lang, [390, 844], QUERY[pageName](set));
        await page.evaluate(() => {
          const el = document.querySelector("[aria-haspopup='dialog']");
          if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90);
        });
        await frames(page, 4);
        report.push({
          shot: `${tag(390, 844)}-tokens`,
          overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
        });
        await page.screenshot({ path: `${OUT}/${tag(390, 844)}-tokens.png` });

        await page.click("[aria-haspopup='dialog']");
        await frames(page, 2);
        await page.locator("dialog [aria-haspopup='listbox']").nth(pageName === "blog" ? 0 : 0).click();
        await frames(page, 3);
        report.push({
          shot: `${tag(390, 844)}-sheet`,
          dialog: await page.evaluate(() => document.querySelector("dialog")?.open ?? false),
        });
        await page.screenshot({ path: `${OUT}/${tag(390, 844)}-sheet.png` });
        await context.close();
      }
      console.log("done", pageName, set, lang);
    }
  }
}

console.table(report);
await browser.close();
