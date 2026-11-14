#!/usr/bin/env node
/*
 * The newsletter signature, as a mail client draws it: light, and dark with the
 * light-ink file swapped in by prefers-color-scheme. Input is a folder of
 * `mail-<lang>-<theme>.html` plus `email.png` / `email-light.png`, made by
 * rendering renderMail() with a "signature" block; images are answered from
 * the folder so nothing leaves the box.
 *
 *   IN=/tmp/mail OUT=../docs/design/signature node scripts/shoot-signature-mail.mjs
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(WEB, "package.json"))("playwright-core");
const IN = resolve(process.env.IN);
const OUT = resolve(process.env.OUT || resolve(WEB, "../docs/design/signature"));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu"] });
try {
  for (const lang of ["en", "he"]) {
    for (const theme of ["light", "dark"]) {
      /* theme "auto" mail under the client's colour scheme: the file the campaign really sends. */
      const ctx = await browser.newContext({ viewport: { width: 640, height: 700 }, colorScheme: theme, deviceScaleFactor: 1 });
      await ctx.route("**/api/signature/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: readFileSync(`${IN}/${r.request().url().endsWith("-email-light.png") ? "email-light" : "email"}.png`) }));
      const page = await ctx.newPage();
      await page.setContent(readFileSync(`${IN}/mail-${lang}-auto.html`, "utf8"), { waitUntil: "load" });
      await page.waitForTimeout(800);
      const shown = await page.evaluate(() => [...document.querySelectorAll("img[class^=sig-]")].filter((i) => getComputedStyle(i).display !== "none").map((i) => i.className));
      const want = theme === "dark" ? ["sig-d"] : ["sig-l"];
      if (JSON.stringify(shown) !== JSON.stringify(want)) throw new Error(`${lang} ${theme}: showing ${shown}, expected ${want}`);
      const cdp = await ctx.newCDPSession(page);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      writeFileSync(`${OUT}/mail-${lang === "he" ? "rtl" : "ltr"}-${theme}.png`, Buffer.from(data, "base64"));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log("shot into", OUT);
