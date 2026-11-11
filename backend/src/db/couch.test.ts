import { couch, CouchError } from "./couch.js";

/*
 * #131: a store that does not answer at all must surface as a CouchError, so
 * the error handler answers 502 like any other upstream failure rather than
 * 500 like a bug in the API.
 */
afterEach(() => vi.unstubAllGlobals());

describe("couch client", () => {
  it("wraps an unreachable store as CouchError with status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const err = await couch.get("anything").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CouchError);
    expect((err as CouchError).status).toBe(0);
    expect((err as CouchError).cause).toBeInstanceOf(TypeError);
  });

  it("still carries CouchDB's own status when it answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
    const err = await couch.get("missing").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CouchError);
    expect((err as CouchError).status).toBe(404);
  });

  it("wraps a 200 non-JSON body as CouchError so it answers 502, not 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>gateway</html>", { status: 200 })));
    const err = await couch.get("x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CouchError);
    expect((err as CouchError).status).toBe(0);
  });

  it("ensureIndex propagates a refused index but accepts result: exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
    await expect(couch.ensureIndex("i", ["a"])).rejects.toBeInstanceOf(CouchError);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"result":"exists"}', { status: 200 })));
    await expect(couch.ensureIndex("i", ["a"])).resolves.toBeUndefined();
  });
});
