import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const W = "./";
const { startPreview } = await import(W + "site-stub.mjs");
const { handler } = await import(W + "blog-fixture.mjs");
const OUT = process.env.OUT;
mkdirSync(OUT, { recursive: true });
const base = await startPreview();
const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const width of (process.env.WIDTHS ?? "360,390,430").split(",").map(Number))
  for (const lang of ["en", "he"])
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
      await ctx.route("**/api/**", handler({ hebrewTable: lang === "he" }));
      await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
      const page = await ctx.newPage();
      await page.goto(base.base + (lang === "he" ? "/he" : "") + "/blog/the-long-note", { waitUntil: "load" });
      await page.locator("footer").first().waitFor({ state: "attached" });
      await page.waitForTimeout(1500);
      const tag = `${width}-${lang}-${theme}`;
      const sc = async (y) => { await page.evaluate((y) => { scrollTo(0, y); dispatchEvent(new Event("scroll")); }, y); await page.waitForTimeout(600); };
      const y = await page.evaluate(() => { const h = [...document.querySelectorAll("article h2")][1]; return h.getBoundingClientRect().top + scrollY - 20; });
      await sc(y + 60); await sc(y);
      await page.screenshot({ path: `${OUT}/${tag}-heading.png`, timeout: 120000 });
      const ty = await page.evaluate(() => { const t = document.querySelector("table"); return t ? t.getBoundingClientRect().top + scrollY - 250 : 0; });
      await sc(ty + 60); await sc(ty);
      await page.screenshot({ path: `${OUT}/${tag}-table.png`, timeout: 120000 });
      const m = await page.evaluate(() => { const w = document.querySelector("[role=region][aria-label]"); const p = document.querySelector("article p"); if (!w) return null; const r = w.getBoundingClientRect(), pr = p.getBoundingClientRect(); return { wrap: [Math.round(r.left), Math.round(r.right)], p: [Math.round(pr.left), Math.round(pr.right)], sw: w.scrollWidth, cw: w.clientWidth, sl: Math.round(w.scrollLeft), vw: innerWidth, docOverflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
      console.log(tag, JSON.stringify(m));
      await ctx.close();
    }
await browser.close();
process.exit(0);
