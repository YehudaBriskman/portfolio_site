import { describe, expect, it } from "vitest";
import { esc, escMulti, oneLine } from "./escape.js";
import { MAIL_HTML_LIMIT, PALETTE, renderMail, type MailBlock } from "./render.js";
import { safeHref, safeImage } from "./urls.js";

const ORIGIN = "https://example.test";
const NASTY = `<script>alert(1)</script><img src=x onerror=alert(2)> "q" 'q' &amp; {{x}}`;
const ESCAPED = "&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(2)&gt; &quot;q&quot; &#39;q&#39; &amp;amp; {{x}}";

/* Markup in every field of every block type. */
const hostile: MailBlock[] = [
  { type: "paragraph", tone: "kicker", text: NASTY },
  { type: "image", src: `${ORIGIN}/a.png?x="><script>`, alt: NASTY, width: 552, height: 290 },
  { type: "heading", text: NASTY },
  { type: "heading", level: 2, text: NASTY, lang: "he" },
  { type: "paragraph", text: NASTY },
  { type: "paragraph", tone: "muted", text: [NASTY, { href: `https://ok.example/?a=1&b="2"`, text: NASTY }] },
  { type: "button", label: NASTY, href: `https://ok.example/p?a=1&b=<2>` },
  { type: "list", items: [NASTY, NASTY] },
  { type: "card", label: NASTY, meta: NASTY, lines: [NASTY, "", NASTY], lang: "he" },
  { type: "divider" },
  { type: "footer", lines: [NASTY, "second"], note: [NASTY, { href: "https://ok.example/u", text: NASTY }], extra: [[NASTY]] },
];

const page = (blocks: MailBlock[], o: Partial<Parameters<typeof renderMail>[1]> = {}) => renderMail(blocks, { lang: "en", origin: ORIGIN, title: NASTY, preheader: NASTY, ...o });

describe("the one escape function", () => {
  it("escapes the five characters and keeps everything else", () => {
    expect(esc(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;");
    expect(esc("שלום 🙂")).toBe("שלום 🙂");
    expect(escMulti("a\r\nb\nc")).toBe("a<br>b<br>c");
    expect(oneLine("a\r\nb c")).toBe("a b c");
  });

  it.each(["en", "he"] as const)("markup in every field (%s) never becomes markup", (lang) => {
    const { html, text } = page(hostile, { lang });
    /* Stripped of the tags the renderer itself writes, no tag from data remains. */
    expect(html).not.toMatch(/<script|<img src=x|onerror=\w*\s*=|javascript:/i);
    expect(html.split(ESCAPED).length - 1).toBeGreaterThan(15);
    expect(html).not.toContain(NASTY);
    expect(html).toContain('href="https://ok.example/?a=1&amp;b=%222%22"');
    expect(html).toContain('href="https://ok.example/p?a=1&amp;b=%3C2%3E"');
    /* The image URL carried markup, so the origin check kept the host but the URL is encoded, never raw. */
    expect(html).not.toContain('"><script>');
    /* The text part is plain text: raw characters, no entities. */
    expect(text).toContain(NASTY);
    expect(text).not.toContain("&lt;");
  });

  it("only writes tags the renderer knows", () => {
    const tags = new Set([...page(hostile).html.matchAll(/<\/?([a-z][a-z0-9]*)/gi)].map((m) => m[1].toLowerCase()));
    const allowed = ["!doctype", "html", "head", "meta", "title", "style", "body", "div", "table", "tr", "td", "p", "h1", "h2", "ul", "li", "a", "img", "br", "bdi"];
    expect([...tags].filter((t) => !allowed.includes(t) && t !== "doctype")).toEqual([]);
  });
});

describe("urls", () => {
  it("links are http(s) or mailto without credentials", () => {
    expect([safeHref("javascript:alert(1)"), safeHref("data:text/html,x"), safeHref("https://u:p@x.co"), safeHref("nope"), safeHref("mailto:a@b.co")]).toEqual([null, null, null, null, "mailto:a@b.co"]);
  });
  it("images come from the site origin over https only", () => {
    expect(safeImage(`${ORIGIN}/a.png`, ORIGIN)).toBe(`${ORIGIN}/a.png`);
    expect([safeImage("https://evil.example/a.png", ORIGIN), safeImage("http://example.test/a.png", ORIGIN), safeImage(`https://u:p@example.test/a.png`, ORIGIN)]).toEqual([null, null, null]);
  });
  it("drops a foreign image and a bad link instead of writing them", () => {
    const { html, text } = page([
      { type: "image", src: "https://evil.example/x.png", alt: "x", width: 100 },
      { type: "button", label: "Go", href: "javascript:alert(1)" },
    ]);
    expect(html).not.toMatch(/<img|evil\.example|javascript:|<a /);
    expect(text).toBe("Go");
  });
});

const body: MailBlock[] = [
  { type: "paragraph", tone: "kicker", text: "New post" },
  { type: "image", src: `${ORIGIN}/c.png`, alt: "Card", width: 552, height: 290 },
  { type: "heading", text: "A title" },
  { type: "paragraph", text: "First line\nSecond line" },
  { type: "list", items: ["one", "two"] },
  { type: "button", label: "Read it", href: `${ORIGIN}/blog/a` },
  { type: "divider" },
  { type: "footer", lines: ["Dana", "dana@example.org"], note: ["Unsubscribe: ", { href: `${ORIGIN}/u?t=1`, text: `${ORIGIN}/u?t=1` }] },
];

describe("the page", () => {
  it("is a safe table layout: no script, form, link tag, import, remote url() or tracking pixel", () => {
    const { html } = page(body);
    expect(html).toContain("<table");
    expect(html).toContain('width="600"');
    expect(html).not.toMatch(/<script|<form|<input|<link|<iframe|@import|url\(|<object|<embed/i);
    /* The only image is the one block, with alt, width and height. */
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toMatch(/alt="Card" width="552" height="290"/);
    expect(html).not.toMatch(/width="1"|height="1"/);
    /* Every link is the exact URL given: no redirect through anything of ours. */
    expect([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).sort()).toEqual([`${ORIGIN}/blog/a`, `${ORIGIN}/u?t=1`].sort());
  });

  it("carries lang and dir, light and dark scheme declarations and a dark block", () => {
    const en = page(body).html;
    expect(en).toContain('<html lang="en" dir="ltr"');
    expect(en).toContain('name="color-scheme" content="light dark"');
    expect(en).toContain("color-scheme:light dark");
    expect(en).toContain("@media (prefers-color-scheme: dark)");
    const he = page(body, { lang: "he" }).html;
    expect(he).toContain('<html lang="he" dir="rtl"');
    expect(he).not.toContain('dir="ltr"');
  });

  it("themes: light has no dark block, dark writes the dark palette inline", () => {
    const light = page(body, { theme: "light" }).html;
    expect(light).not.toContain("prefers-color-scheme");
    expect(light).toContain(`bgcolor="${PALETTE.light.card}"`);
    const dark = page(body, { theme: "dark" }).html;
    expect(dark).toContain(`bgcolor="${PALETTE.dark.card}"`);
    expect(dark).not.toContain(PALETTE.light.card);
  });

  it("every colour is explicit on the element (survives a client that inverts or drops <style>)", () => {
    const { html } = page(body);
    for (const m of html.matchAll(/<(p|h1|h2|ul|a)\b[^>]*style="([^"]*)"/g)) expect(m[2], m[0]).toMatch(/color:#/);
    expect(html).toMatch(/<body[^>]*bgcolor="#/);
  });

  it("has a hidden preheader, escaped, and none when there is no text", () => {
    const withPre = page(body, { preheader: "Preview <b>line</b>" }).html;
    expect(withPre).toMatch(/<div style="display:none;max-height:0;overflow:hidden;[^"]*">Preview &lt;b&gt;line&lt;\/b&gt;/);
    expect(page(body, { preheader: "  " }).html).not.toContain("display:none");
  });

  it("buttons are at least 44 px high", () => {
    const { html } = page(body);
    const a = html.match(/<a [^>]*class="btna"[^>]*>/)![0];
    const pad = Number(a.match(/padding:(\d+)px/)![1]);
    const line = Number(a.match(/line-height:(\d+)px/)![1]);
    expect(pad * 2 + line).toBeGreaterThanOrEqual(44);
    expect(html).toContain('height="44"');
  });

  it("generates the plain text from the same blocks", () => {
    expect(page(body).text).toBe(
      [
        "New post",
        `Card: ${ORIGIN}/c.png`,
        "A title",
        "First line\nSecond line",
        "- one\n- two",
        `Read it: ${ORIGIN}/blog/a`,
        "--",
        `--\nDana\ndana@example.org\nUnsubscribe: ${ORIGIN}/u?t=1`,
      ].join("\n\n"),
    );
  });

  it("stays well under the clipping size, and says so when it does not", () => {
    const big: MailBlock[] = Array.from({ length: 400 }, (_, i) => ({ type: "paragraph", text: `Paragraph ${i} ${"word ".repeat(40)}` }));
    const r = page(body);
    expect(r.bytes).toBeLessThan(MAIL_HTML_LIMIT / 4);
    expect(r.oversize).toBe(false);
    expect(page(big).oversize).toBe(true);
  });

  it("matches the snapshot (EN auto, HE auto)", () => {
    expect(page(body, { title: "T", preheader: "P" }).html).toMatchSnapshot("en");
    expect(page(body, { title: "T", preheader: "P", lang: "he" }).html).toMatchSnapshot("he");
  });
});

/* WCAG relative luminance, for the AA check of every text/background pair the palette uses. */
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe("contrast (AA, 4.5:1)", () => {
  it.each(["light", "dark"] as const)("%s palette", (t) => {
    const p = PALETTE[t];
    const pairs: [string, string][] = [[p.ink, p.card], [p.soft, p.card], [p.ink, p.box], [p.link, p.card], [p.btnInk, p.btn], [p.soft, p.page], [p.ink, p.page]];
    for (const [fg, bg] of pairs) expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
});
