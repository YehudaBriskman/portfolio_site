/*
 * The first screen, every candidate, both languages, both reference windows.
 *
 * WHY THIS EXISTS
 * ---------------
 * Issues #100 and #101 both ask for options rather than an implementation —
 * two title treatments to choose between, two or three things the lower
 * corners could carry — and a choice made from prose is a choice made about
 * prose. These are the renders the owner picks from, and they are committed
 * under `docs/hero-first-screen/` so the pull request carries them.
 *
 * One build answers all of them. `heroFirstScreen.ts` reads `?title=` and
 * `?corners=` once at module scope, so every shot below is the same bundle
 * with a different query string, which is also how the owner can compare them
 * on a real page rather than in a gallery.
 *
 * WHAT IS AND IS NOT SHOT
 * -----------------------
 * The title set uses the recommended corners and the corner set uses the
 * recommended title, so the pair that is recommended — PORTFOLIO with the
 * affordance — appears once, as `title-portfolio-*`. There is no
 * `corners-ask-*`; it would be the same bytes under a second name.
 *
 * HEBREW
 * ------
 * The locale switch is gated on `available`, which is false until the strings
 * exist, so the two attributes are written directly. That is exactly what
 * `applyLocale` does once the flag flips, reached a release early, and it has
 * to happen after mount because `useLocale`'s effect writes the default on the
 * first commit. There is no translation layer yet: what changes is the
 * direction and the three faces, which is the half of Hebrew that is
 * finished — and the half these two issues can break, because the corners
 * swap sides and the display face changes width.
 *
 * RUNNING IT
 * ----------
 * Build, serve `dist` on 4390, then `node scripts/fontwork/shoot-first-screen.mjs`.
 *
 * At device pixel ratio 1 and not 2, which is the opposite of what
 * `build-shots.mjs` in this directory does and is deliberate: these twenty
 * files are a proposal that is deleted the day the owner picks, and at 2x
 * they are 9MB of a repository that would carry them forever. Every question
 * they are being asked — how large the title sets, where the corner blocks
 * land, what happens when the direction flips — is answered at 1x.
 * Playwright is not a dependency of this project and is not going to become
 * one for a script that runs when a composition changes; the path below is
 * the same arrangement every other script in this directory uses.
 */
import { chromium } from "/home/yehuda/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../../docs/hero-first-screen");
const BASE = process.env.BASE ?? "http://127.0.0.1:4390";

mkdirSync(OUT, { recursive: true });

/* The two the issues name. 1440x900 is where the owner was looking when they
   asked for something in the corners; 390x844 is the one the brief calls the
   harder case, because there are no corners on it. */
const WINDOWS = [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
];

const SHOTS = [
  ...["portfolio", "explore", "name"].map((t) => [`title-${t}`, `title=${t}&corners=ask`]),
  ...["facts", "bare"].map((c) => [`corners-${c}`, `title=portfolio&corners=${c}`]),
];

const browser = await chromium.launch({
  executablePath: "/home/yehuda/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

for (const [name, query] of SHOTS) {
  for (const lang of ["en", "he"]) {
    for (const [win, width, height] of WINDOWS) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      await page.goto(`${BASE}/?${query}`, { waitUntil: "load" });
      if (lang === "he") {
        await page.evaluate(() => {
          document.documentElement.lang = "he";
          document.documentElement.dir = "rtl";
        });
      }
      await page.evaluate(() => document.fonts.ready);
      /* Long enough for all four arrival stages and their seatbelt. A shot
         taken mid-sequence is a shot of a paper mask. */
      await page.waitForTimeout(2600);
      await page.screenshot({ path: `${OUT}/${name}-${lang}-${win}.png` });
      await page.close();
      console.log(`${name}-${lang}-${win}`);
    }
  }
}

await browser.close();
