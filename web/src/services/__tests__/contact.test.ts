import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactError, ContactSchema, MESSAGE_MAX, NAME_MAX, sendContactMessage } from "@/services/contact";

const fetchMock = vi.fn();
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});
const good = { name: "Dana", email: "dana@example.com", message: "A message that is long enough." };

/* The form tells the reader what to do from `kind`, never from the server's
   text or the browser's: those are English, and are machine words. */
async function failure(): Promise<ContactError> {
  const e = await sendContactMessage(good).then(
    () => null,
    (err) => err,
  );
  expect(e).toBeInstanceOf(ContactError);
  return e as ContactError;
}

describe("sendContactMessage failures", () => {
  it.each([
    [429, "rate", { ok: false, error: "Too many requests. Try again shortly." }],
    [413, "large", "<html>Payload Too Large</html>"],
    [502, "server", { ok: false, error: "Could not send the message right now" }],
    [500, "server", {}],
    [400, "server", { ok: false, error: { formErrors: ["bad"] } }],
  ])("HTTP %i is kind %s and carries no machine text", async (status, kind, body) => {
    fetchMock.mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetchMock);
    const e = await failure();
    expect(e.kind).toBe(kind);
    expect(e.message).not.toMatch(/HTTP|\d{3}|Failed to fetch/);
  });

  it("an offline fetch is kind offline, without the browser's 'Failed to fetch'", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const e = await failure();
    expect(e.kind).toBe("offline");
    expect(e.message).not.toMatch(/Failed to fetch/);
  });

  it("success still resolves true", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendContactMessage(good)).resolves.toBe(true);
  });
});

describe("message length", () => {
  it("refuses a message over MESSAGE_MAX before any request", () => {
    expect(ContactSchema.safeParse({ ...good, message: "x".repeat(MESSAGE_MAX) }).success).toBe(true);
    expect(ContactSchema.safeParse({ ...good, message: "x".repeat(MESSAGE_MAX + 1) }).success).toBe(false);
  });

  it("the longest allowed name, email and message still fit the server's 10,000 character body", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const email = `${"a".repeat(64)}@${"b".repeat(185)}.com`;
    await sendContactMessage({ name: "n".repeat(NAME_MAX), email, message: "x".repeat(MESSAGE_MAX) });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.template.params.body.length).toBeLessThanOrEqual(10_000);
  });
});
