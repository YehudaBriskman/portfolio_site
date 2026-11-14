/**
 * Renders every mail template to HTML files, and (with --shots) screenshots each
 * at 390 and 600 px, light and dark, so the design can be looked at.
 *
 *   npx tsx scripts/mail-gallery.ts <outDir> [--shots]   (outDir defaults to ./mail-gallery-out; keep it out of git)
 *
 * Variants per template: English and Hebrew, a normal and a stress copy (a very
 * long name, markup in every field). Dark is the real prefers-color-scheme
 * block, switched by the browser, not a second render. Screenshots need
 * playwright-core (installed with the web package) and a Chromium.
 * No address, secret or network call is involved: the token secret is a throwaway,
 * and the card image requests are answered locally.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import "../src/test-env.js";

/* The renderers read env at import; the test defaults are throwaways that never reach a network. */
process.env.SUBSCRIBE_SECRET ??= "gallery-throwaway-secret-not-used-anywhere-else";
process.env.SITE_URL = "https://gallery.example";

/* The mail services import the EmailJS client at load; rendering never calls it, and tsx cannot load its typings file, so it is stubbed here. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("node:module") as { _load: (request: string, ...rest: unknown[]) => unknown };
const load = Module._load;
Module._load = (request, ...rest) => (request === "@emailjs/nodejs" ? {} : load(request, ...rest));

const args = process.argv.slice(2);
const shots = args.includes("--shots");
const out = path.resolve(args.find((a) => !a.startsWith("--")) ?? "mail-gallery-out");

const NASTY = `<script>alert(1)</script> <b>bold</b> & "quoted" 'single'`;
const LONG_EN = "Alexandria-Wilhelmina Featherstonehaugh-Cholmondeley the Third of Nowhere-in-Particular";
const LONG_HE = "אלכסנדריה־וילהלמינה פתרסטונהו־צ׳ולמונדלי השלישית מכל מקום ובשום מקום מסוים";

async function main() {
  const { renderCampaignMail } = await import("../src/campaigns/render.js");
  const { buildOwnerEmail } = await import("../src/announce/emailHtml.js");
  const { renderKit } = await import("../src/announce/kit.js");
  const { renderMail } = await import("../src/mail/render.js");
  const { DEFAULT_ANNOUNCE_SETTINGS } = await import("../src/announce/schemas.js");
  const { hashEmail } = await import("../src/audience/store.js");
  const { renderConfirmMail } = await import("../src/audience/mail.js");
  const { renderContactNotice, renderAutoReply } = await import("../src/mail/transactional.js");
  const { contactLines } = await import("../src/announce/schemas.js");

  const ident = (name: string) => ({
    ...DEFAULT_ANNOUNCE_SETTINGS.sender,
    footerIdentity: name,
    identityEmail: "contact@example.org",
    identityPhone: "+972 50-123 4567",
    identityWebsite: "https://example.org",
    identityLinkedin: "https://www.linkedin.com/in/example",
    labelMode: "all" as const,
  });
  const files: { name: string; html: string }[] = [];
  const add = (name: string, html: string) => {
    files.push({ name, html });
  };

  const texts: Record<string, string> = {};
  for (const lang of ["en", "he"] as const) {
    const he = lang === "he";
    for (const stress of [false, true]) {
      const tag = `${lang}-${stress ? "stress" : "normal"}`;
      const name = stress ? (he ? LONG_HE : LONG_EN) : he ? "יהודה בריסקמן" : "Yehuda Briskman";
      const t = (s: string) => (stress ? `${NASTY} ${s}` : s);

      const campaign = await renderCampaignMail(
        {
          subject: t(he ? "מה חדש בבלוג" : "What is new on the blog"),
          preheader: t(he ? "שלושה פוסטים חדשים ועדכון אחד" : "Three new posts and one update"),
          bodyText: "x",
          blocks: [
            { type: "h2", text: t(he ? "שלושה פוסטים חדשים" : "Three new posts") },
            { type: "p", text: t(he ? "כתבתי על מערכות מייל, על נגישות ועל עיצוב כהה.\nהשורה השנייה כאן." : "I wrote about mail systems, accessibility and dark mode.\nThis is the second line.") },
            { type: "ul", items: [t(he ? "מערכת עיצוב למייל" : "A design system for mail"), t(he ? "למה לא עוקבים אחרי פתיחות" : "Why there is no open tracking"), "Dark mode, tested"] },
            { type: "image", url: "https://gallery.example/api/seo/og/blog/sample.png?format=og", text: t("Share card") },
            { type: "cta", url: "https://gallery.example/blog/sample", label: t(he ? "לקריאה באתר" : "Read on the site") },
          ],
        },
        { lang },
        hashEmail("gallery@example.invalid"),
        ident(name),
      );
      add(`campaign-${tag}`, campaign.html);
      texts[`campaign-${tag}`] = campaign.text;

      const ev = {
        _id: "g1", type: "announce" as const, kind: "post" as const, ref: "sample", title: t(he ? "מערכת עיצוב למייל" : "A design system for mail"),
        titleHe: t("מערכת עיצוב למייל"), summary: t("A short summary of the post that wraps onto a second line in a narrow window."), tags: ["mail", "design"],
        url: "https://gallery.example/blog/sample", path: "/blog/sample", langs: ["en", "he"] as ("en" | "he")[], createdAt: "2026-01-01T00:00:00Z", done: {},
      };
      add(`owner-${tag}`, buildOwnerEmail(ev as never, renderKit(ev as never, DEFAULT_ANNOUNCE_SETTINGS), "https://gallery.example").html);

      const footer = contactLines(ident(name));
      add(`confirm-${tag}`, renderConfirmMail({ name: stress ? NASTY : he ? "עדה" : "Ada", lang }, "https://gallery.example/subscribe/confirm?token=abc.def", ident(name)).html);
      add(
        `notice-${tag}`,
        renderContactNotice(
          { subject: t("Portfolio contact"), title: t(he ? "הודעה חדשה מעדה" : "New message from Ada"), body: `Name: ${t("Ada")}\nEmail: ada@example.invalid\n\n${t(he ? "שלום, אהבתי את האתר ורציתי לשאול על שיתוף פעולה.\nתודה!" : "Hello, I liked the site and wanted to ask about working together.\nThanks!")}`, replyTo: "ada@example.invalid" },
          footer,
        ).html,
      );
      add(`autoreply-${tag}`, renderAutoReply(lang, footer).html);

      add(
        `sampler-${tag}`,
        renderMail(
          [
            { type: "paragraph", tone: "kicker", text: t(he ? "דוגמה" : "Sampler") },
            { type: "heading", text: t(he ? "כותרת ראשית ארוכה שעוברת לשורה שנייה במסך צר" : "A long main heading that wraps to a second line on a narrow screen") },
            { type: "heading", level: 2, text: t(he ? "כותרת משנה" : "A subheading") },
            { type: "paragraph", text: t(he ? "פסקה רגילה עם קישור ועם English באמצע המשפט, ועוד מספר 12,345." : "A normal paragraph with some עברית in the middle of the sentence, and a number 12,345.") },
            { type: "paragraph", tone: "muted", text: t(he ? "טקסט משני" : "Secondary text") },
            { type: "list", items: [t("One"), t("Two"), t("Three")] },
            { type: "card", label: t("Caption"), meta: "120/300", lines: [t("A line the reader copies"), "", "#tag #another"], lang },
            { type: "button", label: t(he ? "כפתור ראשי" : "Primary button"), href: "https://gallery.example/x" },
            { type: "divider" },
            { type: "footer", lines: [name, "contact@example.org"], note: [he ? "כדי להפסיק לקבל הודעות: " : "To stop receiving these: ", { href: "https://gallery.example/unsubscribe?token=abc", text: "https://gallery.example/unsubscribe?token=abc" }] },
          ],
          { lang, title: "Sampler", preheader: "Preview line", origin: "https://gallery.example" },
        ).html,
      );
    }
  }

  fs.mkdirSync(out, { recursive: true });
  for (const f of files) fs.writeFileSync(path.join(out, `${f.name}.html`), f.html);
  /* The plain-text twin of the campaign mail, as a recipient's text-only client shows it. */
  for (const [k, v] of Object.entries(texts)) fs.writeFileSync(path.join(out, `${k}.txt`), v);
  console.log(`${files.length} files in ${out}`);
  if (!shots) return;

  const require = createRequire(path.resolve(__dirname, "../../web/package.json"));
  const { chromium } = require("playwright-core") as typeof import("playwright-core");
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ["--disable-gpu", "--disable-frame-rate-limit", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"] } : {});
  const svg = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#6b7280"/><text x="50%" y="50%" fill="#fff" font-size="28" text-anchor="middle">card image</text></svg>`;
  for (const scheme of ["light", "dark"] as const) {
    for (const width of [390, 600]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
      await ctx.route("**/api/seo/og/**", (r) => r.fulfill({ contentType: "image/svg+xml", body: svg(1200, 630) }));
      const page = await ctx.newPage();
      for (const f of files) {
        await page.goto(`file://${path.join(out, `${f.name}.html`)}`);
        await page.waitForTimeout(250);
        /* Straight through the DevTools protocol: page.screenshot waits on animation frames, which a headless Chromium on a slow box may emit once in 40 s. */
        const cdp = await ctx.newCDPSession(page);
        const { cssContentSize } = (await cdp.send("Page.getLayoutMetrics")) as { cssContentSize: { width: number; height: number } };
        const shot = (await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.ceil(cssContentSize.height), scale: 1 } })) as { data: string };
        fs.writeFileSync(path.join(out, `${f.name}-${scheme}-${width}.png`), Buffer.from(shot.data, "base64"));
        await cdp.detach();
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log("screenshots done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
