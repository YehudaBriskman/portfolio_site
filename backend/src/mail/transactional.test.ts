import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ANNOUNCE_SETTINGS } from "../announce/schemas.js";
import { renderConfirmMail } from "../audience/mail.js";
import { buildOwnerEmail } from "../announce/emailHtml.js";
import { renderKit } from "../announce/kit.js";
import { MAIL_HTML_LIMIT } from "./render.js";
import { renderAutoReply, renderContactNotice } from "./transactional.js";

const NASTY = `<script>alert(1)</script><img src=x onerror=alert(2)> "q" 'q' &amp;`;
const ESCAPED = "&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(2)&gt; &quot;q&quot; &#39;q&#39; &amp;amp;";
const LINK = "https://example.test/subscribe/confirm?token=abc.def";

const sender = (over: Record<string, string> = {}) => ({
  ...DEFAULT_ANNOUNCE_SETTINGS.sender,
  footerIdentity: "Example Person",
  identityEmail: "contact@example.org",
  identityWebsite: "https://example.org",
  identityPhone: "+972 50-000 0000",
  ...over,
});
const FOOTER = ["Example Person", "contact@example.org", "+972 50-000 0000", "https://example.org"];

/* No markup of the nasty value survives in any mail, and the escaped form is there. */
function expectSafe(html: string) {
  expect(html).not.toMatch(/<script|<img src=x|onerror=alert\(2\)>/i);
  expect(html).toContain(ESCAPED);
  expect(html).not.toMatch(/<form|<input|<link |@import|<iframe|<object|<embed|javascript:/i);
  expect(html).not.toMatch(/<img[^>]*src="(?!https:\/\/example\.test)/);
}

const mails = {
  "confirm-en": () => renderConfirmMail({ name: "Ada", lang: "en" }, LINK, sender()),
  "confirm-he": () => renderConfirmMail({ name: "עדה", lang: "he" }, LINK, sender({ footerIdentity: "יהודה בריסקמן" })),
  "notice-en": () => renderContactNotice({ subject: "Portfolio contact from Ada", title: "New message from Ada", body: "Name: Ada\nEmail: ada@example.invalid\n\nHello,\nI liked the site.", replyTo: "ada@example.invalid" }, FOOTER),
  "notice-he": () => renderContactNotice({ subject: "Portfolio contact from עדה", title: "הודעה חדשה מעדה", body: "Name: עדה\nEmail: ada@example.invalid\n\nשלום, אהבתי את האתר.", replyTo: "ada@example.invalid" }, FOOTER),
  "autoreply-en": () => renderAutoReply("en", FOOTER),
  "autoreply-he": () => renderAutoReply("he", ["יהודה בריסקמן", "contact@example.org"]),
  "owner-en": () => {
    const ev = { _id: "g1", type: "announce", kind: "post", ref: "sample", title: "A design system for mail", titleHe: "מערכת עיצוב למייל", summary: "A short summary.", tags: [], url: "https://example.test/blog/sample", path: "/blog/sample", langs: ["en", "he"], createdAt: "2026-01-01T00:00:00Z", done: {} };
    return buildOwnerEmail(ev as never, renderKit(ev as never, DEFAULT_ANNOUNCE_SETTINGS), "https://example.test", FOOTER);
  },
};

describe("every transactional mail", () => {
  for (const [name, make] of Object.entries(mails)) {
    it(`${name}: snapshot of the page and its plain text, under the size limit`, () => {
      const m = make();
      expect(m.html).toMatchSnapshot("html");
      expect(m.text).toMatchSnapshot("text");
      expect(Buffer.byteLength(m.html, "utf8")).toBeLessThan(MAIL_HTML_LIMIT);
      expect(m.text.trim().length).toBeGreaterThan(0);
      expect(m.html).toMatch(/<meta name="viewport"/);
      expect(m.html).toMatch(/width="600"/);
    });
  }

  it("a huge body stays under 100 KB or says so (the renderer reports it)", () => {
    const m = renderContactNotice({ subject: "s", body: "x ".repeat(5_000) }, FOOTER);
    expect(Buffer.byteLength(m.html, "utf8")).toBeLessThan(MAIL_HTML_LIMIT);
  });

  it("carries the contact block in its footer, and the plain text twin carries it too", () => {
    for (const k of ["confirm-en", "confirm-he", "notice-en", "autoreply-en", "autoreply-he", "owner-en"] as const) {
      const m = mails[k]();
      expect(m.html).toContain("contact@example.org");
      expect(m.text).toContain("contact@example.org");
    }
  });

  it("language and direction: Hebrew is rtl, English ltr, on the root element", () => {
    expect(mails["confirm-he"]().html).toMatch(/<html lang="he" dir="rtl"/);
    expect(mails["autoreply-he"]().html).toMatch(/<html lang="he" dir="rtl"/);
    expect(mails["confirm-en"]().html).toMatch(/<html lang="en" dir="ltr"/);
    expect(mails["notice-he"]().html).toMatch(/<html lang="en" dir="ltr"/);
    /* A Hebrew message inside the English notice reads right-to-left by its own text. */
    expect(mails["notice-he"]().html).toContain('dir="auto"');
  });

  it("has a hidden preheader", () => {
    for (const k of ["confirm-en", "confirm-he", "notice-en", "autoreply-en", "autoreply-he"] as const) expect(mails[k]().html).toMatch(/display:none;max-height:0/);
  });
});

describe("markup in every field", () => {
  it("confirmation: name, subject, body words and every footer line", () => {
    const s = sender({ footerIdentity: NASTY, identityPostal: NASTY, confirmSubjectEn: NASTY, confirmBodyEn: `${NASTY} {name}\n\n{link}\n\n${NASTY}` });
    const m = renderConfirmMail({ name: NASTY, lang: "en" }, LINK, s);
    expectSafe(m.html);
    expect(m.subject).not.toMatch(/[\r\n]/);
  });

  it("contact notice: title, subject, body, button, reply-to and footer", () => {
    const m = renderContactNotice({ subject: NASTY, title: NASTY, body: `${NASTY}\n\n${NASTY}`, ctaText: NASTY, ctaHref: `https://example.test/x?a="><script>`, replyTo: NASTY }, [NASTY, NASTY]);
    expectSafe(m.html);
    expect(m.html).not.toContain('"><script>');
  });

  it("auto-reply: footer lines", () => {
    expectSafe(renderAutoReply("en", [NASTY, NASTY]).html);
    expectSafe(renderAutoReply("he", [NASTY]).html);
  });

  it("owner announce mail: every field of the event and the footer", () => {
    const ev = { _id: "g1", type: "announce", kind: "release", version: NASTY, ref: "v1.0.0", title: NASTY, titleHe: NASTY + "x", summary: NASTY, tags: [], url: "https://example.test/x", path: "/x", langs: ["en"], createdAt: "2026-01-01T00:00:00Z", done: {} };
    const m = buildOwnerEmail(ev as never, renderKit(ev as never, DEFAULT_ANNOUNCE_SETTINGS), "https://example.test", [NASTY]);
    expectSafe(m.html);
  });
});

/* The required link / headers of each mail, through the real service with a recording provider. */
describe("what each mail still contains once sent", () => {
  afterEach(() => vi.restoreAllMocks());

  async function service() {
    const providers = await import("../providers/index.js");
    const send = vi.fn().mockResolvedValue({ ok: true, messageId: "1" });
    vi.spyOn(providers, "getProvider").mockReturnValue({ send });
    const store = await import("../announce/store.js");
    vi.spyOn(store, "loadSettings").mockResolvedValue({ ...DEFAULT_ANNOUNCE_SETTINGS, sender: sender() });
    const { emailService } = await import("../services/email.service.js");
    return { send, emailService };
  }

  it("confirmation: the confirm link in text and page, no List-Unsubscribe", async () => {
    const { send, emailService } = await service();
    const m = renderConfirmMail({ name: "Ada", lang: "en" }, LINK, sender());
    await emailService.sendTo({ to: "ada@example.invalid", ...m });
    const msg = send.mock.calls[0][0];
    expect(msg.text).toContain(LINK);
    expect(msg.html).toContain(`href="${LINK}"`);
    expect(msg.headers?.["List-Unsubscribe"]).toBeUndefined();
  });

  it("contact notice: to the owner, reply-to the visitor, the message and the contact block, no List-Unsubscribe", async () => {
    const { send, emailService } = await service();
    await emailService.send(
      { subject: "Portfolio contact from Ada", replyTo: "ada@example.invalid", template: { name: "basic", params: { title: "New message from Ada", body: "Name: Ada\nEmail: ada@example.invalid\n\nHello there" } } } as never,
      { publicForm: true },
    );
    const notice = send.mock.calls[0][0];
    expect(notice.replyTo).toBe("ada@example.invalid");
    expect(notice.text).toContain("Hello there");
    expect(notice.html).toContain("Hello there");
    expect(notice.html).toContain("contact@example.org");
    expect(notice.headers?.["List-Unsubscribe"]).toBeUndefined();
  });

  it("auto-reply: thanks and the contact block, never the visitor's message, Hebrew for Hebrew, no List-Unsubscribe", async () => {
    const { send, emailService } = await service();
    await emailService.send({ subject: "Portfolio contact from עדה", replyTo: "ada.he@example.invalid", template: { name: "basic", params: { body: "שלום סודי-מאוד-12345" } } } as never, { publicForm: true });
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    const reply = send.mock.calls[1][0];
    expect(reply.to).toBe("ada.he@example.invalid");
    expect(reply.html).toMatch(/<html lang="he" dir="rtl"/);
    expect(reply.html + reply.text).not.toContain("סודי-מאוד-12345");
    expect(reply.text).toContain("contact@example.org");
    expect(reply.headers?.["List-Unsubscribe"]).toBeUndefined();
  });

  it("announce owner mail: the inbox link, and no replyTo (so no auto-reply is triggered)", async () => {
    const { send, emailService } = await service();
    const m = mails["owner-en"]();
    await emailService.send({ subject: m.subject, html: m.html, text: m.text });
    const msg = send.mock.calls[0][0];
    expect(msg.html).toContain("https://example.test/admin/announce");
    expect(msg.text).toContain("https://example.test/admin/announce");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
