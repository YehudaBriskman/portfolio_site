import { describe, expect, it } from "vitest";
import { buildOwnerEmail } from "../announce/emailHtml.js";
import { renderKit } from "../announce/kit.js";
import { DEFAULT_ANNOUNCE_SETTINGS, type AnnounceEvent } from "../announce/schemas.js";
import { renderMail, type MailBlock } from "./render.js";

const NASTY = `<script>alert(1)</script> "q"`;
const page = (blocks: MailBlock[]) => renderMail(blocks, { lang: "en", origin: "https://example.test" });

describe("facts block (data rows)", () => {
  const facts: MailBlock = { type: "facts", rows: [{ label: "Date", value: "10 Nov" }, { label: NASTY, value: NASTY }, { label: "", value: "dropped" }] };
  it("escapes, uses a table with inline styles, and drops half-empty rows", () => {
    const { html, text } = page([facts]);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &quot;q&quot;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("dropped");
    expect(html).not.toMatch(/display:\s*(flex|grid)/);
    expect(text).toContain("Date: 10 Nov");
  });
  it("is dark-mode and RTL safe, and renders nothing when empty", () => {
    expect(page([facts]).html).toContain(".box{background-color:#34302A");
    expect(page([{ type: "facts", rows: [{ label: "a", value: "b" }], lang: "he" }]).html).toContain(`dir="rtl" lang="he"`);
    expect(page([{ type: "facts", rows: [] }]).html).not.toContain('class="box"');
  });
});

describe("owner announce mail data rows", () => {
  const ev = (o: Partial<AnnounceEvent> = {}): AnnounceEvent => ({
    _id: "a1", type: "announce", kind: "post", ref: "my-post", title: "T", summary: "S", tags: [], url: "https://example.test/blog/my-post", path: "/blog/my-post", langs: ["en"], createdAt: "2026-01-01T00:00:00Z", done: {}, ...o,
  });
  const build = (e: AnnounceEvent) => buildOwnerEmail(e, renderKit(e, DEFAULT_ANNOUNCE_SETTINGS), "https://example.test");
  it("shows the real date, read time and topics, and nothing when the event has none", () => {
    const withData = build(ev({ publishedAt: "2026-11-10T08:00:00Z", readMinutes: 6, tags: ["Email"] }));
    expect(withData.text).toContain("Read time: 6 min");
    expect(withData.text).toContain("Topics: Email");
    expect(build(ev()).text).not.toContain("Read time");
  });
});
