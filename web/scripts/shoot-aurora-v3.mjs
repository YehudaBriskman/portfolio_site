/*
 * The aurora after the owner's preprod review of #275 and #276
 * (2026-11-03), shot and measured into docs/aurora-v3/.
 *
 *   hero      no ribbon: frames of the hero as the page opens and as the
 *             next act comes up over it; asserts no strand in the hero.
 *   approach  ONE aurora on "How I work": the living line coming in from
 *             the page's left edge and round the head, frame by frame as
 *             the head comes up; asserts no strand band in the section, the
 *             line's tail reaching the page's left edge, and the soft
 *             window that uncovers it finishing home.
 *   notes     the shelf's strand on the cards: frames as the stage comes up
 *             to pin and the row travels; asserts the band's middle is the
 *             first card's middle and the band spans the frame, edge to edge.
 *
 * Both themes, desktop 1440×900 and phone 390×844. Frames are driven by
 * hand with `HeadlessExperimental.beginFrame` (this box's headless Chromium
 * fires almost no rAF), so every shot is the settled state at that scroll.
 *
 *   npm run build && xvfb-run -a node scripts/shoot-aurora-v3.mjs
 *
 * Exits non-zero if an assertion fails; `report.json` has every number.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answer as stub, startPreview } from "./a11y/site-stub.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? resolve(HERE, "../../docs/aurora-v3");
mkdirSync(OUT, { recursive: true });

/* Six notes, so the shelf has a row to travel. */
function answer(url) {
  const r = stub(url, false);
  if (new URL(url).pathname === "/api/blog/posts") {
    const [one] = r.body.items;
    r.body.items = Array.from({ length: 6 }, (_, i) => ({ ...one, slug: `${one.slug}-${i}`, title: `${one.title} ${i + 1}` }));
  }
  return r;
}

const WINDOWS = [
  ["desk", 1440, 900],
  ["phone", 390, 844],
];
const THEMES = (process.env.THEMES ?? "light,dark").split(",");

async function launch(width, height, theme) {
  const context = await chromium.launchPersistentContext("", {
    executablePath: process.env.CHROME || undefined,
    viewport: { width, height },
    colorScheme: theme,
    args: ["--no-sandbox", "--enable-begin-frame-control", "--run-all-compositor-stages-before-draw", "--disable-gpu", "--font-render-hinting=none"],
  });
  await context.addInitScript((t) => localStorage.setItem("yb-theme", t), theme);
  await context.route("**/api/**", (r) => {
    const { status, body } = answer(r.request().url());
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
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

async function open(context, base, width, height) {
  const anyPage = context.pages()[0] ?? (await context.newPage());
  const ctl = await context.newCDPSession(anyPage);
  const made = context.waitForEvent("page");
  await ctl.send("Target.createTarget", { url: "about:blank", enableBeginFrameControl: true });
  const page = await made;
  await page.setViewportSize({ width, height });
  const cdp = await context.newCDPSession(page);
  const nav = page.goto(base + "/", { waitUntil: "load" });
  const ready = "#notes [data-shelf-stage]";
  for (let i = 0; i < 400; i += 1) {
    await frame(cdp).catch(() => {});
    if (await page.evaluate((s) => document.readyState === "complete" && !!document.querySelector(s), ready).catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  await nav.catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 80; i += 1) {
    await frame(cdp);
    if (await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'))) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  /* The hero's arrival runs on a clock: let it finish. */
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 40));
    await frame(cdp);
  }
  return { page, cdp };
}

async function scrollTo(page, cdp, y) {
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y);
  for (let i = 0; i < 4; i += 1) {
    await frame(cdp);
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function shoot(cdp, name) {
  await frame(cdp);
  writeFileSync(resolve(OUT, name), Buffer.from(await frame(cdp, true), "base64"));
  return name;
}

const docTop = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);

const report = { failures: [], runs: [] };
const fail = (m) => {
  report.failures.push(m);
  console.log(`  ✗ ${m}`);
};

const { base, stop } = await startPreview();
try {
  for (const theme of THEMES) {
    for (const [wname, width, height] of WINDOWS) {
      const tag = `${theme}-${wname}`;
      const context = await launch(width, height, theme);
      console.log(tag);
      const { page, cdp } = await open(context, base, width, height);

      /* ── the hero: no ribbon ────────────────────────────────────────── */
      {
        const strands = await page.evaluate(() => document.querySelectorAll("#hero [data-strands], #hero [data-aurora-strand]").length);
        if (strands) fail(`hero ${tag}: ${strands} aurora strand(s) still in the hero`);
        const k = [0, 0.35, 0.7];
        for (let i = 0; i < k.length; i += 1) {
          await scrollTo(page, cdp, k[i] * height);
          const name = await shoot(cdp, `hero-${tag}-${i}.png`);
          report.runs.push({ kind: "hero", tag, at: k[i], strands, name });
        }
      }

      /* ── "How I work": one aurora, in from the left edge ─────────────── */
      {
        const bands = await page.evaluate(() => document.querySelectorAll("#approach [data-aurora-strand]").length);
        if (bands) fail(`approach ${tag}: ${bands} strand band(s) still on the section`);
        const marker = await docTop(page, "[data-line-origin='approach-enter']");
        /* Where the marker (the tail's line) stands in the window, as a share of it. */
        const ats = [0.98, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.3, 0.15];
        for (let i = 0; i < ats.length; i += 1) {
          await scrollTo(page, cdp, marker - ats[i] * height);
          const seen = await page.evaluate(() => {
            const svg = document.querySelector("#approach [data-living-line] > svg");
            const cs = getComputedStyle(svg);
            const path = svg.querySelector("[data-strand]");
            const box = path.getBBox();
            const ctm = svg.getScreenCTM();
            const leftOnPage = ctm ? box.x * ctm.a + ctm.e : NaN;
            return { enter: svg.dataset.enter ?? null, maskPosition: cs.maskPosition, leftOnPage: Math.round(leftOnPage) };
          });
          const name = await shoot(cdp, `approach-${tag}-${i}.png`);
          report.runs.push({ kind: "approach", tag, at: ats[i], seen, name });
        }
        const frames = report.runs.filter((r) => r.kind === "approach" && r.tag === tag);
        const last = frames.at(-1).seen;
        if (last.enter !== "left") fail(`approach ${tag}: the line does not come in from the left (${last.enter})`);
        if (!(last.leftOnPage <= 0)) fail(`approach ${tag}: the tail starts at x=${last.leftOnPage}, not at the page's left edge`);
        if (!/^0%/.test(last.maskPosition)) fail(`approach ${tag}: the window is not home at the end (${last.maskPosition})`);
        if (!frames.some((f) => /^(?!0%)[\d.]+%/.test(f.seen.maskPosition))) fail(`approach ${tag}: never caught the window mid-way`);
      }

      /* ── the notes: the strand on the cards ──────────────────────────── */
      {
        const top = await docTop(page, "#notes [data-shelf-stage]");
        const ats = [0.85, 0.65, 0.45, 0.25, 0.05, -0.3, -0.8];
        for (let i = 0; i < ats.length; i += 1) {
          await scrollTo(page, cdp, top - ats[i] * height);
          const seen = await page.evaluate(() => {
            const band = document.querySelector("[data-notes-aurora]").getBoundingClientRect();
            const card = document.querySelector("#notes [data-shelf-i='0'] a").getBoundingClientRect();
            const frameBox = document.querySelector("[data-notes-aurora]").parentElement.getBoundingClientRect();
            const w = document.querySelector("#notes [data-aurora-window]").getBoundingClientRect();
            return {
              bandMid: Math.round(band.top + band.height / 2),
              cardMid: Math.round(card.top + card.height / 2),
              bandLeft: Math.round(band.left - frameBox.left),
              bandWidth: Math.round(band.width),
              frameWidth: Math.round(frameBox.width),
              cardLeft: Math.round(card.left),
              windowRight: Math.round(w.right - band.left),
            };
          });
          const name = await shoot(cdp, `notes-${tag}-${i}.png`);
          report.runs.push({ kind: "notes", tag, at: ats[i], seen, name });
          if (Math.abs(seen.bandMid - seen.cardMid) > 2) fail(`notes ${tag} @${ats[i]}: band middle ${seen.bandMid} vs card middle ${seen.cardMid}`);
          if (seen.bandLeft !== 0 || Math.abs(seen.bandWidth - seen.frameWidth) > 1) fail(`notes ${tag} @${ats[i]}: band is not the frame's width (${JSON.stringify(seen)})`);
        }
      }
      await page.close();
      await context.close();
    }
  }
} finally {
  stop();
}
writeFileSync(resolve(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(report.failures.length ? `\n${report.failures.length} failure(s)` : "\nall clear");
process.exit(report.failures.length ? 1 : 0);
