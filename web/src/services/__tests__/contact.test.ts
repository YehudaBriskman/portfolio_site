import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactError, sendContactMessage } from "@/services/contact";

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
