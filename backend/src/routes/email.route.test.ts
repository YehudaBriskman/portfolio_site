import request from "supertest";
import { createApp } from "../app";
import { emailService } from "../services/email.service.js";
import { logger } from "../logger.js";

/*
 * The contact relay, with the mail service stubbed at its one entry point.
 *
 * No test here may reach SMTP: test-env.ts points the transport at
 * smtp.invalid, and `emailService.send` is replaced in every test that gets
 * past validation. The payload below is the one web/src/services/contact.ts
 * actually sends, so a schema change that breaks the real form breaks this.
 *
 * Each test builds its own app on purpose. The send limiter allows five
 * successful sends per fifteen minutes and lives inside createApp, so a shared
 * app would start answering 429 partway through the file.
 */

const formPayload = {
  provider: "smtp",
  to: "owner@example.invalid",
  subject: "Portfolio contact from Ada",
  replyTo: "ada@example.invalid",
  template: { name: "basic", params: { title: "New message from Ada", body: "Name: Ada\n\nHello there." } },
};

afterEach(() => vi.restoreAllMocks());

describe("POST /api/email/send", () => {
  it("sends a valid contact message", async () => {
    const send = vi.spyOn(emailService, "send").mockResolvedValue({ ok: true, messageId: "m-1" });
    const res = await request(createApp()).post("/api/email/send").send(formPayload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, messageId: "m-1" });
    expect(send).toHaveBeenCalledOnce();
  });

  it("rejects a payload with no body, before any mail is attempted", async () => {
    const send = vi.spyOn(emailService, "send");
    const { template: _omit, ...noBody } = formPayload;
    const res = await request(createApp()).post("/api/email/send").send(noBody);

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("reports a provider refusal as 502 with the provider's reason", async () => {
    vi.spyOn(emailService, "send").mockResolvedValue({ ok: false, error: "mailbox unavailable" });
    const res = await request(createApp()).post("/api/email/send").send(formPayload);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ ok: false, error: "mailbox unavailable" });
  });

  it("turns a thrown transport error into JSON 500 without its message", async () => {
    vi.spyOn(emailService, "send").mockRejectedValue(new Error("Invalid login: 535 user test@smtp.invalid"));
    const error = vi.spyOn(logger, "error");
    const res = await request(createApp()).post("/api/email/send").send(formPayload);

    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ ok: false, error: "Internal Server Error" });
    expect(res.body.error).not.toContain("535");
    // The cause is not lost: it is in the log, under pino's `err` key.
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), status: 500 }),
      "request failed",
    );
  });

  it("answers malformed JSON with a JSON 400 rather than an HTML page", async () => {
    const res = await request(createApp())
      .post("/api/email/send")
      .set("Content-Type", "application/json")
      .send('{"subject": ');

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.ok).toBe(false);
    expect(typeof res.body.error).toBe("string");
  });

  it("answers a body over the size limit with JSON 413", async () => {
    const res = await request(createApp())
      .post("/api/email/send")
      .send({ ...formPayload, text: "x".repeat(1024 * 1024 + 1) });

    expect(res.status).toBe(413);
    expect(res.body.ok).toBe(false);
  });
});

describe("POST /api/email/send: what the public endpoint no longer accepts", () => {
  const post = (extra: Record<string, unknown>) =>
    request(createApp()).post("/api/email/send").send({ ...formPayload, ...extra });

  it("drops caller-supplied headers, html and attachments before the service sees them", async () => {
    const send = vi.spyOn(emailService, "send").mockResolvedValue({ ok: true, messageId: "m-2" });
    const res = await post({
      headers: { Bcc: "victim@example.invalid" },
      html: "<script>1</script>",
      attachments: [{ filename: "a.txt", content: "x" }],
    });
    expect(res.status).toBe(200);
    const sent = send.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty("headers");
    expect(sent).not.toHaveProperty("html");
    expect(sent).not.toHaveProperty("attachments");
  });

  it.each([
    ["a list of addresses", "a@example.invalid, b@example.invalid"],
    ["a display-name form", "Ada <ada@example.invalid>"],
    ["an address with a line break", "ada@example.invalid\r\nBcc: v@example.invalid"],
  ])("rejects replyTo as %s", async (_n, replyTo) => {
    const send = vi.spyOn(emailService, "send");
    const res = await post({ replyTo });
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a subject with a line break and an over-long body", async () => {
    const send = vi.spyOn(emailService, "send");
    expect((await post({ subject: "hi\r\nBcc: v@example.invalid" })).status).toBe(400);
    expect((await post({ template: { name: "basic", params: { body: "x".repeat(10_001) } } })).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("accepts only an https button link", async () => {
    vi.spyOn(emailService, "send").mockResolvedValue({ ok: true, messageId: "m-3" });
    const bad = await post({ template: { name: "basic", params: { body: "b", ctaHref: "javascript:alert(1)" } } });
    expect(bad.status).toBe(400);
  });

  it("does not return the provider's error text", async () => {
    vi.spyOn(emailService, "send").mockResolvedValue({ ok: false, error: "535 auth failed for smtp-user@secret-host" });
    const res = await post({});
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("secret-host");
  });
});
