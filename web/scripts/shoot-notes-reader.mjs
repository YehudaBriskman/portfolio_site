#!/usr/bin/env node
/*
 * Screenshots of reader mode (#249) and, with `--editor`, the note editor
 * (#250), in both themes, desktop and phone.
 *
 *   npm run build && xvfb-run -a node scripts/shoot-notes-reader.mjs [--editor] [outDir]
 *
 * Every /api request is answered from the fixtures below, so it needs no
 * backend. It also asserts what it can see: the aside is sticky and tracks
 * the heading, the picture view opens and closes on Escape, a preview shows
 * on focus, and the phone's sheet opens. Waits poll by hand
 * (`{ polling: 500 }`): this box's headless Chromium has almost no frame
 * clock, so a rAF-polled wait can hang on a condition already true.
 *
 * Writes to docs/notes-reader-editor/ by default.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startPreview } from "./a11y/site-stub.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const EDITOR = args.includes("--editor");
const OUT = args.find((a) => !a.startsWith("--")) ?? resolve(HERE, "../../docs/notes-reader-editor");
mkdirSync(OUT, { recursive: true });

const at = (days) => new Date(Date.UTC(2026, 9, 20) - days * 86_400_000).toISOString();

const PICTURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d3b4f"/><stop offset="1" stop-color="#3a6f8f"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><path d="M0 700 L400 420 L700 640 L1000 380 L1600 720 L1600 900 L0 900 Z" fill="#14130f" opacity=".8"/><circle cx="1240" cy="200" r="70" fill="#ece8dc"/></svg>`;

const BODY = `The reader borrows from a file viewer: an outline that follows you, the note's facts beside it, and a proper look at every picture. See [[a-second-note]] for the background, the [[area:site|site's area]], or the [[project:bothy]] project.

## Why a reader mode

A long note is the one page here where you cannot see how much is left. The outline on the side answers that, and it marks the section you are in. [An outside link](https://example.com/) says it leaves the site.

![A ridge under a pale moon](/api/images/media/fixture-ridge "A picture opens in the picture view, with zoom and pan.")

### Diagrams stay sharp

\`\`\`svg
<svg viewBox="0 0 420 120"><title>Request flow</title><rect x="10" y="30" width="110" height="60" rx="10" fill="#e8e3d6" stroke="#14130f"/><text x="65" y="66" text-anchor="middle" font-size="16" fill="#14130f">Browser</text><path d="M120 60 H 160" stroke="#14130f" stroke-width="2"/><rect x="160" y="30" width="110" height="60" rx="10" fill="#e8e3d6" stroke="#14130f"/><text x="215" y="66" text-anchor="middle" font-size="16" fill="#14130f">nginx</text><path d="M270 60 H 310" stroke="#14130f" stroke-width="2"/><rect x="310" y="30" width="100" height="60" rx="10" fill="#e8e3d6" stroke="#14130f"/><text x="360" y="66" text-anchor="middle" font-size="16" fill="#14130f">API</text></svg>
\`\`\`

## Code you can copy

\`\`\`ts
export function readingMinutes(body: string): number {
  return Math.max(1, Math.round(body.split(/\\s+/).length / 220));
}
\`\`\`

## Reading tools

Text size and line length are yours to set, and they stay set for the next note.

- the outline tracks the heading you are reading
- the facts say when the note changed, and what changed
- the phone gets all of it in one sheet

### A closing section

${"Each paragraph is written by the pen as it rises through the reading window, one block at a time. ".repeat(4)}

${"The panels never interfere with it, because nothing in them is prose. ".repeat(5)}`;

const SUMMARY = {
  slug: "reader-mode",
  title: "Reading a note the way a file viewer reads a document",
  subtitle: "An outline, the facts, pictures you can open",
  excerpt: "What reader mode adds, and why.",
  publishedAt: at(14),
  updatedAt: at(2),
  tags: ["reading", "design"],
  collection: "site",
  coverImage: null,
  readingMinutes: 4,
};
const OTHER = { ...SUMMARY, slug: "a-second-note", title: "A second note", excerpt: "The note this one builds on.", updatedAt: at(14) };
const POST = { ...SUMMARY, body: BODY, links: [], changeNote: "Added the section on reading tools." };
const AREA = { slug: "site", title: "The site", tagline: "This portfolio.", description: "Notes about building this site.", coverImage: null, links: [], order: 0, kind: "site", repoUrl: null, stats: null };

function answer(path) {
  const p = path.replace(/^\/api/, "");
  if (p === "/admin/me") return { ok: true, login: "owner", email: null };
  if (p === "/blog/posts") return { items: [SUMMARY, OTHER] };
  if (p === "/blog/posts/reader-mode") return { post: POST };
  if (p === "/blog/collections") return { items: [AREA] };
  if (p === "/blog/collections/site") return { collection: AREA };
  if (p === "/admin/posts") return { ok: true, items: [ADMIN_POST] };
  if (p === "/admin/posts/reader-mode") return { ok: true, post: ADMIN_POST };
  if (p === "/admin/collections") return { ok: true, items: [{ ...AREA, status: "published", repo: null, stats: null }] };
  if (p === "/admin/media") return { ok: true, items: [] };
  return null;
}

const ADMIN_POST = {
  _id: "post:reader-mode",
  _rev: "3-a",
  ...SUMMARY,
  body: BODY,
  status: "published",
  links: [],
  featured: null,
  seo: { title: null, description: null, canonical: null, noindex: false },
  he: null,
  changeNote: "Added the section on reading tools.",
  draft: {
    title: SUMMARY.title,
    subtitle: SUMMARY.subtitle,
    excerpt: SUMMARY.excerpt,
    body: BODY.replace("Text size and line length are yours to set", "Text size and line length are yours to set and keep"),
    tags: ["reading", "design", "editor"],
    collection: "site",
    coverImage: null,
    links: [],
    featured: null,
    publishedAt: SUMMARY.publishedAt,
    seo: { title: null, description: null, canonical: null, noindex: false },
    he: null,
  },
  draftSavedAt: at(0),
};

const preview = await startPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox"] });
const failures = [];
const check = (ok, what) => {
  if (!ok) failures.push(what);
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
};

async function open(width, height, theme) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await context.addInitScript(([t]) => {
    try {
      localStorage.setItem("yb-theme", t);
      localStorage.setItem("admin-seen-v1", "1");
    } catch {}
  }, [theme]);
  await context.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/api/images/media/fixture-ridge")) {
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: PICTURE });
    }
    if (route.request().method() !== "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, post: ADMIN_POST }) });
    }
    const body = answer(u.pathname);
    return route.fulfill({ status: body ? 200 : 404, contentType: "application/json", body: JSON.stringify(body ?? {}) });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(`page error: ${e.message}`));
  return page;
}

async function settle(page) {
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = "eager")));
  for (let i = 0; i < 30; i += 1) {
    const done = await page.evaluate(() => [...document.images].every((i) => i.complete));
    if (done) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
}

async function snap(page, name, opts = {}) {
  for (let i = 0; i < 6; i += 1) {
    try {
      await page.screenshot({ path: resolve(OUT, name), timeout: 30000, animations: "disabled", ...opts });
      console.log(`shot ${name}`);
      return;
    } catch (e) {
      if (i === 5) throw e;
    }
  }
}

for (const theme of ["light", "dark"]) {
  for (const [label, w, h] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
    const page = await open(w, h, theme);
    if (!EDITOR) {
      await page.goto(`${preview.base}/blog/reader-mode`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("Reading a note"), null, { polling: 500, timeout: 20000 });
      await settle(page);
      await snap(page, `reader-${label}-${theme}.png`);

      if (label === "desktop") {
        const editShown = await page.getByRole("link", { name: "Edit this note" }).first().isVisible();
        check(editShown, `${theme}: Edit shows for the signed-in admin`);
        await page.evaluate(() => document.getElementById("code-you-can-copy")?.scrollIntoView({ block: "start" }));
        await page.waitForTimeout(800);
        const current = await page.evaluate(() => document.querySelector('aside a[aria-current="location"]')?.textContent);
        check(current === "Code you can copy", `${theme}: the outline tracks the heading (${current})`);
        const asideTop = await page.evaluate(() => document.querySelector("aside [class*='asideInner']")?.getBoundingClientRect().top ?? -1);
        check(asideTop > 0 && asideTop < 200, `${theme}: the aside is sticky (${Math.round(asideTop)}px)`);
        await snap(page, `reader-desktop-${theme}-scrolled.png`);

        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByRole("link", { name: "A second note" }).first().focus();
        await page.waitForTimeout(800);
        check(await page.getByRole("tooltip").isVisible(), `${theme}: a link preview shows on focus`);
        await snap(page, `reader-desktop-${theme}-preview.png`);
        await page.keyboard.press("Escape");

        await page.getByRole("button", { name: /Open the picture/ }).click();
        await page.waitForTimeout(500);
        check(await page.locator("dialog[open]").isVisible(), `${theme}: the picture view opens`);
        await page.keyboard.press("+");
        await page.keyboard.press("+");
        await page.waitForTimeout(300);
        await snap(page, `reader-desktop-${theme}-picture.png`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        check((await page.locator("dialog[open]").count()) === 0, `${theme}: Escape closes the picture view`);
      } else {
        await page.getByRole("button", { name: "Contents and details" }).first().click();
        await page.waitForTimeout(500);
        check(await page.locator("dialog[open]").isVisible(), `${theme}: the phone's sheet opens`);
        await snap(page, `reader-phone-${theme}-sheet.png`);
      }
    } else {
      await page.goto(`${preview.base}/admin/posts/reader-mode`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("textarea"), null, { polling: 500, timeout: 20000 });
      await settle(page);
      await snap(page, `editor-${label}-${theme}.png`);
      const diffBtn = page.getByRole("button", { name: /Review and publish/ }).first();
      if (await diffBtn.isVisible()) {
        await diffBtn.click();
        await page.waitForTimeout(600);
        check(await page.locator("dialog[open]").isVisible(), `${theme}: the publish review opens`);
        await snap(page, `editor-${label}-${theme}-review.png`);
        await page.keyboard.press("Escape");
      }
      if (label === "desktop") {
        const ta = page.locator("textarea").first();
        await ta.focus();
        await page.keyboard.press("Control+End");
        await page.keyboard.type("\n\nSee [[a-");
        await page.waitForTimeout(600);
        check(await page.getByRole("listbox").isVisible(), `${theme}: [[ suggests notes, areas and projects`);
        await snap(page, `editor-desktop-${theme}-wikilink.png`);
      }
    }
    await page.context().close();
  }
}

await browser.close();
preview.stop();
if (failures.length) {
  console.error(`\n${failures.length} failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
