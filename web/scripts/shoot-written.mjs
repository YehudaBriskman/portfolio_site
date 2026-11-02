/*
 * The pen mid-paragraph, on every page that uses it (#174), into
 * `docs/written/`:
 *
 *   174-<arm>-<route>-<lang>-<width>.png      a paragraph half written
 *   174-<arm>-off-<switch>-<width>.png        reduced motion / Pause: all ink
 *
 *   xvfb-run -a node scripts/shoot-written.mjs <arm>=<base> [<arm>=<base> …]
 *
 * "Half written" is computed, not eyeballed: the longest paragraph in the
 * route's prose that fits the window is scrolled to the point where its own
 * clock — read back from its computed `view-timeline-inset`, so each arm is
 * shot on its own clock — is at 50%. So a before and an after shot show the
 * same moment of the same paragraph's writing, wherever each arm puts it.
 *
 * Frames are asked for with `HeadlessExperimental.beginFrame` and the shot
 * comes back with the frame, because Chromium here has no frame clock of its
 * own (README rule 6). Hebrew is `lang`/`dir` set after load, as in the other
 * harnesses: the copy stays English; the direction and faces are under test.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? resolve(HERE, "../../docs/written");
mkdirSync(OUT, { recursive: true });
const arms = process.argv.slice(2).filter((a) => a.includes("=")).map((a) => a.split("="));

const BODY = Array.from({ length: 6 }, (_, i) =>
  `Paragraph ${i + 1}. A post is mostly running text, so most of what is on the screen is words the pen owns. ` +
  "This one carries a [link](/projects) and `inline code`, as real posts do, and runs long enough to wrap to several lines at the desktop measure and to many more on a phone.",
).join("\n\n");
const POST = {
  slug: "long-post",
  title: "A long fixture note",
  subtitle: "Running text",
  excerpt: "A fixture.",
  publishedAt: "2026-10-01T00:00:00.000Z",
  tags: ["process"],
  collection: "site",
  coverImage: null,
  readingMinutes: 3,
  body: BODY,
  links: [],
};
function answer(url) {
  const p = new URL(url).pathname.replace(/^\/api/, "");
  if (p === "/blog/posts") return { status: 200, body: { items: [POST] } };
  if (p.startsWith("/blog/posts/")) return { status: 200, body: { post: POST } };
  if (p === "/blog/collections") return { status: 200, body: { items: [] } };
  return { status: 404, body: {} };
}

/* key, route, section, which windows and languages */
const ALL = [
  ["desk", 1440, 900],
  ["phone", 390, 844],
];
const SHOTS = [
  ["approach", "/", "#approach", ALL, ["en", "he"]],
  ["story", "/story", "main", ALL, ["en", "he"]],
  ["post", "/blog/long-post", "article", ALL, ["en", "he"]],
  ["project", "/projects/bothy", "main", ALL.slice(0, 1), ["en"]],
  ["contact", "/", "#contact", ALL.slice(0, 1), ["en"]],
].filter(([k]) => !process.env.ONLY || process.env.ONLY.split(",").includes(k));

async function launch(width, height, { reduced = false, paused = false } = {}) {
  const context = await chromium.launchPersistentContext("", {
    executablePath: process.env.CHROME || undefined,
    viewport: { width, height },
    reducedMotion: reduced ? "reduce" : "no-preference",
    args: ["--no-sandbox", "--enable-begin-frame-control", "--run-all-compositor-stages-before-draw", "--disable-gpu", "--font-render-hinting=none"],
  });
  await context.route("**/api/**", (r) => {
    const { status, body } = answer(r.request().url());
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  if (paused) await context.addInitScript(() => localStorage.setItem("yb-motion-paused", "1"));
  return context;
}

let tick = 0;
async function frame(cdp, shot = false) {
  tick += 1;
  const r = await cdp.send("HeadlessExperimental.beginFrame", {
    frameTimeTicks: tick * 16.667,
    interval: 16.667,
    ...(shot ? { screenshot: { format: "png" } } : {}),
  });
  return r.screenshotData;
}

async function open(context, base, route, width, height, lang) {
  const anyPage = context.pages()[0] ?? (await context.newPage());
  const ctl = await context.newCDPSession(anyPage);
  const made = context.waitForEvent("page");
  await ctl.send("Target.createTarget", { url: "about:blank", enableBeginFrameControl: true });
  const page = await made;
  await page.setViewportSize({ width, height });
  const cdp = await context.newCDPSession(page);
  const nav = page.goto(base + route, { waitUntil: "load" });
  for (let i = 0; i < 400; i += 1) {
    await frame(cdp).catch(() => {});
    if (await page.evaluate(() => document.readyState === "complete" && document.querySelectorAll("[data-word]").length > 0).catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  await nav.catch(() => {});
  if (lang === "he") {
    await page.evaluate(() => {
      document.documentElement.lang = "he";
      document.documentElement.dir = "rtl";
    });
  }
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 60; i += 1) {
    await frame(cdp);
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  return { page, cdp };
}

/* Scroll so the longest paragraph that fits the window is at 50% of its clock. */
async function halfway(page, sel, height) {
  return page.evaluate(
    ({ s, H }) => {
      const px = (v) => (v.endsWith("vh") ? (parseFloat(v) * H) / 100 : parseFloat(v) || 0);
      const paras = [...document.querySelector(s).querySelectorAll("[data-written]")]
        .filter((p) => p.getBoundingClientRect().height < H * 0.45)
        .sort((a, b) => b.querySelectorAll("[data-word]").length - a.querySelectorAll("[data-word]").length);
      const p = paras[0];
      const r = p.getBoundingClientRect();
      const top = r.top + scrollY;
      const [insTop, insFoot = insTop] = getComputedStyle(p).viewTimelineInset.split(" ");
      const start = top - (H - px(insFoot));
      const end = top + r.height - px(insTop);
      return start + (end - start) / 2;
    },
    { s: sel, H: height },
  );
}

for (const [arm, base] of arms) {
  for (const [key, route, sel, windows, langs] of SHOTS) {
    for (const [wname, width, height] of windows) {
      const context = await launch(width, height);
      for (const lang of langs) {
        const { page, cdp } = await open(context, base, route, width, height, lang);
        const y = await halfway(page, sel, height);
        await page.evaluate((v) => scrollTo({ top: v, behavior: "instant" }), y);
        for (let i = 0; i < 4; i += 1) await frame(cdp);
        const data = await frame(cdp, true);
        const file = `174-${arm}-${key}-${lang}-${wname}.png`;
        writeFileSync(resolve(OUT, file), Buffer.from(data, "base64"));
        console.log(file);
        await page.close();
      }
      await context.close();
    }
  }
  /* The off-switches, at the same moment of the wall text: all ink. */
  for (const [sw, opts] of [["reduce", { reduced: true }], ["paused", { paused: true }]]) {
    const [wname, width, height] = ALL[0];
    const context = await launch(width, height, opts);
    const { page, cdp } = await open(context, base, "/", width, height, "en");
    const y = await halfway(page, "#approach", height);
    await page.evaluate((v) => scrollTo({ top: v, behavior: "instant" }), y);
    for (let i = 0; i < 4; i += 1) await frame(cdp);
    const file = `174-${arm}-off-${sw}-${wname}.png`;
    writeFileSync(resolve(OUT, file), Buffer.from(await frame(cdp, true), "base64"));
    console.log(file);
    await context.close();
  }
}
