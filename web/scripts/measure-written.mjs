/*
 * The pen (`motion/Written`), measured on every page that uses it (#174).
 *
 *   xvfb-run -a node scripts/measure-written.mjs <labelA>=<baseA> [<labelB>=<baseB>] [rounds]
 *
 * Two questions, answered separately because they have different causes.
 *
 * 1. WHEN — timing. Scrolled down in 12px steps at 1x, a frame driven per
 *    step, every paragraph's first and last word are watched, and the
 *    window position (0 top, 1 foot) at which each first reaches full ink is
 *    recorded. The median over paragraphs is printed per route. A word that
 *    completes at 0.45 has been waited for by a reader whose eye is already
 *    in the upper half of the window; one that completes at 0.65 was written
 *    before they got there. Also printed: `waited`, the share of steps at
 *    which some word above the window's middle was still not at ink — the
 *    reader looking at text that has not been written yet.
 *
 * 2. COST — frames. At 4x CPU throttle, scrolled 16px a frame through the
 *    route's prose, each frame's round trip of
 *    `HeadlessExperimental.beginFrame` (median and p95), plus a
 *    `devtools.timeline` trace summed per frame: style recalc
 *    (`UpdateLayoutTree`) and paint, and the count of main-thread tasks over
 *    50ms. Arms interleaved, order flipped each round.
 *
 * WHY beginFrame
 * --------------
 * Chromium on this box has no frame clock of its own — headless or headed
 * under xvfb, a page gets no `requestAnimationFrame` at all — so frames are
 * asked for explicitly: the headless shell with begin-frame control, one
 * frame per step. The numbers compare arms with each other; they are not fps
 * on a device.
 *
 * Blog posts come from a fixture answered in the harness (a long post, the
 * case the pen costs most on); everything else is the built site as is.
 * `npm run build`, `npx vite preview --port <p> --strictPort`, then run.
 */
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const arms = args.filter((a) => a.includes("=")).map((a) => a.split("="));
const rounds = Number(args.find((a) => /^\d+$/.test(a)) ?? 3);
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const SKIP_COST = !!process.env.NO_COST;
const SKIP_WHEN = !!process.env.NO_WHEN;

const LONG = Array.from({ length: 14 }, (_, i) =>
  [
    `Paragraph ${i + 1} of a long note, written to be the case the pen costs most on.`,
    "A post is mostly running text, so most of what is on the screen at any moment is words the pen owns,",
    "and a reader moving through it at reading pace keeps three or four paragraphs near the band at once.",
    "This one carries a [link](/projects) and `inline code`, as real posts do, and is long enough to wrap",
    "to four or five lines at the desktop measure and to ten or more on a phone.",
  ].join(" "),
).join("\n\n");

const POST = {
  slug: "long-post",
  title: "A long fixture note",
  subtitle: "Fourteen paragraphs of running text",
  excerpt: "A fixture.",
  publishedAt: "2026-10-01T00:00:00.000Z",
  tags: ["process"],
  collection: "site",
  coverImage: null,
  readingMinutes: 6,
  body: LONG,
  links: [],
};

function answer(url) {
  const p = new URL(url).pathname.replace(/^\/api/, "");
  if (p === "/blog/posts") return { status: 200, body: { items: [POST] } };
  if (p.startsWith("/blog/posts/")) return { status: 200, body: { post: POST } };
  if (p === "/blog/collections") return { status: 200, body: { items: [] } };
  return { status: 404, body: {} };
}

/* route, the prose to scroll through, and where to start */
const ROUTES = [
  ["home-approach", "/", "#approach"],
  ["home-contact", "/", "#contact"],
  ["story", "/story", "main"],
  ["blog-post", "/blog/long-post", "article"],
  ["project", "/projects/bothy", "main"],
].filter(([k]) => !ONLY || ONLY.includes(k));

const context = await chromium.launchPersistentContext("", {
  executablePath: process.env.CHROME || undefined,
  viewport: { width: W, height: H },
  args: ["--no-sandbox", "--enable-begin-frame-control", "--run-all-compositor-stages-before-draw", "--disable-gpu"],
});
await context.route("**/api/**", (r) => {
  const { status, body } = answer(r.request().url());
  return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
});
const bcdp = await context.browser()?.newBrowserCDPSession?.() ?? (await context.newCDPSession(context.pages()[0] ?? (await context.newPage())));

let tick = 0;
async function frame(cdp) {
  tick += 1;
  const t0 = performance.now();
  await cdp.send("HeadlessExperimental.beginFrame", { frameTimeTicks: tick * 16.667, interval: 16.667, noDisplayUpdates: false });
  return performance.now() - t0;
}

async function open(base, route) {
  const made = context.waitForEvent("page");
  await bcdp.send("Target.createTarget", { url: "about:blank", enableBeginFrameControl: true });
  const page = await made;
  await page.setViewportSize({ width: W, height: H });
  const cdp = await page.context().newCDPSession(page);
  const nav = page.goto(base + route, { waitUntil: "load" });
  for (let i = 0; i < 400; i += 1) {
    await frame(cdp).catch(() => {});
    if (await page.evaluate(() => document.readyState === "complete" && document.querySelectorAll("[data-word]").length > 0).catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  await nav.catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  /* EXTRA_CSS: try a declaration against an arm without rebuilding it. */
  if (process.env.EXTRA_CSS) await page.addStyleTag({ content: process.env.EXTRA_CSS });
  for (let i = 0; i < 60; i += 1) {
    await frame(cdp);
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  return { page, cdp, close: () => page.close() };
}

async function span(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    const ws = [...el.querySelectorAll("[data-word]")];
    const top = Math.min(...ws.map((w) => w.getBoundingClientRect().top)) + scrollY;
    const bottom = Math.max(...ws.map((w) => w.getBoundingClientRect().bottom)) + scrollY;
    return { top, bottom };
  }, sel);
}

/* ------------------------------------------------------------- timing -- */

async function when(base, [key, route, sel]) {
  const { page, cdp, close } = await open(base, route);
  const { top, bottom } = await span(page, sel);
  await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "rgb(var(--ink))";
    document.body.append(probe);
    window.__ink = getComputedStyle(probe).color;
    probe.remove();
    window.__paras = [...document.querySelectorAll("[data-written]")].filter((p) => p.querySelector(":scope [data-word]"));
    window.__done = window.__paras.map(() => ({ first: null, last: null }));
  });
  const start = Math.max(0, top - H);
  const end = bottom;
  let waited = 0;
  let steps = 0;
  for (let y = start; y <= end; y += 12) {
    await page.evaluate((v) => scrollTo({ top: v, behavior: "instant" }), y);
    await frame(cdp);
    await frame(cdp);
    const w = await page.evaluate((Hh) => {
      const lit = (el) => getComputedStyle(el).color === window.__ink;
      let wait = false;
      window.__paras.forEach((p, i) => {
        const ws = p.querySelectorAll("[data-word]");
        const own = [...ws].filter((x) => x.closest("[data-written]") === p);
        if (!own.length) return;
        const a = own[0];
        const z = own[own.length - 1];
        const d = window.__done[i];
        const ra = a.getBoundingClientRect();
        const rz = z.getBoundingClientRect();
        if (d.first === null && ra.bottom < Hh && lit(a)) d.first = ra.top / Hh;
        if (d.last === null && rz.bottom < Hh && lit(z)) d.last = rz.top / Hh;
        for (const x of own) {
          const r = x.getBoundingClientRect();
          if (r.bottom > 0 && r.top < Hh * 0.5 && !lit(x)) wait = true;
        }
      });
      return wait;
    }, H);
    steps += 1;
    if (w) waited += 1;
  }
  const done = await page.evaluate((s) => {
    const sec = document.querySelector(s);
    return window.__done.filter((_, i) => sec.contains(window.__paras[i]));
  }, sel);
  /* At the foot of the page nothing may be left unwritten: a clock that ends
     lower than the last screen can reach would leave the close muted. */
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  for (let i = 0; i < 4; i += 1) await frame(cdp);
  const stuck = await page.evaluate(
    () => [...document.querySelectorAll("[data-word]")].filter((x) => getComputedStyle(x).color !== window.__ink).length,
  );
  await close();
  const med = (xs) => {
    const v = xs.filter((x) => x !== null).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : NaN;
  };
  return {
    paragraphs: done.length,
    first: med(done.map((d) => d.first)),
    last: med(done.map((d) => d.last)),
    waited: waited / steps,
    stuck,
  };
}

/* --------------------------------------------------------------- cost -- */

async function cost(base, [, route, sel], paused) {
  const { page, cdp, close } = await open(base, route);
  const { top, bottom } = await span(page, sel);
  if (paused) await page.evaluate(() => document.body.classList.add("motion-paused"));
  await page.evaluate((v) => scrollTo({ top: v, behavior: "instant" }), Math.max(0, top - H));
  for (let i = 0; i < 5; i += 1) await frame(cdp);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const events = [];
  cdp.on("Tracing.dataCollected", (e) => events.push(...e.value));
  const finished = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline", transferMode: "ReportEvents" });
  const times = [];
  for (let y = Math.max(0, top - H); y <= bottom; y += 16) {
    await page.evaluate((v) => scrollTo({ top: v, behavior: "instant" }), y);
    times.push(await frame(cdp));
  }
  await cdp.send("Tracing.end");
  await finished;
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await close();
  const sum = (name) => events.filter((e) => e.name === name && e.ph === "X").reduce((n, e) => n + (e.dur ?? 0), 0) / 1000;
  const long = events.filter((e) => e.name === "RunTask" && e.ph === "X" && e.dur > 50_000).length;
  const s = [...times].sort((a, b) => a - b);
  /* Load-independent: how many elements were re-styled, per frame. Wall
     time on a shared box moves with whatever else is running; this does not. */
  const restyled = events
    .filter((e) => e.name === "UpdateLayoutTree" && e.ph === "X")
    .reduce((n, e) => n + (e.args?.elementCount ?? e.args?.data?.elementCount ?? 0), 0);
  if (process.env.TOP) {
    const by = {};
    for (const e of events) if (e.ph === "X" && e.dur) by[e.name] = (by[e.name] ?? 0) + e.dur / 1000;
    console.log(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${(v / times.length).toFixed(2)}`).join(" | "));
  }
  return {
    frames: times.length,
    median: s[Math.floor(s.length / 2)],
    p95: s[Math.floor(s.length * 0.95)],
    style: sum("UpdateLayoutTree") / times.length,
    paint: sum("Paint") / times.length,
    restyled: restyled / times.length,
    long,
  };
}

const f = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "—");

console.log(`window ${W}x${H}`);
for (const r of ROUTES) {
  if (!SKIP_WHEN) {
    for (const [label, base] of arms) {
      const t = await when(base, r);
      console.log(
        `when ${r[0].padEnd(14)} ${label.padEnd(8)} paras ${t.paragraphs}  first word inked at ${f(t.first, 2)}  last at ${f(t.last, 2)}  waited ${f(t.waited * 100, 0)}% of steps  unwritten at the page's foot ${t.stuck}`,
      );
    }
  }
  if (SKIP_COST) continue;
  const res = {};
  for (const [label] of arms) res[label] = [];
  for (const [label] of arms) res[`${label}/paused`] = [];
  for (let k = 0; k < rounds; k += 1) {
    const order = k % 2 ? [...arms].reverse() : arms;
    for (const [label, base] of order) {
      res[label].push(await cost(base, r, false));
      if (k === 0) res[`${label}/paused`].push(await cost(base, r, true));
    }
  }
  for (const [label, xs] of Object.entries(res)) {
    if (!xs.length) continue;
    const m = (key) => xs.map((x) => x[key]).sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    console.log(
      `cost ${r[0].padEnd(14)} ${label.padEnd(15)} frame median ${f(m("median"))}ms p95 ${f(m("p95"))}ms  style ${f(m("style"), 2)}ms/frame  paint ${f(m("paint"), 2)}ms/frame  restyled ${f(m("restyled"), 0)} el/frame  long tasks ${m("long")}  (${xs[0].frames} frames x ${xs.length})`,
    );
  }
}
await context.close();
