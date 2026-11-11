import { emailService } from "./email.service.js";
import * as providers from "../providers/index.js";
import { env } from "../env.js";

const input = { subject: "Hi", text: "Hello", replyTo: "ada@example.invalid" };

function fakeProvider(results: Array<{ ok: true; messageId: string } | { ok: false; error: string }>) {
  const send = vi.fn();
  for (const r of results) send.mockResolvedValueOnce(r);
  vi.spyOn(providers, "getProvider").mockReturnValue({ send });
  return send;
}

afterEach(() => vi.restoreAllMocks());

describe("EmailService.send", () => {
  it("passes a server-built html part through with the text and sends no auto-reply", async () => {
    const send = fakeProvider([{ ok: true, messageId: "1" }]);
    await emailService.send({ subject: "S", text: "t", html: "<p>h</p>" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ html: "<p>h</p>", text: "t", to: env.CONTACT_TO });
  });

  it("always sends the owner's message to CONTACT_TO", async () => {
    const send = fakeProvider([{ ok: true, messageId: "1" }, { ok: true, messageId: "2" }]);
    await emailService.send(input);
    expect(send.mock.calls[0][0].to).toBe(env.CONTACT_TO);
  });

  it("auto-replies to the visitor after a successful send", async () => {
    const send = fakeProvider([{ ok: true, messageId: "1" }, { ok: true, messageId: "2" }]);
    await emailService.send(input);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1][0].to).toBe("ada@example.invalid");
  });

  it("does not auto-reply when the owner's message failed", async () => {
    const send = fakeProvider([{ ok: false, error: "refused" }]);
    const result = await emailService.send(input);
    expect(result.ok).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("survives a failing auto-reply", async () => {
    const send = vi.fn().mockResolvedValueOnce({ ok: true, messageId: "1" }).mockRejectedValueOnce(new Error("down"));
    vi.spyOn(providers, "getProvider").mockReturnValue({ send });
    await expect(emailService.send(input)).resolves.toMatchObject({ ok: true });
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  });
});
