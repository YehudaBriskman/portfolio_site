import { SendSchema } from "./email.js";

const form = {
  subject: "Portfolio contact from Ada",
  replyTo: "ada@example.invalid",
  template: { name: "basic", params: { title: "New message", body: "Hello" } },
};

describe("SendSchema (public contact endpoint)", () => {
  it("accepts exactly what the contact form sends", () => {
    expect(SendSchema.safeParse(form).success).toBe(true);
  });

  it("strips headers, html and attachments instead of passing them on", () => {
    const r = SendSchema.safeParse({ ...form, headers: { Bcc: "v@example.invalid" }, html: "<b>", attachments: [{ filename: "a", content: "b" }] });
    expect(r.success).toBe(true);
    if (r.success) expect(Object.keys(r.data)).not.toEqual(expect.arrayContaining(["headers"]));
    if (r.success) for (const k of ["headers", "html", "attachments"]) expect(r.data).not.toHaveProperty(k);
  });

  it.each(["a@example.invalid, b@example.invalid", "Ada <ada@example.invalid>", "ada@example.invalid\r\nBcc: v@example.invalid"])(
    "rejects replyTo %j", (replyTo) => expect(SendSchema.safeParse({ ...form, replyTo }).success).toBe(false));

  it("rejects a line break in the subject, an over-long body and a non-https link", () => {
    expect(SendSchema.safeParse({ ...form, subject: "a\nb" }).success).toBe(false);
    expect(SendSchema.safeParse({ ...form, template: { name: "basic", params: { body: "x".repeat(10_001) } } }).success).toBe(false);
    expect(SendSchema.safeParse({ ...form, template: { name: "basic", params: { body: "b", ctaHref: "javascript:alert(1)" } } }).success).toBe(false);
    expect(SendSchema.safeParse({ ...form, template: { name: "basic", params: { body: "b", ctaHref: "http://example.invalid" } } }).success).toBe(false);
  });
});

describe("SendSchema keeps no field the service ignores", () => {
  it("drops a caller-chosen recipient and idempotency key instead of accepting them", () => {
    const r = SendSchema.safeParse({ ...form, to: "victim@example.invalid", idempotencyKey: "k" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty("to");
      expect(r.data).not.toHaveProperty("idempotencyKey");
    }
  });
});
