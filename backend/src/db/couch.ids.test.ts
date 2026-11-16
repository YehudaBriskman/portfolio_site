import { couch } from "./couch.js";

afterEach(() => vi.unstubAllGlobals());

describe("couch document ids", () => {
  it.each([".", "..", ""])("refuses the id %j before any request is made", async (id) => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    await expect(couch.get(id)).rejects.toThrow(/invalid document id/);
    await expect(couch.put(id, {})).rejects.toThrow(/invalid document id/);
    await expect(couch.del(id, "1-a")).rejects.toThrow(/invalid document id/);
    expect(f).not.toHaveBeenCalled();
  });

  it("still encodes an ordinary id into one path segment", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    await couch.get("post:a/b");
    expect(String(f.mock.calls[0][0])).toMatch(/\/portfolio_content\/post%3Aa%2Fb$/);
  });
});
