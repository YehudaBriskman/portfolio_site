/*
 * The close, its dialog and the footer (#160), a laptop and a phone.
 *
 * What it shoots, into `docs/contact/` (or the directory given as argv[2]):
 *
 *   contact-<window>-1-entering.png   the plate a third of the way in
 *   contact-<window>-2-mid.png        half arrived, parked
 *   contact-<window>-3-arrived.png    the plate fully arrived
 *   contact-<window>-4-reversed.png   scrolled back to the entering point:
 *                                     must match frame 1, not frame 3
 *   contact-<window>-5-paused.png     Pause on at the entering point:
 *                                     must match frame 3 (arrived)
 *   contact-<window>-6-reduced.png    reduced motion at the entering point:
 *                                     must match frame 3 (arrived)
 *   contact-<window>-7-dialog.png     the dialog open, focus on the name
 *   contact-<window>-8-error.png      sent with a bad address: the errors
 *   contact-<window>-9-footer.png     the footer on its dark ground
 *
 * RUNNING IT
 * ----------
 * `npm run build`, `npx vite preview --host 127.0.0.1 --port 4397
 * --strictPort`, then `xvfb-run -a node scripts/shoot-contact.mjs`. `BASE`
 * points it elsewhere. Same harness as `shoot-story.mjs`: headless Chromium
 * on this box has almost no frame clock, so frames are driven by throwaway
 * screenshots and every wait polls by hand (`{ polling: 500 }`) rather than
 * on `requestAnimationFrame`.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/contact");
const BASE = process.env.BASE ?? "http://127.0.0.1:4397";

mkdirSync(OUT, { recursive: true });

const WINDOWS = [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

async function frames(page, n = 4) {
  for (let i = 0; i < n; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(120);
  }
}

async function open(width, height, { reduced = false } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 40; i += 1) {
    await frames(page, 1);
    const gone = await page.evaluate(() => !document.querySelector('[class*="_shutter_"]'));
    if (gone) break;
  }
  await frames(page, 2);
  return page;
}

/* Scroll so the plate's top edge sits at `t` of the window's height. */
async function plateAt(page, t) {
  await page.evaluate((at) => {
    const el = document.querySelector('#contact [class*="_plate_"]');
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - window.innerHeight * at, behavior: "instant" });
  }, t);
  await frames(page, 4);
}

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name);
}

for (const [win, width, height] of WINDOWS) {
  const at = (n, beat) => `contact-${win}-${n}-${beat}`;
  const page = await open(width, height);

  await plateAt(page, 0.82);
  await shoot(page, at(1, "entering"));
  await plateAt(page, 0.62);
  await shoot(page, at(2, "mid"));
  await plateAt(page, 0.18);
  await shoot(page, at(3, "arrived"));
  await plateAt(page, 0.82);
  await shoot(page, at(4, "reversed"));

  await page.evaluate(() => document.body.classList.add("motion-paused"));
  await frames(page, 2);
  await shoot(page, at(5, "paused"));
  await page.evaluate(() => document.body.classList.remove("motion-paused"));

  /* The dialog, from the button a reader would press. */
  await plateAt(page, 0.18);
  await page.getByRole("button", { name: /write a message/i }).click();
  await page.waitForFunction(() => document.querySelector("dialog")?.open, null, { polling: 500 });
  await frames(page, 6);
  await page.waitForTimeout(500);
  await frames(page, 2);
  await shoot(page, at(7, "dialog"));

  await page.fill("#contact-name", "A");
  await page.fill("#contact-email", "someone@example");
  await page.getByRole("button", { name: /send message/i }).click();
  await page.waitForFunction(
    () => document.querySelector("#contact-email")?.getAttribute("aria-invalid") === "true",
    null,
    { polling: 500 },
  );
  await page.focus("#contact-email");
  await frames(page, 4);
  await shoot(page, at(8, "error"));

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog")?.open, null, { polling: 500 });
  await frames(page, 4);

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await frames(page, 4);
  await shoot(page, at(9, "footer"));
  await page.close();

  const reduced = await open(width, height, { reduced: true });
  await plateAt(reduced, 0.82);
  await shoot(reduced, at(6, "reduced"));
  await reduced.close();
}

await browser.close();
