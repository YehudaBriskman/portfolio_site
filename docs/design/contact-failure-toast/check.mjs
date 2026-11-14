/*
 * The contact form's failure toast, in a real browser: where it sits at 390 and 1280,
 * that it is inside the modal dialog (so reachable), that Details opens by keyboard,
 * what Escape does, and that the words are kept. The toast is the shared lib/toast service.
 * Writes <viewport>-<lang>-{toast,details}.png beside this file and exits 1 on a failed check.
 *
 *   cd web && npx vite build && cd .. && node docs/design/contact-failure-toast/check.mjs
 *
 * `CHROME=<path>` overrides the browser. Nothing leaves the machine: every request that is
 * not to the preview server is aborted, and /api/email/send answers 502.
 * The box's headless Chromium has no frame clock, so waits are fixed ones.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../../../web");
const { chromium } = createRequire(WEB + "/package.json")("playwright-core");
const { answer, startPreview } = await import(`${WEB}/scripts/a11y/site-stub.mjs`);

const { base, stop } = await startPreview();
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  /* Headed under xvfb when there is a display: headless Chromium on the dev box paints so rarely that a screenshot times out. */
  headless: !process.env.DISPLAY,
  args: ["--no-sandbox", "--disable-gpu", "--disable-gpu-compositing", "--run-all-compositor-stages-before-draw", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"],
});

const shot = async (p, path) => {
  for (let i = 0; ; i++) {
    try {
      return await p.screenshot({ path, timeout: 45_000 });
    } catch (e) {
      if (i >= 2) throw e;
    }
  }
};

let bad = 0;
const check = (ok, what) => {
  console.log(ok ? "ok  " : "FAIL", what);
  if (!ok) bad++;
};

for (const scheme of ["light", "dark"])
for (const [width, height] of [
  [390, 844],
  [1280, 800],
]) {
  for (const [lang, path] of [
    ["en", "/"],
    ["he", "/he"],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", colorScheme: scheme });
    const p = await context.newPage();
    await p.route("**/*", (route) => {
      const u = route.request().url();
      if (!u.startsWith(base)) return route.abort();
      const pathname = new URL(u).pathname;
      if (pathname === "/api/email/send") return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Could not send the message right now" }) });
      if (pathname.startsWith("/api/")) {
        const a = answer(u, false);
        return route.fulfill({ status: a.status, contentType: "application/json", body: JSON.stringify(a.body) });
      }
      return route.continue();
    });
    p.on("console", (m) => process.env.DBG && console.log("console:", m.type(), m.text().slice(0, 200)));
    p.on("pageerror", (e) => console.log("pageerror:", e.message));
    const tag = `${width}-${lang}-${scheme}`;
    await p.goto(base + path);
    await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector("#contact button").click());
    await p.waitForTimeout(600);
    await p.evaluate(() => {
      const set = (n, v) => {
        const el = document.querySelector(`#contact [name=${n}]`);
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      set("name", "Dana");
      set("email", "dana@example.com");
      set("message", "Hello there, a long enough message.");
    });
    await p.evaluate(() => document.querySelector("#contact form").requestSubmit());
    await p.waitForSelector("[data-sonner-toast]", { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(600);

    if (process.env.DBG) console.log(await p.evaluate(() => JSON.stringify({ host: !!document.querySelector("[data-toast-host]"), toaster: !!document.querySelector("[data-sonner-toaster]"), alert: document.querySelector("[data-toast-host] [role=alert]")?.textContent, form: document.querySelector("#contact form")?.outerHTML.length, failure: document.querySelector("#contact [role=alert]")?.textContent })));
    const box = await p.evaluate(() => {
      const t = document.querySelector("[data-sonner-toaster]");
      const li = t?.querySelector("[data-sonner-toast]");
      const r = li?.getBoundingClientRect();
      return t && r ? { inDialog: !!t.closest("dialog"), y: t.getAttribute("data-y-position"), x: t.getAttribute("data-x-position"), top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, text: li.textContent } : null;
    });
    check(!!box, `${tag}: toast shown`);
    if (box) {
      check(box.inDialog, `${tag}: toaster is inside the dialog`);
      if (width < 600) check(box.y === "top" && box.top < box.vh / 3, `${tag}: at the top (top=${Math.round(box.top)})`);
      else check(box.y === "bottom" && box.x === (lang === "he" ? "left" : "right") && box.bottom > box.vh * 0.6, `${tag}: bottom, mirrored in Hebrew (right=${Math.round(box.right)}, bottom=${Math.round(box.bottom)})`);
      check(box.left >= 0 && box.right <= box.vw, `${tag}: inside the viewport`);
      check(!/HTTP|502|Failed to fetch/.test(box.text), `${tag}: no machine text`);
    }
    /* Sonner holds a toast while it is hovered; a slow first screenshot must not outlast its 15 s. */
    await p.mouse.move(width / 2, 4);
    await p.hover("[data-sonner-toast]", { force: true });
    await shot(p, `${HERE}/${tag}-toast.png`);

    // Details by keyboard: Tab from the Send button reaches the toast inside the dialog.
    await p.evaluate(() => document.querySelector("#contact button[type=submit]").focus());
    let reached = false;
    for (let i = 0; i < 8 && !reached; i++) {
      await p.keyboard.press("Tab");
      reached = await p.evaluate(() => document.activeElement?.closest("[data-sonner-toaster]") !== null && document.activeElement?.getAttribute("aria-expanded") !== null);
    }
    check(reached, `${tag}: Details reachable with Tab`);
    await p.keyboard.press("Enter");
    await p.waitForTimeout(400);
    const opened = await p.evaluate(() => /@/.test(document.querySelector("[data-sonner-toaster]")?.textContent ?? ""));
    check(opened, `${tag}: Details shows the address`);
    await shot(p, `${HERE}/${tag}-details.png`);

    await p.keyboard.press("Escape");
    await p.waitForTimeout(600);
    const after = await p.evaluate(() => ({
      dialogOpen: document.querySelector("#contact dialog")?.hasAttribute("open"),
      toast: !!document.querySelector("[data-sonner-toast]"),
      message: document.querySelector("#contact [name=message]").value,
      focus: document.activeElement?.getAttribute("type"),
    }));
    /* The shared service does not take Escape for the toast: it reaches the dialog. Recorded, not asserted. */
    console.log("info", `${tag}: after Escape dialogOpen=${after.dialogOpen} toast=${after.toast}`);
    check(after.message === "Hello there, a long enough message.", `${tag}: the words are kept`);
    await context.close();
  }
}
await browser.close();
stop();
process.exit(bad ? 1 : 0);
