import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRichEmail, copyRich, escapeHtml } from "..";

const base = {
  title: "A note",
  summary: "Why it works",
  url: "https://example.com/blog/a-note?utm_source=share&utm_medium=email",
  image: "https://example.com/api/seo/og/blog/a-note.png",
  origin: "https://example.com",
  buttonLabel: "Read more",
};

describe("buildRichEmail", () => {
  it("builds a table layout with the card, title, summary and a button link", () => {
    const { html, text } = buildRichEmail(base);
    expect(html).toContain('role="presentation"');
    expect(html).toContain('<img src="https://example.com/api/seo/og/blog/a-note.png"');
    expect(html).toContain("A note");
    expect(html).toContain("Why it works");
    expect(html).toContain('href="https://example.com/blog/a-note?utm_source=share&amp;utm_medium=email"');
    expect(html).toContain("padding:12px 24px");
    expect(text).toBe(`A note\n\nWhy it works\n\n${base.url}`);
  });

  it("is safe for mail clients: no script, style block, external font, event handler or remote CSS", () => {
    const { html } = buildRichEmail(base);
    expect(html).not.toMatch(/<script|<style|<link|@import|@font-face|url\(|\son\w+=|<div|<h1/i);
    // Every absolute address in the markup is on the site's own host.
    const hosts = new Set((html.match(/https?:\/\/[^"'\s<>]+/g) ?? []).map((u) => new URL(u.replace(/&amp;/g, "&")).hostname));
    expect([...hosts]).toEqual(["example.com"]);
  });

  it("escapes <, &, quotes and apostrophes in the title, summary, label and alt", () => {
    const { html } = buildRichEmail({
      ...base,
      title: `<img src=x onerror=alert(1)> & "q" 'a'`,
      summary: `</td><script>1</script>`,
      buttonLabel: `"><b>`,
      imageAlt: `" onload="x`,
    });
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot; &#39;a&#39;");
    expect(html).toContain("&lt;/td&gt;&lt;script&gt;1&lt;/script&gt;");
    expect(html).toContain("&quot;&gt;&lt;b&gt;");
    expect(html).toContain('alt="&quot; onload=&quot;x"');
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/<b>|<img src=x/);
  });

  it("takes absolute addresses from the origin only", () => {
    expect(() => buildRichEmail({ ...base, url: "https://evil.example/x" })).toThrow(RangeError);
    expect(() => buildRichEmail({ ...base, url: "/blog/a-note" })).toThrow(RangeError);
    expect(() => buildRichEmail({ ...base, url: "javascript:alert(1)" })).toThrow(RangeError);
    expect(() => buildRichEmail({ ...base, origin: "javascript:alert(1)" })).toThrow(RangeError);
    // A card from elsewhere is dropped, not loaded.
    const { html } = buildRichEmail({ ...base, image: "https://evil.example/card.png" });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("evil.example");
  });

  it("leaves out an empty summary and sets direction for Hebrew", () => {
    const { html, text } = buildRichEmail({ ...base, summary: "", dir: "rtl" });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("text-align:right");
    expect(text).toBe(`A note\n\n${base.url}`);
  });

  it("escapeHtml handles null and control characters", () => {
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml("a\u0000b")).toBe("a b");
  });
});

describe("copyRich", () => {
  afterEach(() => vi.unstubAllGlobals());
  const content = { html: "<b>x</b>", text: "x" };

  it("writes text/html and text/plain together", async () => {
    const write = vi.fn(async () => {});
    class Item {
      constructor(public data: Record<string, Blob>) {}
    }
    vi.stubGlobal("ClipboardItem", Item);
    vi.stubGlobal("navigator", { clipboard: { write, writeText: vi.fn() } });
    expect(await copyRich(content)).toBe("rich");
    const item = (write.mock.calls[0] as unknown as [Item[]])[0][0];
    expect(Object.keys(item.data).sort()).toEqual(["text/html", "text/plain"]);
  });

  it("falls back to plain text without ClipboardItem, or when it is refused", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("ClipboardItem", undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyRich(content)).toBe("plain");
    expect(writeText).toHaveBeenCalledWith("x");
    vi.stubGlobal("ClipboardItem", class {});
    vi.stubGlobal("navigator", { clipboard: { write: vi.fn(async () => Promise.reject(new Error("no"))), writeText } });
    expect(await copyRich(content)).toBe("plain");
  });

  it("reports false with no clipboard", async () => {
    vi.stubGlobal("navigator", {});
    expect(await copyRich(content)).toBe(false);
  });
});
