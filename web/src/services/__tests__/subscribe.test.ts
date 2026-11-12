import { afterEach, describe, expect, it, vi } from "vitest";
import { SubscribeError, confirmSubscription, getPreferences, looksLikeEmail, savePreferences, subscribe, unsubscribe } from "@/services/subscribe";

const fetchMock = vi.fn();
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});
const reply = (status: number, body: unknown = {}) => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
};

describe("subscribe service", () => {
  it("omits an empty name and trims the rest", async () => {
    reply(202, { ok: true });
    await subscribe({ email: " a@b.co ", name: "  ", lang: "he", topics: { blog: true, releases: false }, website: "" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "a@b.co", lang: "he", topics: { blog: true, releases: false }, website: "" });
  });

  it("maps failures to the three things a reader can act on", async () => {
    reply(429);
    await expect(subscribe({ email: "a@b.co", lang: "en", topics: { blog: true, releases: false }, website: "" })).rejects.toMatchObject({ kind: "rate" });
    reply(400);
    await expect(unsubscribe("t")).rejects.toBeInstanceOf(SubscribeError);
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(unsubscribe("t")).rejects.toMatchObject({ kind: "network" });
    reply(500);
    await expect(unsubscribe("t")).rejects.toMatchObject({ kind: "server" });
  });

  it("encodes the token in the query and reads the language back", async () => {
    reply(200, { ok: true, lang: "he" });
    expect(await confirmSubscription("a+b/c")).toEqual({ lang: "he" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/subscribe/confirm");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "a+b/c" });
  });

  it("reads and writes preferences, defaulting what the server leaves out", async () => {
    reply(200, { email: "a***@b.co", lang: "he", topics: { blog: true }, status: "active" });
    expect(await getPreferences("t")).toEqual({ email: "a***@b.co", lang: "he", topics: { blog: true, releases: false }, status: "active" });
    reply(200, { ok: true });
    await savePreferences("t", { lang: "en", topics: { blog: false, releases: true } });
    expect(fetchMock.mock.calls.at(-1)![1].method).toBe("PUT");
  });

  it("looksLikeEmail is a convenience, not the validator", () => {
    expect(looksLikeEmail("a@b.co")).toBe(true);
    expect(looksLikeEmail("a@b")).toBe(false);
    expect(looksLikeEmail("a b@c.de")).toBe(false);
  });
});
