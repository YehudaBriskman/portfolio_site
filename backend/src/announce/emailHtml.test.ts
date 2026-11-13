import { describe, expect, it, vi } from "vitest";
import { buildOwnerEmail, esc } from "./emailHtml.js";
import { renderKit } from "./kit.js";
import { notifyOwner } from "./notify.js";
import { emailService } from "../services/email.service.js";
import { DEFAULT_ANNOUNCE_SETTINGS, type AnnounceEvent } from "./schemas.js";

const SITE = "https://example.test";
const NASTY = `<script>alert("x")</script> & 'q'`;
const ev = (o: Partial<AnnounceEvent> = {}): AnnounceEvent => ({
  _id: "a1", type: "announce", kind: "post", ref: "my-post", title: NASTY, summary: `sum <b>bold</b> & "q"`, tags: [],
  url: `${SITE}/blog/my-post`, path: "/blog/my-post", langs: ["en"], createdAt: "2026-01-01T00:00:00Z", done: {}, ...o,
});
const build = (e: AnnounceEvent) => buildOwnerEmail(e, renderKit(e, DEFAULT_ANNOUNCE_SETTINGS), SITE);

describe("owner email html", () => {
  it("escapes every dynamic value", () => {
    expect(esc(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;");
    const { html } = build(ev());
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;");
    expect(html).toContain("sum &lt;b&gt;bold&lt;/b&gt; &amp; &quot;q&quot;");
  });

  it("builds the card and button URLs from SITE_URL only", () => {
    const { html } = build(ev());
    expect(html).toContain(`src="${SITE}/api/seo/og/blog/my-post.png?format=og"`);
    expect(html).toContain(`href="${SITE}/admin/announce"`);
    expect(html).toMatch(/alt="Share card: /);
  });

  it("drops the image for a ref that is not a plain slug", () => {
    const { html } = build(ev({ ref: `x"><img src=//evil/`, path: undefined }));
    expect(html).not.toContain("<img");
    expect(html).not.toContain("evil");
  });

  it("uses the release card for a release", () => {
    const { html } = build(ev({ kind: "release", ref: "v1.2.0", version: "v1.2.0", title: "site v1.2.0", path: undefined, url: "https://github.com/o/r/releases/tag/v1.2.0" }));
    expect(html).toContain("/api/seo/og/release/v1.2.0.png?format=og");
  });

  it("puts Hebrew in an rtl block and escapes it", () => {
    const e = ev({ title: "Title", titleHe: "כותרת <i>עברית</i>", summaryHe: "תקציר", langs: ["en", "he"] });
    const { html, text } = build(e);
    expect(html).toContain('dir="rtl"');
    expect(html).toMatch(/dir="rtl" lang="he"[^>]*>[^<]*כותרת &lt;i&gt;/);
    expect(html).not.toContain("<i>");
    expect(text).toContain("כותרת <i>עברית</i>");
  });

  it("renders each caption line as its own dir=auto element", () => {
    const e = ev({ title: "T", titleHe: "כותרת", summaryHe: "תקציר", tags: ["web"], langs: ["en", "he"] });
    const { html } = buildOwnerEmail(e, renderKit(e, { ...DEFAULT_ANNOUNCE_SETTINGS, hashtags: ["#dev"] }), SITE);
    expect(html).toContain('<div dir="auto" style="min-height:1.55em;">#dev #web</div>');
    expect(html).toMatch(/<div dir="auto"[^>]*>חדש בבלוג: /);
  });

  it("is email-safe: tables, no script, no external css, dark styles inline in a style block", () => {
    const { html } = build(ev());
    expect(html).toContain("<table");
    expect(html).toContain('name="color-scheme"');
    expect(html).not.toMatch(/<script|<link|@import/i);
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toMatch(/<td class="btn" bgcolor="#[0-9A-F]{6}" height="44"/);
  });

  it("has a text part with the same information", () => {
    const { text, subject } = build(ev());
    expect(subject).toContain("New on the blog");
    for (const s of [NASTY, "LinkedIn:", "X:", "Email:", `${SITE}/admin/announce`, `${SITE}/api/seo/og/blog/my-post.png?format=og`]) expect(text).toContain(s);
  });
});

describe("notifyOwner", () => {
  it("sends html and text with no replyTo", async () => {
    const send = vi.spyOn(emailService, "send").mockResolvedValue({ ok: true } as never);
    await notifyOwner(ev(), DEFAULT_ANNOUNCE_SETTINGS);
    const arg = send.mock.calls[0][0];
    expect(arg).not.toHaveProperty("replyTo");
    expect(arg.html).toContain("<table");
    expect(arg.text).toContain("/admin/announce");
  });

  it("logs a send failure instead of throwing", async () => {
    vi.spyOn(emailService, "send").mockRejectedValue(new Error("smtp down"));
    await expect(notifyOwner(ev(), DEFAULT_ANNOUNCE_SETTINGS)).resolves.toBeUndefined();
  });
});
